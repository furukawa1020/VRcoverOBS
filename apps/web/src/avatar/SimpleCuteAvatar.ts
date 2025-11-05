/**
 * SimpleCuteAvatar.ts
 * シンプルでかわいい親しみやすいアバター
 * - 大きな目
 - 丸い顔
 * - ふんわり髪
 * - 首あり
 * - アニメ風
 */

import * as THREE from 'three';

export class SimpleCuteAvatar {
  public group: THREE.Group;
  private blinkTimer = 0;
  private leftEye!: THREE.Mesh;
  private rightEye!: THREE.Mesh;

  constructor() {
    this.group = new THREE.Group();
    
    // 首を作成
    this.createNeck();
    
    // 頭を作成
    this.createHead();
    
    // 目を作成(大きくてかわいい)
    this.createEyes();
    
    // 口を作成
    this.createMouth();
    
    // 髪を作成(ふんわり)
    this.createHair();
    
    // 体を作成
    this.createBody();
    
    // うぐいすを追加
    this.createUguisu();
  }

  private createNeck() {
    const neckGeometry = new THREE.CylinderGeometry(0.04, 0.045, 0.08, 16);
    const neckMaterial = new THREE.MeshStandardMaterial({
      color: 0xFFDBB3, // 肌色
      roughness: 0.7,
      metalness: 0.0,
    });
    const neck = new THREE.Mesh(neckGeometry, neckMaterial);
    neck.position.set(0, 0.44, 0);
    this.group.add(neck);
  }

  private createHead() {
    // 可愛い丸い頭(小さめに!)
    const headGeometry = new THREE.SphereGeometry(0.09, 32, 32);
    const headMaterial = new THREE.MeshStandardMaterial({
      color: 0xFFDBB3, // 肌色
      roughness: 0.6,
      metalness: 0.0,
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.set(0, 0.5, 0);
    head.scale.set(1, 1.05, 0.98); // 少し縦長に
    this.group.add(head);
  }

  private createEyes() {
    // 大きな目(もっと前に出す!)
    const eyeGeometry = new THREE.SphereGeometry(0.028, 16, 16);
    
    // 白目
    const whiteEyeMaterial = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF,
      roughness: 0.3,
      metalness: 0.1,
    });
    
    const leftWhite = new THREE.Mesh(eyeGeometry, whiteEyeMaterial);
    leftWhite.position.set(-0.035, 0.515, 0.085); // 前に出して下げる
    this.group.add(leftWhite);
    
    const rightWhite = new THREE.Mesh(eyeGeometry, whiteEyeMaterial);
    rightWhite.position.set(0.035, 0.515, 0.085);
    this.group.add(rightWhite);
    
    // 瞳(大きくキラキラ✨)
    const pupilGeometry = new THREE.SphereGeometry(0.02, 16, 16);
    const pupilMaterial = new THREE.MeshStandardMaterial({
      color: 0x1E6F68, // 翠青色
      roughness: 0.1,
      metalness: 0.4,
      emissive: 0x1E6F68,
      emissiveIntensity: 0.5,
    });
    
    this.leftEye = new THREE.Mesh(pupilGeometry, pupilMaterial);
    this.leftEye.position.set(-0.035, 0.515, 0.1);
    this.group.add(this.leftEye);
    
    this.rightEye = new THREE.Mesh(pupilGeometry, pupilMaterial);
    this.rightEye.position.set(0.035, 0.515, 0.1);
    this.group.add(this.rightEye);
    
    // ハイライト(キラキラ✨)
    const highlightGeometry = new THREE.SphereGeometry(0.008, 8, 8);
    const highlightMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF,
      transparent: true,
      opacity: 0.9,
    });
    
    const leftHighlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
    leftHighlight.position.set(-0.028, 0.522, 0.11);
    this.group.add(leftHighlight);
    
    const rightHighlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
    rightHighlight.position.set(0.042, 0.522, 0.11);
    this.group.add(rightHighlight);
    
    // 二重ハイライト
    const smallHighlightGeo = new THREE.SphereGeometry(0.004, 8, 8);
    const leftHighlight2 = new THREE.Mesh(smallHighlightGeo, highlightMaterial);
    leftHighlight2.position.set(-0.04, 0.51, 0.11);
    this.group.add(leftHighlight2);
    
    const rightHighlight2 = new THREE.Mesh(smallHighlightGeo, highlightMaterial);
    rightHighlight2.position.set(0.03, 0.51, 0.11);
    this.group.add(rightHighlight2);
  }

  private createMouth() {
    // VTuber風のかわいい笑顔の口✨
    const mouthCurve = new THREE.EllipseCurve(
      0, 0,
      0.025, 0.015, // 小さめに
      Math.PI * 0.15, Math.PI * 0.85,
      false,
      0
    );
    
    const mouthPoints = mouthCurve.getPoints(20);
    const mouthGeometry = new THREE.BufferGeometry().setFromPoints(mouthPoints);
    const mouthMaterial = new THREE.LineBasicMaterial({
      color: 0xFF6B8A, // ピンク
      linewidth: 2,
    });
    
    const mouth = new THREE.Line(mouthGeometry, mouthMaterial);
    mouth.position.set(0, 0.48, 0.09);
    mouth.rotation.x = Math.PI / 2;
    this.group.add(mouth);
    
    // ほっぺの赤み(チーク)💕
    const cheekGeometry = new THREE.CircleGeometry(0.015, 16);
    const cheekMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFB6C1,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    
    const leftCheek = new THREE.Mesh(cheekGeometry, cheekMaterial);
    leftCheek.position.set(-0.05, 0.495, 0.085);
    this.group.add(leftCheek);
    
    const rightCheek = new THREE.Mesh(cheekGeometry, cheekMaterial);
    rightCheek.position.set(0.05, 0.495, 0.085);
    this.group.add(rightCheek);
  }

  private createHair() {
    // VTuber感マシマシ!翠青色の髪✨(小さめに調整)
    const hairMaterial = new THREE.MeshStandardMaterial({
      color: 0x1E6F68, // 翠青色
      roughness: 0.6,
      metalness: 0.3,
      emissive: 0x0A3430,
      emissiveIntensity: 0.2,
    });
    
    // 前髪(ふんわりボリューミー!)
    const bangGeometry = new THREE.SphereGeometry(0.095, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const bangs = new THREE.Mesh(bangGeometry, hairMaterial);
    bangs.position.set(0, 0.54, 0.02);
    this.group.add(bangs);
    
    // 後ろ髪(ロングでふわふわ!)
    const backHairGeometry = new THREE.SphereGeometry(0.092, 16, 16, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.8);
    const backHair = new THREE.Mesh(backHairGeometry, hairMaterial);
    backHair.position.set(0, 0.51, -0.03);
    backHair.scale.y = 1.2;
    this.group.add(backHair);
    
    // サイドの髪(ツインテール風)
    const sideHairGeometry = new THREE.CylinderGeometry(0.025, 0.03, 0.28, 8);
    
    const leftSideHair = new THREE.Mesh(sideHairGeometry, hairMaterial);
    leftSideHair.position.set(-0.085, 0.36, 0);
    leftSideHair.rotation.z = Math.PI * 0.12;
    this.group.add(leftSideHair);
    
    const rightSideHair = new THREE.Mesh(sideHairGeometry, hairMaterial);
    rightSideHair.position.set(0.085, 0.36, 0);
    rightSideHair.rotation.z = -Math.PI * 0.12;
    this.group.add(rightSideHair);
    
    // 雪の結晶ヘアピン(キラキラ!)
    const snowflakeGeometry = new THREE.OctahedronGeometry(0.022, 0);
    const snowflakeMaterial = new THREE.MeshStandardMaterial({
      color: 0xF7F7F7,
      roughness: 0.05,
      metalness: 0.9,
      emissive: 0xCCEEFF,
      emissiveIntensity: 0.5,
    });
    
    const snowflake = new THREE.Mesh(snowflakeGeometry, snowflakeMaterial);
    snowflake.position.set(0.065, 0.57, 0.05);
    this.group.add(snowflake);
    
    // 星型の髪飾り⭐
    const starShape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const radius = i % 2 === 0 ? 0.012 : 0.006;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) starShape.moveTo(x, y);
      else starShape.lineTo(x, y);
    }
    starShape.closePath();
    
    const starGeometry = new THREE.ExtrudeGeometry(starShape, {
      depth: 0.003,
      bevelEnabled: false,
    });
    const starMaterial = new THREE.MeshStandardMaterial({
      color: 0xFFD700,
      roughness: 0.2,
      metalness: 0.8,
      emissive: 0xFFD700,
      emissiveIntensity: 0.4,
    });
    
    const star = new THREE.Mesh(starGeometry, starMaterial);
    star.position.set(-0.06, 0.56, 0.05);
    star.rotation.z = Math.PI / 4;
    this.group.add(star);
  }

  private createBody() {
    // 胴体(可愛いワンピース)
    const bodyGeometry = new THREE.CylinderGeometry(0.12, 0.16, 0.38, 16);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xF0F8FF, // アリスブルー(淡い青)
      roughness: 0.7,
      metalness: 0.05,
    });
    
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.set(0, 0.27, 0);
    this.group.add(body);
    
    // 腕(肌色)
    const armGeometry = new THREE.CylinderGeometry(0.03, 0.035, 0.27, 8);
    const skinMaterial = new THREE.MeshStandardMaterial({
      color: 0xFFDBB3,
      roughness: 0.7,
      metalness: 0.0,
    });
    
    const leftArm = new THREE.Mesh(armGeometry, skinMaterial);
    leftArm.position.set(-0.16, 0.34, 0);
    leftArm.rotation.z = Math.PI * 0.18;
    this.group.add(leftArm);
    
    const rightArm = new THREE.Mesh(armGeometry, skinMaterial);
    rightArm.position.set(0.16, 0.34, 0);
    rightArm.rotation.z = -Math.PI * 0.18;
    this.group.add(rightArm);
    
    // 大きなリボン(胸元に大きく!)🎀
    const ribbonCenterGeo = new THREE.BoxGeometry(0.06, 0.06, 0.02);
    const ribbonMaterial = new THREE.MeshStandardMaterial({
      color: 0x1E6F68, // 翠青
      roughness: 0.3,
      metalness: 0.3,
      emissive: 0x0A3430,
      emissiveIntensity: 0.2,
    });
    
    const ribbonCenter = new THREE.Mesh(ribbonCenterGeo, ribbonMaterial);
    ribbonCenter.position.set(0, 0.44, 0.13);
    this.group.add(ribbonCenter);
    
    // リボンの左右の輪
    const ribbonLoopGeo = new THREE.TorusGeometry(0.04, 0.012, 8, 16);
    const leftLoop = new THREE.Mesh(ribbonLoopGeo, ribbonMaterial);
    leftLoop.position.set(-0.05, 0.44, 0.13);
    leftLoop.rotation.y = Math.PI / 2;
    this.group.add(leftLoop);
    
    const rightLoop = new THREE.Mesh(ribbonLoopGeo, ribbonMaterial);
    rightLoop.position.set(0.05, 0.44, 0.13);
    rightLoop.rotation.y = Math.PI / 2;
    this.group.add(rightLoop);
    
    // 襟(白いフリル)
    const collarGeo = new THREE.TorusGeometry(0.09, 0.015, 8, 24, Math.PI);
    const collarMat = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF,
      roughness: 0.8,
      metalness: 0.0,
    });
    
    const collar = new THREE.Mesh(collarGeo, collarMat);
    collar.position.set(0, 0.52, 0.08);
    collar.rotation.x = Math.PI / 2;
    this.group.add(collar);
  }

  private createUguisu() {
    // うぐいす(肩に乗せる)
    const uguisuBody = new THREE.SphereGeometry(0.035, 16, 16);
    const uguisuMaterial = new THREE.MeshStandardMaterial({
      color: 0x928C36, // うぐいす色
      roughness: 0.7,
      metalness: 0.1,
    });
    
    const uguisu = new THREE.Mesh(uguisuBody, uguisuMaterial);
    uguisu.position.set(0.12, 0.5, 0.08);
    uguisu.scale.set(1, 0.9, 1.1);
    this.group.add(uguisu);
    
    // くちばし
    const beakGeometry = new THREE.ConeGeometry(0.008, 0.02, 8);
    const beakMaterial = new THREE.MeshStandardMaterial({
      color: 0xFFA500,
      roughness: 0.5,
    });
    
    const beak = new THREE.Mesh(beakGeometry, beakMaterial);
    beak.position.set(0.12, 0.5, 0.12);
    beak.rotation.x = Math.PI / 2;
    this.group.add(beak);
    
    // 目
    const eyeGeometry = new THREE.SphereGeometry(0.006, 8, 8);
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(0.11, 0.51, 0.105);
    this.group.add(leftEye);
    
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.13, 0.51, 0.105);
    this.group.add(rightEye);
  }

  public update(deltaTime: number) {
    // まばたき
    this.blinkTimer += deltaTime;
    
    if (this.blinkTimer > 2.5) { // 少し頻繁に
      this.blink();
      this.blinkTimer = 0;
    }
    
    // VTuber感マシマシのアニメーション✨
    const time = Date.now() * 0.001;
    
    // ふわふわ上下(呼吸感)
    this.group.position.y = Math.sin(time * 2) * 0.015;
    
    // 左右にゆらゆら(可愛い揺れ)
    this.group.rotation.z = Math.sin(time * 1.8) * 0.03;
    
    // 前後に少し揺れる
    this.group.rotation.x = Math.sin(time * 1.5) * 0.01;
  }

  private blink() {
    // 目を閉じる
    this.leftEye.scale.y = 0.1;
    this.rightEye.scale.y = 0.1;
    
    // 0.15秒後に開く
    setTimeout(() => {
      this.leftEye.scale.y = 1;
      this.rightEye.scale.y = 1;
    }, 150);
  }

  public dispose() {
    this.group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (object.material instanceof THREE.Material) {
          object.material.dispose();
        }
      }
    });
  }
}
