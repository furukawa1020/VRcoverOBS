/**
 * ProceduralAvatar.ts
 * VRoidで作った超可愛いVRMアバターを使用！✨
 */

import * as THREE from 'three';
import { VRoidAvatar } from './VRoidAvatar';

export interface ProceduralAvatarOptions {
  position?: THREE.Vector3;
  scale?: number;
}

export class ProceduralAvatar {
  public group: THREE.Group;
  
  private avatar: VRoidAvatar;
  private breatheTimer: number = 0;
  private isLoaded: boolean = false;
  
  constructor(options: ProceduralAvatarOptions = {}) {
    this.group = new THREE.Group();
    
    // === VRoidアバターを生成 ===
    console.log('[ProceduralAvatar] 🎀 VRoid可愛いアバター読み込み中...');
    this.avatar = new VRoidAvatar();
    this.group.add(this.avatar.group);
    
    // VRMモデルを非同期で読み込み
    this.loadVRMModel();
    
    // === 位置・スケール ===
    if (options.position) {
      this.group.position.copy(options.position);
    }
    
    if (options.scale) {
      this.group.scale.setScalar(options.scale);
    }
    
    console.log('[ProceduralAvatar] 準備完了！モデル読み込み待機中...');
  }
  
  private async loadVRMModel() {
    try {
      await this.avatar.loadModel('/models/hakusan-avatar.vrm');
      this.isLoaded = true;
      console.log('[ProceduralAvatar] ✨ VRMモデル読み込み完了！めちゃかわいい！');
    } catch (error) {
      console.error('[ProceduralAvatar] ❌ VRMモデル読み込み失敗:', error);
      console.log('[ProceduralAvatar] 💡 ヒント: apps/web/public/models/hakusan-avatar.vrm にモデルを配置してください');
    }
  }
  
  /**
   * フレーム更新(アニメーション)
   */
  public update(deltaTime: number) {
    // VRoidAvatarのupdateを呼び出し
    this.avatar.update(deltaTime);
    
    // === 呼吸アニメーション ===
    this.breatheTimer += deltaTime;
    const breatheScale = 1.0 + Math.sin(this.breatheTimer * 1.5) * 0.01;
    this.avatar.group.scale.y = breatheScale;
  }
  
  /**
   * 表情変更(VRoidAvatarに委譲)
   */
  public setExpression(expression: string, weight: number) {
    this.avatar.setExpression(expression, weight);
  }
  
  /**
   * リップシンク
   */
  public setMouthOpen(value: number) {
    this.avatar.setMouthOpen(value);
  }
  
  /**
   * 頭の回転
   */
  public setHeadRotation(euler: THREE.Euler) {
    this.avatar.setHeadRotation(euler);
  }
  
  /**
   * 視線
   */
  public setEyeDirection(direction: THREE.Vector3) {
    // VRoidAvatarに視線機能を追加予定
  }
  
  /**
   * 破棄処理
   */
  public dispose() {
    this.group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        
        if (Array.isArray(object.material)) {
          object.material.forEach((mat) => mat.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
  }
}
