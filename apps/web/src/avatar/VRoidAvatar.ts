/**
 * VRoidAvatar.ts
 * VRoidで作成したVRMモデルを読み込んで使う
 * めちゃかわいいVTuberアバター！🎀
 */

import * as THREE from 'three';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class VRoidAvatar {
  public group: THREE.Group;
  private vrm: VRM | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private blinkTimer = 0;

  constructor() {
    this.group = new THREE.Group();
  }

  /**
   * VRMモデルを読み込み
   */
  async loadModel(modelPath: string = '/models/hakusan-avatar.vrm'): Promise<void> {
    console.log('[VRoidAvatar] VRMモデル読み込み中...', modelPath);

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    try {
      const gltf = await loader.loadAsync(modelPath);
      
      this.vrm = gltf.userData.vrm as VRM;
      
      if (!this.vrm) {
        throw new Error('VRMデータが見つかりません');
      }

      // VRMモデルを回転調整
      VRMUtils.rotateVRM0(this.vrm);
      
      this.group.add(this.vrm.scene);
      
      // アニメーションミキサー
      this.mixer = new THREE.AnimationMixer(this.vrm.scene);
      
      console.log('[VRoidAvatar] ✨ VRMモデル読み込み完了！めちゃかわいい！');
      
    } catch (error) {
      console.error('[VRoidAvatar] ❌ モデル読み込みエラー:', error);
      throw error;
    }
  }

  /**
   * フレーム更新
   */
  update(deltaTime: number) {
    if (!this.vrm) return;

    // VRMの更新
    this.vrm.update(deltaTime);
    
    // アニメーション更新
    if (this.mixer) {
      this.mixer.update(deltaTime);
    }

    // まばたき
    this.blinkTimer += deltaTime;
    if (this.blinkTimer > 3.0) {
      this.blink();
      this.blinkTimer = 0;
    }

    // ふわふわ揺れる(可愛い動き)
    const time = Date.now() * 0.001;
    this.group.position.y = Math.sin(time * 2) * 0.01;
    this.group.rotation.z = Math.sin(time * 1.5) * 0.02;
  }

  /**
   * まばたき
   */
  private blink() {
    if (!this.vrm) return;

    const expressionManager = this.vrm.expressionManager;
    if (!expressionManager) return;

    // まばたきアニメーション
    expressionManager.setValue('blink', 1.0);
    
    setTimeout(() => {
      expressionManager?.setValue('blink', 0.0);
    }, 150);
  }

  /**
   * 表情変更
   */
  setExpression(expressionName: string, value: number) {
    if (!this.vrm?.expressionManager) return;
    
    this.vrm.expressionManager.setValue(expressionName, value);
  }

  /**
   * 頭の回転
   */
  setHeadRotation(euler: THREE.Euler) {
    if (!this.vrm) {
      console.log('[VRoidAvatar] VRMがまだ読み込まれていません');
      return;
    }

    const head = this.vrm.humanoid.getNormalizedBoneNode('head');
    if (head) {
      head.rotation.copy(euler);
      console.log('[VRoidAvatar] 頭回転:', euler.x, euler.y, euler.z);
    } else {
      console.warn('[VRoidAvatar] headボーンが見つかりません');
    }
  }

  /**
   * リップシンク
   */
  setMouthOpen(value: number) {
    if (!this.vrm?.expressionManager) {
      console.log('[VRoidAvatar] expressionManagerがありません');
      return;
    }
    
    console.log('[VRoidAvatar] 口開き:', value);
    this.vrm.expressionManager.setValue('aa', value);
  }

  /**
   * 破棄処理
   */
  dispose() {
    if (this.vrm) {
      VRMUtils.deepDispose(this.vrm.scene);
    }
  }
}
