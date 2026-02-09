/**
 * AvatarSystem - VRM制御・描画・アニメーションの統合システム
 */

import * as THREE from 'three';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CONFIG, THEME } from '../config';
import type { TrackingData } from '../tracking/types';
import { ProceduralAvatar } from './ProceduralAvatar';

export class AvatarSystem {
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private vrm: VRM | null = null;
  private proceduralAvatar: ProceduralAvatar | null = null;
  private useProceduralAvatar = false;
  private clock = new THREE.Clock();

  // アニメーション状態
  private idleTime = 0;
  private blinkTimer = 0;

  private nextBlinkTime = 3;
  private rotationLogged = false; // デバッグ用フラグ
  private isBlinking = false;
  private blinkStartTime = 0;
  private hasBodyTracking = false; // ボディトラッキング有効フラグ
  private lastBodyTrackingTime = 0; // 最終トラッキング時刻

  // 表情状態（スムージング用）
  private currentExpression = {
    blink: 0,
    mouthOpen: 0,
    mouthSmile: 0,
    eyeX: 0,
    eyeY: 0,
  };

  private currentHeadRotation: { x: number; y: number; z: number } | null = null;

  private targetHeadRotation: THREE.Quaternion = new THREE.Quaternion(); // 目標回転（スラープ補間用）

  // 全身の骨の目標回転を保持するマップ (BoneName -> Quaternion)
  private targetBoneRotations = new Map<string, THREE.Quaternion>();

  // Position smoothing for arms (EMA)
  private smoothedLeft?: { s: { x: number, y: number, z: number }, e: { x: number, y: number, z: number } };
  private smoothedRight?: { s: { x: number, y: number, z: number }, e: { x: number, y: number, z: number } };

  async init() {
    // シーンの初期化
    this.scene = new THREE.Scene();

    // URLパラメータで背景指定 (?bg=transparent|green|blue|snow)
    const params = new URLSearchParams(window.location.search);
    const bgParam = params.get('bg');

    if (bgParam === 'transparent') {
      this.scene.background = null;
    } else if (bgParam === 'green') {
      this.scene.background = new THREE.Color(0x00FF00);
    } else if (bgParam === 'blue') {
      this.scene.background = new THREE.Color(0x0000FF);
    } else if (bgParam === 'snow') {
      this.scene.background = new THREE.Color(THEME.colors.snowWhite);
    } else {
      this.scene.background = new THREE.Color(0x1E6F68); // デフォルト: 翠青
    }


    // カメラの初期化
    const container = document.getElementById('canvas-container')!;
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 20);
    // 前方から見る(バストアップ)
    this.camera.position.set(0, 1.3, 0.8);
    this.camera.lookAt(0, 1.25, 0); // アバターの顔の少し下を見る


    // レンダラーの初期化（PBR設定）
    this.renderer = new THREE.WebGLRenderer({
      antialias: CONFIG.avatar.rendering.antialias,
      alpha: CONFIG.avatar.rendering.alpha,
    });

    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(CONFIG.avatar.rendering.pixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; // Three.js r152以降
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = CONFIG.avatar.rendering.toneMappingExposure;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    // ライティングのセットアップ
    this.setupLighting();

    // HDRI環境マップの読み込み
    await this.loadHDRI(CONFIG.avatar.hdri.default);

    // ウィンドウリサイズ対応
    window.addEventListener('resize', () => this.onResize());

    console.log('✅ AvatarSystem 初期化完了');
  }

  private setupLighting() {
    // Key light (soft light reflecting from snowy mountains)
    const keyLight = new THREE.DirectionalLight(THEME.colors.snowWhite, 2.0);
    keyLight.position.set(2, 3, 2);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    this.scene.add(keyLight);

    // Fill light (cyan reminiscent of Tedori River)
    const fillLight = new THREE.DirectionalLight(THEME.colors.riverCyan, 0.8);
    fillLight.position.set(-2, 1, -1);
    this.scene.add(fillLight);

    // Rim light (emphasizing basalt silhouette)
    const rimLight = new THREE.DirectionalLight(THEME.colors.snowWhite, 1.0);
    rimLight.position.set(0, 1, -3);
    this.scene.add(rimLight);

    // Ambient light (overall base lighting)
    const ambient = new THREE.AmbientLight(THEME.colors.snowWhite, 0.8);
    this.scene.add(ambient);
  }

  private async loadHDRI(path: string) {
    // 安定性のため、一時的にHDRI読み込みを無効化し、常にシンプルな背景色を使用する
    console.log('Using default background color (Safety Mode)');
    this.scene.background = new THREE.Color(0x333333);
    this.scene.environment = null;
    return;

    /*
    try {
      const loader = new RGBELoader();
      const texture = await loader.loadAsync(path);
      texture.mapping = THREE.EquirectangularReflectionMapping;
      this.scene.environment = texture;
      console.log('HDRI environment map loaded');
    } catch (error) {
      console.warn('⚠️ HDRI読み込み失敗、デフォルト環境を使用:', error);
      // フォールバック：シンプルな背景色
      this.scene.background = new THREE.Color(0x333333);
      this.scene.environment = null;
    }
    */
  }


  async loadVRM(path: string) {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    try {
      const gltf = await loader.loadAsync(path);
      const vrm = gltf.userData.vrm as VRM;

      // VRMの座標系を修正
      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      VRMUtils.removeUnnecessaryJoints(gltf.scene);

      // 既存のVRMを削除
      if (this.vrm) {
        this.scene.remove(this.vrm.scene);
        VRMUtils.deepDispose(this.vrm.scene);
      }

      // プロシージャルアバターを削除
      if (this.proceduralAvatar) {
        this.scene.remove(this.proceduralAvatar.group);
        this.proceduralAvatar.dispose();
        this.proceduralAvatar = null;
      }

      // 新しいVRMをシーンに追加
      this.vrm = vrm;
      this.useProceduralAvatar = false;
      this.scene.add(vrm.scene);

      // 位置調整
      vrm.scene.position.set(
        CONFIG.avatar.position.x,
        CONFIG.avatar.position.y,
        CONFIG.avatar.position.z
      );
      vrm.scene.scale.setScalar(CONFIG.avatar.scale);
      vrm.scene.rotation.y = 0; // 初期状態で正面を向ける (0度)

      // 回転はVRoidAvatar.tsで管理
      console.log('✅ VRMモデル配置完了');

      // 影の設定
      vrm.scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });

      console.log('✅ VRMモデル読み込み完了:', path);
    } catch (error) {
      console.error('❌ VRM読み込みエラー:', error);
      console.log('🎨 プロシージャルアバターにフォールバック');

      // VRMが読み込めない場合、プロシージャルアバターを生成
      this.loadProceduralAvatar();
      throw error;
    }
  }

  /**
   * プロシージャルアバターを生成（VRMの代わり）
   */
  private loadProceduralAvatar() {
    console.log('🎨 超詳細プロシージャルアバター生成中...');
    console.log('   - 顔: 毛穴2000個、まつ毛70本、眉毛160本、産毛500本');
    console.log('   - 髪: 3000本以上 + 雪の結晶 + うぐいす髪飾り');
    console.log('   - 体: 骨格、筋肉、指紋、手相 + 肩乗りうぐいす');
    console.log('   - 服: 布の織り目、ボタン、レース');

    // 既存のVRMを削除
    if (this.vrm) {
      this.scene.remove(this.vrm.scene);
      this.vrm = null;
    }

    // プロシージャルアバターを生成
    this.proceduralAvatar = new ProceduralAvatar({
      position: new THREE.Vector3(
        CONFIG.avatar.position.x,
        CONFIG.avatar.position.y,
        CONFIG.avatar.position.z
      ),
      scale: CONFIG.avatar.scale,
    });

    this.useProceduralAvatar = true;
    this.scene.add(this.proceduralAvatar.group);

    console.log('✅ プロシージャルアバター生成完了！');
  }


  updateFromTracking(data: TrackingData) {
    if (this.useProceduralAvatar && this.proceduralAvatar) {
      // プロシージャルアバターの更新
      this.updateProceduralFromTracking(data);
      return;
    }

    if (!this.vrm) return;

    // 体のトラッキング適用（最優先）
    if (data.body) {
      // Check if data is valid (not all zeros)
      const valid = data.body.shoulder?.left?.x != 0 || data.body.shoulder?.right?.x != 0;
      if (valid) {
        this.hasBodyTracking = true;
        this.lastBodyTrackingTime = Date.now();
        this.applyBodyTracking(data.body);
      }
      // return; // ボディトラッキング時も顔のトラッキングを適用する (頭の回転など)
    }

    const proxy = this.vrm.expressionManager;
    if (!proxy) return;

    // 表情のスムージング（EMA）
    const smooth = CONFIG.avatar.expression.smoothingFactor;

    // Helper: EMA
    const applyEMA = (current: number, target: number, alpha: number) => {
      return (current || 0) * (1 - alpha) + (target || 0) * alpha;
    };

    this.currentExpression.mouthOpen = applyEMA(
      this.currentExpression.mouthOpen,
      data.mouthOpen,
      smooth
    );

    this.currentExpression.eyeX = applyEMA(
      this.currentExpression.eyeX,
      data.eyeX,
      CONFIG.avatar.lookAt.smoothingFactor
    );

    this.currentExpression.eyeY = applyEMA(
      this.currentExpression.eyeY,
      data.eyeY,
      CONFIG.avatar.lookAt.smoothingFactor
    );

    // 口形状の適用（非線形カーブ）
    const mouthValue = CONFIG.avatar.expression.mouthCurve(
      this.currentExpression.mouthOpen
    );
    proxy.setValue('aa', mouthValue);
    proxy.setValue('ih', mouthValue * 0.3); // 補助的に他の母音も入れる
    proxy.setValue('ou', mouthValue * 0.3);

    // 視線の適用
    if (this.vrm.lookAt) {
      // 目の向き修正: 白目になりすぎないように制限
      // OpenSeeFace: +Y is Up? 
      // Three.js: +Y is Up.
      // 元のコード: (x, y, -1)
      // 目がひんむく -> Yの値が大きすぎる可能性

      const gazeScale = 0.5; // 移動量を抑える
      const gazeX = this.currentExpression.eyeX * gazeScale;
      const gazeY = this.currentExpression.eyeY * gazeScale;

      this.vrm.lookAt.lookAt(new THREE.Vector3(
        gazeX,
        gazeY, // そのまま適用してみる (ひんむくならマイナスかも?)
        1.0    // LookAt target is usually in front (Z+) or back?
        // Standard VRM: +Z is forward. Camera looks at -Z.
        // So target should be at +Z?
        // But default code was -1.
        // Let's try +1 (Forward)
      ));

      // LookAtのtargetは「ヘッドローカル座標系」か「ワールド」かによる
      // three-vrm doc: "lookAt( target: THREE.Vector3 )" - world position usually?
      // No, "The target position in the world space."
      // If we pass (x, y, 1), that is world (x,y,1). 
      // If head is at (0, 1.5, 0), looking at (0, 0, 1) means looking DOWN.

      // If vrm.scene is at (0,0,0) (offset managed by humanoid), head is at ~1.5m Y.
      // To look "Forward", target should be (head.x, head.y, head.z + 1).

      const head = this.vrm.humanoid?.getNormalizedBoneNode('head');
      if (head) {
        const headPos = head.getWorldPosition(new THREE.Vector3());
        // 正面 1m先を見る
        /* 
           GazeX/Y are usually -1 to 1 range from tracker?
           We want to offset the look target from the head position.
        */
        const target = headPos.clone().add(new THREE.Vector3(gazeX, gazeY, 1.0)); // +Z is Forward for VRM (Normalized)
        this.vrm.lookAt.lookAt(target);
      }
    }

    // 頭部回転 (Degrees -> Radians変換 & 補正 & スムージング)
    if (data.headRotation) {
      // RawBoneNodeではなくNormalizedBoneNodeを使用してリグの差異を吸収
      const head = this.vrm.humanoid?.getNormalizedBoneNode('head');
      if (head) {
        // --- 1. デバイス座標系への補正 (OpenCV -> VRM) ---
        // OpenCV: P=0, Y=0, R=180 (Upside Down) -> VRM: P=0, Y=0, R=0

        let rx = data.headRotation.x;
        let ry = data.headRotation.y;
        let rz = data.headRotation.z;

        // Roll(Z)が 180度近辺(逆さま)の場合、0度近辺に補正する
        // 例: -171 -> 9, 175 -> -5
        if (Math.abs(rz) > 150) {
          rz = (rz > 0) ? rz - 180 : rz + 180;
          // Rollが反転していたので、符号も反転させる必要があるかも？
          // いったん「オフセット除去」のみ行う
        }

        // Pitch(X)も同様に反転している可能性があるが、ログでは P=5 程度なので正常範囲に見える
        // ただし、顔の向きによっては微調整が必要

        // --- 2. スムージング (EMA) ---
        // 前回の値を保持するための変数をクラスに追加する必要があるが、
        // 簡易的に currentExpression に持たせるか、新規プロパティを作る
        // 既存の currentExpression には入っていないため、ここで計算

        // 便宜上、this.currentExpression に rotation を追加拡張するか、
        // あるいは個別に保持する。今回は this.currentHeadRotation を使用 (後で定義追加)

        const smooth = CONFIG.avatar.lookAt.smoothingFactor; // 視線と同じ係数を使う

        // 初期化 (初回のみ)
        if (!this.currentHeadRotation) {
          this.currentHeadRotation = { x: rx, y: ry, z: rz };
        }

        this.currentHeadRotation.x = this.ema(this.currentHeadRotation.x, rx, smooth);
        this.currentHeadRotation.y = this.ema(this.currentHeadRotation.y, ry, smooth);
        this.currentHeadRotation.z = this.ema(this.currentHeadRotation.z, rz, smooth);

        // --- 3. 回転の適用 ---
        const pitch = THREE.MathUtils.degToRad(this.currentHeadRotation.x);
        const yaw = THREE.MathUtils.degToRad(this.currentHeadRotation.y);
        const roll = THREE.MathUtils.degToRad(this.currentHeadRotation.z);

        // クオータニオンで回転を作成
        // 軸の定義: VRM Normalizedでは +Y=Up, +Z=Front, +X=Right (Right-Handed)
        // 顔を上げる=X軸マイナス回転? (Right-Hand Rule: Thumb=+X, Fingers curl +Y->+Z. No.)
        // Usually Pitch rotates around X.

        const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -pitch);
        const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -yaw);
        const qRoll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll);

        // 回転を合成 (順序: Yaw -> Pitch -> Roll が一般的)
        const q = new THREE.Quaternion().copy(qYaw).multiply(qPitch).multiply(qRoll);

        // 直接適用せず、目標値として保持する（アニメーションループで補間）
        this.targetHeadRotation.copy(q);
      }
    }
  }

  /**
   * プロシージャルアバター用のトラッキング更新
   */
  private updateProceduralFromTracking(data: TrackingData) {
    if (!this.proceduralAvatar) return;

    // 表情のスムージング
    const smoothing = 0.3;

    this.currentExpression.blink =
      this.currentExpression.blink * (1 - smoothing) + data.blink * smoothing;
    this.currentExpression.mouthOpen =
      this.currentExpression.mouthOpen * (1 - smoothing) + data.mouthOpen * smoothing;
    this.currentExpression.mouthSmile =
      this.currentExpression.mouthSmile * (1 - smoothing) + data.mouthSmile * smoothing;

    // リップシンク
    this.proceduralAvatar.setMouthOpen(this.currentExpression.mouthOpen);

    // 表情
    if (this.currentExpression.mouthSmile > 0.3) {
      this.proceduralAvatar.setExpression('happy', this.currentExpression.mouthSmile);
    }

    // 視線
    this.proceduralAvatar.setEyeDirection(
      new THREE.Vector3(data.eyeX, data.eyeY, -1)
    );

    // 頭部回転
    if (data.headRotation) {
      const euler = new THREE.Euler(
        data.headRotation.x * 0.7,
        data.headRotation.y * 0.7,
        data.headRotation.z * 0.5
      );
      this.proceduralAvatar.setHeadRotation(euler);
    }

    // 🦴 全身トラッキング (体データがあれば適用)
    if ((data as any).body) {
      this.proceduralAvatar.applyFullBodyTracking((data as any).body);
    }
  }

  /**
   * 体のトラッキングデータを適用
   */
  private applyBodyTracking(body: any) {
    if (!this.vrm) return;
    if (!body) return;

    const humanoid = this.vrm.humanoid;
    if (!humanoid) return;

    // MediaPipe: x(0-1 左→右), y(0-1 上→下), z(0-1 奥→手前)

    // ヘルパー: 数値変換 (文字列 '0.00' 対策)
    const getVal = (v: any) => {
      const n = Number(v);
      return isNaN(n) ? 0 : n;
    };

    // 肩の回転(腕の動き)
    if (body.shoulder && body.elbow) {

      // 左肩 (LeftUpperArm)
      if (body.shoulder.left && body.elbow.left) {
        const s = { x: getVal(body.shoulder.left.x), y: getVal(body.shoulder.left.y), z: getVal(body.shoulder.left.z) };
        const e = { x: getVal(body.elbow.left.x), y: getVal(body.elbow.left.y), z: getVal(body.elbow.left.z) };

        // データが全部0なら無視 (無効データ)
        if (s.x === 0 && s.y === 0 && e.x === 0 && e.y === 0) {
          // Invalid data, ignore
        } else {
          const bone = humanoid.getNormalizedBoneNode('leftUpperArm' as any);
          if (bone) {
            // Smoothing: Apply EMA to shoulder/elbow positions (alpha=0.3 for responsiveness)
            const alpha = 0.3;
            if (!this.smoothedLeft) {
              this.smoothedLeft = { s: { ...s }, e: { ...e } };
            } else {
              this.smoothedLeft.s.x = alpha * s.x + (1 - alpha) * this.smoothedLeft.s.x;
              this.smoothedLeft.s.y = alpha * s.y + (1 - alpha) * this.smoothedLeft.s.y;
              this.smoothedLeft.s.z = alpha * s.z + (1 - alpha) * this.smoothedLeft.s.z;
              this.smoothedLeft.e.x = alpha * e.x + (1 - alpha) * this.smoothedLeft.e.x;
              this.smoothedLeft.e.y = alpha * e.y + (1 - alpha) * this.smoothedLeft.e.y;
              this.smoothedLeft.e.z = alpha * e.z + (1 - alpha) * this.smoothedLeft.e.z;
            }

            const sSmooth = this.smoothedLeft.s;
            const eSmooth = this.smoothedLeft.e;

            // Vector-based alignment (Fixes 'Arm Behind' & 'Twist')
            const vUpperMP = new THREE.Vector3(eSmooth.x - sSmooth.x, eSmooth.y - sSmooth.y, eSmooth.z - sSmooth.z).normalize();
            // MP(x, y, z) -> VRM(x, -y, -z) mapping
            const vUpperVRM = new THREE.Vector3(vUpperMP.x, -vUpperMP.y, -vUpperMP.z);

            // Simple Rotation Logic (Reverting complex vector math)
            // T-Pose: Arm is +X.
            // Goal: Map MP(x,y,z) to Arm Rotation.

            // 1. Roll (Z-axis rotation): Raise/Lower arm.
            // s.y vs e.y.
            // If e.y > s.y (Basic MP), arm is down.
            // atan2(dy, dx) might work better.

            const dx = eSmooth.x - sSmooth.x;
            const dy = eSmooth.y - sSmooth.y;
            const dz = eSmooth.z - sSmooth.z;

            // Standard T-Pose: Arm is Horizontal (+X).
            // MP: +Y is Down.

            // Calculate angle in XY plane (Roll/Adduction)
            // 0 rad = Arm Right (+X). PI/2 = Arm Down (+Y).
            let angleXY = Math.atan2(dy, dx);

            // VRM T-Pose (Left Arm): +X axis.
            // Z-rotation: + is raising? No, +Z rotates X -> Y (Down).
            // So we can apply angleXY directly-ish.

            // Compensation for T-Pose offset (0 rotation = Horizontal)
            // We want (0,0,-1) [Down] to be z-rot = -PI/2? No.
            // Let's stick to Unit Vectors but simplified.

            // Stable Rotation with Up-Vector Constraint
            // Problem: setFromUnitVectors allows free roll, causing elbow to point in random directions.
            // Solution: Construct basis with World Up (0,1,0) constraint to stabilize the elbow.

            const vDir = new THREE.Vector3(dx, -dy, -dz).normalize();
            const upConstraint = new THREE.Vector3(0, 1, 0);

            // Build Rotation Matrix:
            // X-axis (Bone Forward) = vDir
            // Z-axis = X cross Up (ensures consistent rotation plane)
            // Y-axis = Z cross X (orthogonalized Up)

            const xAxis = vDir.clone();
            let zAxis = new THREE.Vector3().crossVectors(xAxis, upConstraint).normalize();

            // Handle edge case: arm pointing straight up/down
            if (zAxis.lengthSq() < 0.001) {
              zAxis.set(0, 0, 1); // Fallback to forward
            }

            const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();

            const m = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
            const q = new THREE.Quaternion().setFromRotationMatrix(m);

            this.setTargetRotation('leftUpperArm', q);
          }

          // 前腕 (LeftLowerArm) & 手首 (LeftHand)
          if (body.wrist && body.wrist.left) {
            const w = { x: getVal(body.wrist.left.x), y: getVal(body.wrist.left.y), z: getVal(body.wrist.left.z) };
            const lowerArm = humanoid.getNormalizedBoneNode('leftLowerArm');

            if (lowerArm && (w.x !== 0 || w.y !== 0)) {
              // 肘の曲げ: ベクトル角度で計算 (堅牢化)
              // Upper: s -> e
              const vUpper = new THREE.Vector3(e.x - s.x, e.y - s.y, e.z - s.z).normalize();
              // Lower: e -> w
              const vLower = new THREE.Vector3(w.x - e.x, w.y - e.y, w.z - e.z).normalize();

              // 内積: cos(theta)
              let dot = vUpper.dot(vLower);
              // 誤差修正 (-1 ~ 1)
              dot = Math.max(-1, Math.min(1, dot));

              // 角度 (0:真っ直ぐ, PI:折りたたみ) -> VRMは 0:真っ直ぐ
              // ベクトルが一直線の時 dot=1 -> acos(1)=0. 
              // 折りたたむ時 dot=-1 -> acos(-1)=PI.
              // しかしMediaPipeの座標系で一直線(伸びている)ならdotは正。
              // 曲がると方向が変わる。
              // ベクトル定義: 上腕(肩->肘), 前腕(肘->手首).
              // 腕を伸ばすと、ほぼ同じ向き -> dot=1. angle=0.
              // 腕を曲げると... 90度でdot=0. angle=PI/2.
              // 完全に折りたたむとdot=-1. angle=PI.

              let bend = Math.acos(dot);

              // 過剰な曲がりを制限 (2.7くらいまで)
              if (bend > 2.7) bend = 2.7;

              // console.log(`Left Bend: ${bend.toFixed(2)}`);

              const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, bend, 0));
              this.setTargetRotation('leftLowerArm', q);

              // --- ピースサイン判定 (Z軸) ---
              // 手首がカメラに近い (Z < -0.1 くらい？) 場合にピース
              // 基準: 肩のZ位置からどれくらい前か
              const distZ = w.z - s.z;

              if (distZ < -0.1) { // 閾値を緩和 (-0.15 -> -0.1)
                this.setFingerPose('left', 'peace');
              } else {
                this.setFingerPose('left', 'neutral');
              }
            }
          }
        }
      }

      // 右肩 (RightUpperArm)
      if (body.shoulder.right && body.elbow.right) {
        const s = { x: getVal(body.shoulder.right.x), y: getVal(body.shoulder.right.y), z: getVal(body.shoulder.right.z) };
        const e = { x: getVal(body.elbow.right.x), y: getVal(body.elbow.right.y), z: getVal(body.elbow.right.z) };

        if (s.x === 0 && s.y === 0 && e.x === 0 && e.y === 0) {
          // Ignore
        } else {
          const bone = humanoid.getNormalizedBoneNode('rightUpperArm' as any);
          if (bone) {
            // Smoothing: Apply EMA (alpha=0.3)
            const alpha = 0.3;
            if (!this.smoothedRight) {
              this.smoothedRight = { s: { ...s }, e: { ...e } };
            } else {
              this.smoothedRight.s.x = alpha * s.x + (1 - alpha) * this.smoothedRight.s.x;
              this.smoothedRight.s.y = alpha * s.y + (1 - alpha) * this.smoothedRight.s.y;
              this.smoothedRight.s.z = alpha * s.z + (1 - alpha) * this.smoothedRight.s.z;
              this.smoothedRight.e.x = alpha * e.x + (1 - alpha) * this.smoothedRight.e.x;
              this.smoothedRight.e.y = alpha * e.y + (1 - alpha) * this.smoothedRight.e.y;
              this.smoothedRight.e.z = alpha * e.z + (1 - alpha) * this.smoothedRight.e.z;
            }

            const sSmooth = this.smoothedRight.s;
            const eSmooth = this.smoothedRight.e;

            // VRM Space Conversion
            const vUpperMP = new THREE.Vector3(eSmooth.x - sSmooth.x, eSmooth.y - sSmooth.y, eSmooth.z - sSmooth.z);
            const vLowerMP = new THREE.Vector3(
              (getVal(body.wrist?.right?.x) || eSmooth.x) - eSmooth.x,
              (getVal(body.wrist?.right?.y) || eSmooth.y) - eSmooth.y,
              (getVal(body.wrist?.right?.z) || eSmooth.z) - eSmooth.z
            );

            const vUpper = new THREE.Vector3(vUpperMP.x, -vUpperMP.y, -vUpperMP.z).normalize();
            const vLower = new THREE.Vector3(vLowerMP.x, -vLowerMP.y, -vLowerMP.z).normalize();

            // Simple Rotation Logic (Right Arm)
            // T-Pose: Arm is -X.

            const dx = eSmooth.x - sSmooth.x;
            const dy = eSmooth.y - sSmooth.y;
            const dz = eSmooth.z - sSmooth.z;

            // Stable Rotation with Up-Vector Constraint (Right Arm)
            // Right Arm bone points -X, so we negate vDir.

            const vDir = new THREE.Vector3(dx, -dy, -dz).normalize();
            const upConstraint = new THREE.Vector3(0, 1, 0);

            // Build Rotation Matrix for Right Arm (bone is -X axis)
            const xAxis = vDir.clone().negate(); // Bone points -X, so -vDir
            let zAxis = new THREE.Vector3().crossVectors(xAxis, upConstraint).normalize();

            if (zAxis.lengthSq() < 0.001) {
              zAxis.set(0, 0, 1);
            }

            const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();

            const m = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
            const q = new THREE.Quaternion().setFromRotationMatrix(m);

            this.setTargetRotation('rightUpperArm', q);

            /* Previous Logic Removed for Clarity
            // Right Arm Alignment (Basis)
            let vPlaneNormal = new THREE.Vector3().crossVectors(vUpper, vLower).normalize();
            if (vPlaneNormal.lengthSq() < 0.01) {
              vPlaneNormal.set(0, 1, 0);
            }

            // Target Basis for Right (bone points -X)
            const targetXAxis = vUpper.clone().negate();
            const targetYAxis = vPlaneNormal.clone();
            const targetZAxis = new THREE.Vector3().crossVectors(targetXAxis, targetYAxis).normalize();
            targetYAxis.crossVectors(targetZAxis, targetXAxis).normalize();

            const m = new THREE.Matrix4();
            m.makeBasis(targetXAxis, targetYAxis, targetZAxis);
            let q = new THREE.Quaternion().setFromRotationMatrix(m);

            // Z-axis (Depth) Compensation
            const depthDelta = eSmooth.z - sSmooth.z;
            if (depthDelta < -0.1) {
               // depthDelta is negative. Positive rotation moves Right Arm Forward (from -X axis).
              const pitchAdjust = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -depthDelta * 1.5);
              q.multiply(pitchAdjust);
            }
            */
            // End Previous Logic
          }

          // 前腕 (RightLowerArm)
          if (body.wrist && body.wrist.right) {
            const w = { x: getVal(body.wrist.right.x), y: getVal(body.wrist.right.y), z: getVal(body.wrist.right.z) };
            const lowerArm = humanoid.getNormalizedBoneNode('rightLowerArm');

            if (lowerArm && (w.x !== 0 || w.y !== 0)) {
              // ベクトル計算
              const vUpper = new THREE.Vector3(e.x - s.x, e.y - s.y, e.z - s.z).normalize();
              const vLower = new THREE.Vector3(w.x - e.x, w.y - e.y, w.z - e.z).normalize();

              let dot = vUpper.dot(vLower);
              dot = Math.max(-1, Math.min(1, dot));
              let bend = Math.acos(dot);
              if (bend > 2.7) bend = 2.7;

              // 右肘: マイナスで曲がる
              const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -bend, 0));
              this.setTargetRotation('rightLowerArm', q);

              // --- ピースサイン判定 (Z軸) ---
              const distZ = w.z - s.z;
              if (distZ < -0.1) {
                this.setFingerPose('right', 'peace');
              } else {
                this.setFingerPose('right', 'neutral');
              }
            }
          }
        }
      }
    }
  }

  /**
   * ボーンの目標回転を設定（直接適用せずMapに保存）
   */
  private setTargetRotation(boneName: string, quaternion: THREE.Quaternion) {
    // 既存のターゲットがあれば取得、なければ新規作成（GC抑制）
    if (!this.targetBoneRotations.has(boneName)) {
      this.targetBoneRotations.set(boneName, new THREE.Quaternion());
    }
    this.targetBoneRotations.get(boneName)!.copy(quaternion);
  }

  /**
   * 指のポーズを設定
   */
  private setFingerPose(hand: 'left' | 'right', pose: 'peace' | 'neutral') {
    if (!this.vrm || !this.vrm.humanoid) return;

    const setRot = (boneName: string, x: number, y: number, z: number) => {
      // 直接回転を設定せず、ターゲットマップを経由する
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
      this.setTargetRotation(boneName, q);
    };

    // 符号調整: 
    // Z軸: 曲げ (Curl) -> Left: -Z, Right: +Z (Usually) ... Based on previous tests: Left needs negative to curl? 
    // Y軸: 開き (Splay) -> Left: -Y opens out? Right: +Y opens out?

    // VRM 1.0 Normalized (T-Pose):
    // Left Hand: +Y is Forward (Thumb direction), +Z is Down? No.
    // Let's assume Standard Unity Humanoid Coordinates for Normalized Bones.
    // Curl: Rotation around Z-axis. 
    // Spread: Rotation around Y-axis.

    const prefix = hand === 'left' ? 'left' : 'right';

    const curlDir = (hand === 'left') ? -1.0 : 1.0;
    const spreadDir = (hand === 'left') ? -1.0 : 1.0; // 外側に開く方向

    if (pose === 'peace') {
      // ピースサイン (Vサイン)

      // 人差し指 (Index): 少し外側に開く
      setRot(`${prefix}IndexProximal`, 0, spreadDir * 0.1, 0);
      setRot(`${prefix}IndexIntermediate`, 0, 0, 0);
      setRot(`${prefix}IndexDistal`, 0, 0, 0);

      // 中指 (Middle): 少し内側に閉じる? いや、V字にするなら逆か？
      // 人差し指は親指側、中指は小指側に開くとVになる。
      // Left Hand: Thumb is +Y? No, Thumb is inside. 
      // If SpreadDir is "Outward", Index should go Inward?
      // Let's try: Index -> Neutral, Middle -> Spread Out slightly.
      setRot(`${prefix}MiddleProximal`, 0, spreadDir * -0.05, 0);
      setRot(`${prefix}MiddleIntermediate`, 0, 0, 0);
      setRot(`${prefix}MiddleDistal`, 0, 0, 0);

      // 薬指・小指: 深く曲げる (Classic Peace)
      const c = curlDir * 2.5; // Strong curl
      ['Ring', 'Little'].forEach(finger => {
        setRot(`${prefix}${finger}Proximal`, 0, 0, c);
        setRot(`${prefix}${finger}Intermediate`, 0, 0, c);
        setRot(`${prefix}${finger}Distal`, 0, 0, c);
      });

      // 親指: 薬指の上に置く感じで曲げる
      // 親指の軸は特殊だが、まずは内側に曲げる
      setRot(`${prefix}ThumbProximal`, 0, curlDir * 0.5, 0);
      setRot(`${prefix}ThumbIntermediate`, 0, curlDir * 0.5, 0);
      setRot(`${prefix}ThumbDistal`, 0, curlDir * 0.5, 0);

    } else {
      // Neutral: 自然な「五本指」 (Natural Open Hand)
      // 完全に平らではなく、わずかに曲げ、わずかに開く

      // 親指 (Thumb): 少し内側に入れる
      setRot(`${prefix}ThumbProximal`, 0, curlDir * 0.2, 0);
      setRot(`${prefix}ThumbIntermediate`, 0, curlDir * 0.1, 0);

      // 人差し指 (Index): ほぼ真っ直ぐだが、わずかに曲げる
      setRot(`${prefix}IndexProximal`, 0, spreadDir * -0.05, curlDir * 0.1);
      setRot(`${prefix}IndexIntermediate`, 0, 0, curlDir * 0.1);

      // 中指 (Middle): 中心
      setRot(`${prefix}MiddleProximal`, 0, 0, curlDir * 0.1);
      setRot(`${prefix}MiddleIntermediate`, 0, 0, curlDir * 0.1);

      // 薬指 (Ring): 少し外側に開きつつ、少し強く曲げる
      setRot(`${prefix}RingProximal`, 0, spreadDir * 0.05, curlDir * 0.2);
      setRot(`${prefix}RingIntermediate`, 0, 0, curlDir * 0.2);

      // 小指 (Little): さらに外側に開き、さらに曲げる
      setRot(`${prefix}LittleProximal`, 0, spreadDir * 0.1, curlDir * 0.3);
      setRot(`${prefix}LittleIntermediate`, 0, 0, curlDir * 0.3);
    }
  }



  /**
   * ボディトラッキングがない時の待機ポーズ（Tポーズ回避）
   */
  private resetToIdlePose() {
    if (!this.vrm || !this.vrm.humanoid) return;

    // NormalizedBoneNodeを使用
    const leftUpper = this.vrm.humanoid.getNormalizedBoneNode('leftUpperArm');
    const rightUpper = this.vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
    const leftLower = this.vrm.humanoid.getNormalizedBoneNode('leftLowerArm');
    const rightLower = this.vrm.humanoid.getNormalizedBoneNode('rightLowerArm');
    const leftHand = this.vrm.humanoid.getNormalizedBoneNode('leftHand');
    const rightHand = this.vrm.humanoid.getNormalizedBoneNode('rightHand');

    // PCを膝の上に置いている想定のポーズ (Typing on Lap)

    // 上腕 (UpperArm): 下ろしつつ、少し前に出す
    // Z軸: 下ろす (左=負, 右=正)
    // Y軸: 前に出す (左=正, 右=負) ※Normalizedの場合

    const upperArmDown = 1.3; // 約75度 (しっかり下ろす)
    const upperArmForward = 0.3; // 約17度 (少し前に)

    if (leftUpper) {
      // 左: Zマイナスで下げる、Yプラスで前、Xマイナスで内側?
      leftUpper.rotation.set(0, upperArmForward, -upperArmDown);
    }
    if (rightUpper) {
      // 右: Zプラスで下げる、Yマイナスで前
      rightUpper.rotation.set(0, -upperArmForward, upperArmDown);
    }

    // 前腕 (LowerArm): 肘を曲げて手を前に
    // Y軸: 曲げる (前腕の回転軸) -> Varies by model but usually Y in T-pose logic
    const elbowBend = 1.5; // 約85度 (直角近く曲げる)

    if (leftLower) {
      // 左肘: Yプラスで内側(前)に曲がるはず (Normalized)
      leftLower.rotation.set(0, elbowBend, 0);
    }
    if (rightLower) {
      // 右肘: Yマイナスで内側(前)に曲がるはず
      rightLower.rotation.set(0, -elbowBend, 0);
    }

    // 手首 (Hand): 文字を打つ感じで少し内側に
    if (leftHand) {
      leftHand.rotation.set(0, -0.2, 0);
    }
    if (rightHand) {
      rightHand.rotation.set(0, 0.2, 0);
    }
  }

  private updateIdleAnimation(deltaTime: number) {
    if (this.useProceduralAvatar) {
      // プロシージャルアバターは独自のアイドルアニメーション持ってる
      return;
    }

    if (!this.vrm) return;

    this.idleTime += deltaTime;

    // ボディトラッキングのタイムアウト判定 (1秒データが来なければアイドルへ)
    if (this.hasBodyTracking && Date.now() - this.lastBodyTrackingTime > 1000) {
      this.hasBodyTracking = false;
    }

    // ボディトラッキングがない場合は、腕を下ろす (Aポーズ)
    if (!this.hasBodyTracking) {
      this.resetToIdlePose();
    }

    // 呼吸アニメーション
    const breathCycle = CONFIG.avatar.idle.breathingCycle;
    const breathPhase = (this.idleTime % breathCycle) / breathCycle;
    const breathValue = Math.sin(breathPhase * Math.PI * 2) *
      CONFIG.avatar.idle.breathingAmplitude;

    // NormalizeBoneNodeを使用
    const chest = this.vrm.humanoid?.getNormalizedBoneNode('chest');
    if (chest) {
      // Normalized bone translation might behave differently, but usually fine for small offsets
      // Actually chest translation is bone elongation? Rotation is safer.
      // But let's try rotation for breath: X-rotation (Pitch)
      chest.rotation.set(Math.sin(breathPhase * Math.PI * 2) * 0.05, 0, 0);
    }

    // わずかな揺れ(川の流れのイメージ)
    const swayPhase = (this.idleTime * 0.3) % (Math.PI * 2);
    const swayValue = Math.sin(swayPhase) * CONFIG.avatar.idle.swayAmplitude;

    // 180度回転して正面を向かせる (Math.PI) -> 0度に変更 (VRMは+Z向き、カメラは+Zから-Zを見るため)
    if (this.vrm.scene) {
      this.vrm.scene.rotation.set(0, 0, swayValue);
    }
  }

  private updateBlinking(deltaTime: number) {
    if (!this.vrm?.expressionManager) return;

    const proxy = this.vrm.expressionManager;

    if (this.isBlinking) {
      // まばたき中
      const elapsed = this.clock.getElapsedTime() - this.blinkStartTime;
      const duration = CONFIG.avatar.expression.blinkDuration;

      if (elapsed < duration) {
        // まばたきカーブ適用
        const t = elapsed / duration;
        const value = CONFIG.avatar.expression.blinkCurve(t);
        this.currentExpression.blink = value;
      } else {
        // まばたき終了
        this.isBlinking = false;
        this.currentExpression.blink = 0;

        // 次のまばたきタイミングを設定
        const { min, max } = CONFIG.avatar.expression.blinkInterval;
        this.nextBlinkTime = this.blinkTimer + min + Math.random() * (max - min);
      }
    } else {
      // 次のまばたきまで待機
      this.blinkTimer += deltaTime;

      if (this.blinkTimer >= this.nextBlinkTime) {
        this.isBlinking = true;
        this.blinkStartTime = this.clock.getElapsedTime();
        this.blinkTimer = 0;
      }
    }

    proxy.setValue('blink', this.currentExpression.blink);
  }

  startAnimation() {
    const animate = () => {
      requestAnimationFrame(animate);

      const deltaTime = this.clock.getDelta();

      // プロシージャルアバターの更新
      if (this.useProceduralAvatar && this.proceduralAvatar) {
        this.proceduralAvatar.update(deltaTime);
      }

      // VRMの更新
      if (this.vrm) {
        this.vrm.update(deltaTime);

        // 頭部回転のスラープ補間（フレームレート非依存の滑らかさ）
        const head = this.vrm.humanoid?.getNormalizedBoneNode('head');

        const interpolationSpeed = 15.0 * deltaTime; // 補間速度

        if (head) {
          head.quaternion.slerp(this.targetHeadRotation, interpolationSpeed);
        }

        // 全身の骨の補間 (Mapから適用)
        if (this.vrm.humanoid) {
          this.targetBoneRotations.forEach((targetQuat, boneName) => {
            const bone = this.vrm!.humanoid!.getNormalizedBoneNode(boneName as any);
            if (bone) {
              bone.quaternion.slerp(targetQuat, interpolationSpeed);
            }
          });
        }
      }

      // アイドルアニメーション（VRMのみ）
      this.updateIdleAnimation(deltaTime);

      // 自動まばたき（VRMのみ）
      if (!this.useProceduralAvatar) {
        this.updateBlinking(deltaTime);
      }

      // レンダリング
      this.renderer.render(this.scene, this.camera);
    };

    animate();
  }

  private ema(prev: number, curr: number, alpha: number): number {
    return alpha * curr + (1 - alpha) * prev;
  }

  private onResize() {
    const container = document.getElementById('canvas-container')!;
    const width = container.clientWidth;
    const height = container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  // 公開API
  setExpression(name: string, value: number) {
    if (!this.vrm?.expressionManager) return;
    this.vrm.expressionManager.setValue(name, value);
  }

  async changeHDRI(preset: keyof typeof CONFIG.avatar.hdri.presets) {
    const path = CONFIG.avatar.hdri.presets[preset];
    await this.loadHDRI(path);
  }

  dispose() {
    if (this.vrm) {
      VRMUtils.deepDispose(this.vrm.scene);
    }
    this.renderer.dispose();
  }

  getDomElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }
}
