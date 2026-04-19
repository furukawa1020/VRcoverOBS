/**
 * UI - コントロールパネル
 * 白山モチーフのデザイン
 */

import { CONFIG, THEME } from '../config';
import type { AvatarSystem } from '../avatar/AvatarSystem';
import type { AudioProcessor } from '../audio/AudioProcessor';
import type { TrackingClient } from '../tracking/TrackingClient';
import { CanvasStreamer } from '../utils/CanvasStreamer';
import { MarkdownLoader } from '../utils/MarkdownLoader';


interface UIOptions {
  avatarSystem: AvatarSystem;
  audioProcessor: AudioProcessor;
  trackingClient: TrackingClient;
}

export class UI {
  private container: HTMLElement | null = null;
  private options: UIOptions;

  // 状態
  private isAIEnabled = false;

  private isVoiceChangerEnabled = false;
  private canvasStreamer: CanvasStreamer | null = null;
  private markdownLoader: MarkdownLoader = new MarkdownLoader();
  private docsModal: HTMLElement | null = null;


  constructor(options: UIOptions) {
    this.options = options;
  }

  init() {
    this.createContainer();
    this.createControls();
    this.initCanvasStreamer();
    this.attachEventListeners();
    console.log('✅ UI 初期化完了');
  }

  private initCanvasStreamer() {
    const canvas = this.options.avatarSystem.getDomElement();
    this.canvasStreamer = new CanvasStreamer(canvas, CONFIG.ai.streamUrl, 15); // さらにFPSを下げて負荷軽減 (20 -> 15)
  }


  private createContainer() {
    this.container = document.createElement('div');
    this.container.id = 'vrabater-ui';
    this.container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: linear-gradient(135deg, ${THEME.colors.riverCyan}dd 0%, ${THEME.colors.rockBlack}dd 100%);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      padding: 20px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      color: ${THEME.colors.text};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      z-index: 1000;
      min-width: 280px;
      border: 1px solid rgba(247, 247, 247, 0.1);
    `;

    document.body.appendChild(this.container);
  }

  private createControls() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="ui-header" style="margin-bottom: 20px; text-align: center;">
        <h2 style="font-size: 18px; font-weight: 300; letter-spacing: 0.1em; margin: 0;">
          VRabater
        </h2>
        <p style="font-size: 11px; opacity: 0.7; margin: 5px 0 0 0;">
          白山3Dアバター
        </p>
      </div>

      <div class="ui-section" style="margin-bottom: 15px;">
        <label class="ui-label">AI人格</label>
        <button id="ai-toggle" class="ui-toggle" data-enabled="false">
          <span class="toggle-text">手動モード</span>
        </button>
      </div>

      <div class="ui-section" style="margin-bottom: 15px;">
        <label class="ui-label">ボイスチェンジャー</label>
        <button id="voice-toggle" class="ui-toggle" data-enabled="false">
          <span class="toggle-text">オフ</span>
        </button>
      <div class="ui-section" style="margin-bottom: 15px;">
        <label class="ui-label">ボイスチェンジャー</label>
        <button id="voice-toggle" class="ui-toggle" data-enabled="false">
          <span class="toggle-text">オフ</span>
        </button>
      </div>

      <div class="ui-section" style="margin-bottom: 15px;">
        <label class="ui-label">仮想カメラ (Direct)</label>
        <button id="vcam-toggle" class="ui-toggle" data-enabled="false">
          <span class="toggle-text">オフ 📷</span>
        </button>
      </div>


      <div class="ui-section" style="margin-bottom: 15px;">
        <label class="ui-label">音声入力</label>
        <button id="voice-input-btn" class="ui-button" style="width: 100%; padding: 12px; font-size: 16px;">
          🎤 話しかける
        </button>
        <div id="voice-status" style="margin-top: 8px; font-size: 12px; opacity: 0.7; text-align: center;"></div>
      </div>

      <div class="ui-section" style="margin-bottom: 15px;">
        <label class="ui-label">ピッチ: <span id="pitch-value">+3.5</span> 半音</label>
        <input type="range" id="pitch-slider" min="-12" max="12" step="0.5" value="3.5" 
               style="width: 100%;" class="ui-slider">
      </div>

      <div class="ui-section" style="margin-bottom: 15px;">
        <label class="ui-label">照明プリセット</label>
        <select id="lighting-preset" class="ui-select" style="width: 100%;">
          <option value="snowy">雪曇り（デフォルト）</option>
          <option value="indoor">屋内暖色</option>
          <option value="sunset">山の夕景</option>
        </select>
      </div>

      <div class="ui-section" style="margin-bottom: 15px;">
        <label class="ui-label">表情調整</label>
        <div style="display: flex; gap: 10px; margin-top: 10px;">
          <button class="ui-button" data-expression="happy">😊</button>
          <button class="ui-button" data-expression="sad">😢</button>
          <button class="ui-button" data-expression="angry">😠</button>
          <button class="ui-button" data-expression="neutral">😐</button>
        </div>
      </div>

      <div class="ui-footer" style="margin-top: 20px; padding-top: 15px; border-top: 1px solid rgba(247,247,247,0.2); text-align: center;">
        <div style="display: flex; gap: 8px; justify-content: center; margin-bottom: 10px;">
          <button id="docs-obs-btn" class="ui-button" style="font-size: 12px; padding: 6px 10px;">📖 OBSガイド</button>
          <button id="docs-vroid-btn" class="ui-button" style="font-size: 12px; padding: 6px 10px;">🎀 VRoidガイド</button>
        </div>
        <p style="font-size: 10px; opacity: 0.6; margin: 0;">
          💙 白山の自然をモチーフに
        </p>
      </div>
    `;

    this.injectStyles();
  }

  private injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .ui-label {
        display: block;
        font-size: 12px;
        margin-bottom: 8px;
        opacity: 0.9;
        font-weight: 500;
      }

      .ui-toggle {
        width: 100%;
        padding: 10px 16px;
        background: rgba(247, 247, 247, 0.1);
        border: 1px solid rgba(247, 247, 247, 0.2);
        border-radius: 8px;
        color: ${THEME.colors.text};
        cursor: pointer;
        transition: all 0.3s ease;
        font-size: 13px;
      }

      .ui-toggle:hover {
        background: rgba(247, 247, 247, 0.15);
        transform: translateY(-1px);
      }

      .ui-toggle[data-enabled="true"] {
        background: ${THEME.colors.riverCyan};
        border-color: ${THEME.colors.riverCyan};
      }

      .ui-slider {
        -webkit-appearance: none;
        appearance: none;
        height: 6px;
        background: rgba(247, 247, 247, 0.2);
        border-radius: 3px;
        outline: none;
      }

      .ui-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 16px;
        height: 16px;
        background: ${THEME.colors.snowWhite};
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      }

      .ui-slider::-moz-range-thumb {
        width: 16px;
        height: 16px;
        background: ${THEME.colors.snowWhite};
        border-radius: 50%;
        cursor: pointer;
        border: none;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      }

      .ui-select {
        padding: 8px 12px;
        background: rgba(247, 247, 247, 0.1);
        border: 1px solid rgba(247, 247, 247, 0.2);
        border-radius: 6px;
        color: ${THEME.colors.text};
        font-size: 12px;
        cursor: pointer;
      }

      .ui-select option {
        background: ${THEME.colors.rockBlack};
        color: ${THEME.colors.text};
      }

      .ui-button {
        flex: 1;
        padding: 10px;
        background: rgba(247, 247, 247, 0.1);
        border: 1px solid rgba(247, 247, 247, 0.2);
        border-radius: 8px;
        font-size: 20px;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .ui-button:hover {
        background: rgba(247, 247, 247, 0.2);
        transform: scale(1.1);
      }

      .ui-button:active {
        transform: scale(0.95);
      }
    `;
    document.head.appendChild(style);
  }

  private attachEventListeners() {
    // AIトグル
    const aiToggle = document.getElementById('ai-toggle');
    aiToggle?.addEventListener('click', () => {
      this.isAIEnabled = !this.isAIEnabled;
      aiToggle.setAttribute('data-enabled', String(this.isAIEnabled));
      aiToggle.querySelector('.toggle-text')!.textContent =
        this.isAIEnabled ? 'AIモード 🤖' : '手動モード';

      console.log(`AI人格: ${this.isAIEnabled ? 'ON' : 'OFF'}`);
      // TODO: AI サービスとの連携
    });

    // ボイスチェンジャートグル
    const voiceToggle = document.getElementById('voice-toggle');
    voiceToggle?.addEventListener('click', () => {
      this.isVoiceChangerEnabled = !this.isVoiceChangerEnabled;
      voiceToggle.setAttribute('data-enabled', String(this.isVoiceChangerEnabled));
      voiceToggle.querySelector('.toggle-text')!.textContent =
        this.isVoiceChangerEnabled ? 'オン 🎤' : 'オフ';

      this.options.audioProcessor.enableVoiceChanger(this.isVoiceChangerEnabled);
      this.options.audioProcessor.enableVoiceChanger(this.isVoiceChangerEnabled);
    });

    // 仮想カメラトグル
    const vcamToggle = document.getElementById('vcam-toggle');
    vcamToggle?.addEventListener('click', () => {
      if (!this.canvasStreamer) return;

      if (this.canvasStreamer.isActive) {
        this.canvasStreamer.stop();
        vcamToggle.setAttribute('data-enabled', 'false');
        vcamToggle.querySelector('.toggle-text')!.textContent = 'オフ 📷';
      } else {
        this.canvasStreamer.start();
        vcamToggle.setAttribute('data-enabled', 'true');
        vcamToggle.querySelector('.toggle-text')!.textContent = 'オン (配信中) 🔴';
      }
    });

    // 音声入力ボタン

    const voiceInputBtn = document.getElementById('voice-input-btn');
    const voiceStatus = document.getElementById('voice-status');
    let isRecording = false;
    let mediaRecorder: MediaRecorder | null = null;
    let audioChunks: Blob[] = [];

    voiceInputBtn?.addEventListener('click', async () => {
      if (!isRecording) {
        // 録音開始
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaRecorder = new MediaRecorder(stream);
          audioChunks = [];

          mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
          };

          mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            await this.sendVoiceToAI(audioBlob);
            stream.getTracks().forEach(track => track.stop());
          };

          mediaRecorder.start();
          isRecording = true;
          voiceInputBtn.textContent = '⏹️ 停止';
          voiceInputBtn.style.background = 'rgba(255, 100, 100, 0.3)';
          if (voiceStatus) voiceStatus.textContent = '録音中...';
        } catch (err) {
          console.error('マイクアクセスエラー:', err);
          if (voiceStatus) voiceStatus.textContent = 'マイクアクセス失敗';
        }
      } else {
        // 録音停止
        mediaRecorder?.stop();
        isRecording = false;
        voiceInputBtn.textContent = '🎤 話しかける';
        voiceInputBtn.style.background = '';
        if (voiceStatus) voiceStatus.textContent = '処理中...';
      }
    });

    // ピッチスライダー
    const pitchSlider = document.getElementById('pitch-slider') as HTMLInputElement;
    const pitchValue = document.getElementById('pitch-value');
    pitchSlider?.addEventListener('input', (e) => {
      const value = (e.target as HTMLInputElement).value;
      if (pitchValue) {
        pitchValue.textContent = value > '0' ? `+${value}` : value;
      }
      this.options.audioProcessor.setPitchShift(parseFloat(value));
    });

    // 照明プリセット
    const lightingPreset = document.getElementById('lighting-preset') as HTMLSelectElement;
    lightingPreset?.addEventListener('change', (e) => {
      const preset = (e.target as HTMLSelectElement).value as keyof typeof CONFIG.avatar.hdri.presets;
      this.options.avatarSystem.changeHDRI(preset);
      console.log(`照明変更: ${preset}`);
    });

    // 表情ボタン
    document.querySelectorAll('[data-expression]').forEach((button) => {
      button.addEventListener('click', (e) => {
        const expression = (e.target as HTMLElement).getAttribute('data-expression');
        this.applyExpression(expression!);
      });
    });

    // ドキュメントボタン（READMEとは別のMDファイル表示）
    document.getElementById('docs-obs-btn')?.addEventListener('click', () => {
      this.openDocsModal('/docs/OBS_SETUP_GUIDE.md', '📖 OBS Studio セットアップガイド');
    });
    document.getElementById('docs-vroid-btn')?.addEventListener('click', () => {
      this.openDocsModal('/VROID_GUIDE.md', '🎀 VRoidモデルの使い方ガイド');
    });
  }

  /**
   * READMEとは別のMDファイルをモーダルで表示する
   * @param mdPath - Markdownファイルのパス
   * @param title - モーダルのタイトル
   */
  private openDocsModal(mdPath: string, title: string) {
    // 既存モーダルを削除
    this.docsModal?.remove();

    this.docsModal = document.createElement('div');
    this.docsModal.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.7);
      z-index: 2000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const panel = document.createElement('div');
    panel.style.cssText = `
      background: #2E2B2B;
      border-radius: 12px;
      padding: 24px;
      max-width: 700px;
      width: 90vw;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      color: #F7F7F7;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    `;

    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;';

    const titleEl = document.createElement('h2');
    titleEl.style.cssText = 'margin: 0; font-size: 16px; font-weight: 500;';
    titleEl.textContent = title;

    const closeBtn = document.createElement('button');
    closeBtn.id = 'docs-modal-close';
    closeBtn.style.cssText = `
      background: none; border: none; color: #F7F7F7;
      font-size: 20px; cursor: pointer; padding: 4px 8px;
      border-radius: 6px; line-height: 1;
    `;
    closeBtn.textContent = '✕';

    header.appendChild(titleEl);
    header.appendChild(closeBtn);

    const content = document.createElement('div');
    content.style.cssText = `
      overflow-y: auto;
      flex: 1;
      font-size: 13px;
      line-height: 1.7;
      padding-right: 8px;
    `;
    content.innerHTML = '<p style="opacity:0.6;">読み込み中...</p>';

    panel.appendChild(header);
    panel.appendChild(content);
    this.docsModal.appendChild(panel);
    document.body.appendChild(this.docsModal);

    // 閉じるボタン
    closeBtn.addEventListener('click', () => {
      this.docsModal?.remove();
      this.docsModal = null;
    });
    // 背景クリックで閉じる
    this.docsModal.addEventListener('click', (e) => {
      if (e.target === this.docsModal) {
        this.docsModal?.remove();
        this.docsModal = null;
      }
    });

    // Markdownを読み込んで表示
    this.markdownLoader.display(mdPath, content).catch((err) => {
      const errP = document.createElement('p');
      errP.style.color = '#ff6b6b';
      errP.textContent = 'ドキュメントの読み込みに失敗しました。';
      const errDetail = document.createElement('span');
      errDetail.textContent = err instanceof Error ? err.message : String(err);
      errP.appendChild(document.createElement('br'));
      errP.appendChild(errDetail);
      content.innerHTML = '';
      content.appendChild(errP);
    });
  }

  private applyExpression(expression: string) {
    const presets: Record<string, Record<string, number>> = {
      happy: { happy: 1.0, relaxed: 0.3 },
      sad: { sad: 0.8, relaxed: 0.2 },
      angry: { angry: 0.7 },
      neutral: { neutral: 1.0 },
    };

    const values = presets[expression];
    if (values) {
      Object.entries(values).forEach(([name, value]) => {
        this.options.avatarSystem.setExpression(name, value);
      });

      console.log(`表情適用: ${expression}`);

      // 2秒後に表情をリセット
      setTimeout(() => {
        Object.keys(values).forEach((name) => {
          this.options.avatarSystem.setExpression(name, 0);
        });
      }, 2000);
    }
  }

  private async sendVoiceToAI(audioBlob: Blob) {
    const voiceStatus = document.getElementById('voice-status');
    try {
      // 音声をBase64に変換
      const reader = new FileReader();
      const base64Audio = await new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(audioBlob);
      });

      // AIサービスに送信
      if (voiceStatus) voiceStatus.textContent = 'AI処理中...';

      const response = await fetch('http://localhost:5000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio: base64Audio,
          format: 'webm'
        })
      });

      const result = await response.json();

      if (result.response) {
        if (voiceStatus) voiceStatus.textContent = `応答: ${result.response}`;

        // 音声を再生
        if (result.audio) {
          const audioData = atob(result.audio);
          const audioArray = new Uint8Array(audioData.length);
          for (let i = 0; i < audioData.length; i++) {
            audioArray[i] = audioData.charCodeAt(i);
          }
          const audioBlob = new Blob([audioArray], { type: `audio/${result.audio_format || 'mp3'}` });
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          audio.play();

          // 再生終了後にステータスをクリア
          audio.onended = () => {
            if (voiceStatus) voiceStatus.textContent = '';
          };
        }
      } else {
        if (voiceStatus) voiceStatus.textContent = 'エラー: 応答なし';
      }
    } catch (error) {
      console.error('AI通信エラー:', error);
      if (voiceStatus) voiceStatus.textContent = 'エラー: 通信失敗';
    }
  }

  show() {
    if (this.container) {
      this.container.style.display = 'block';
    }
  }

  hide() {
    if (this.container) {
      this.container.style.display = 'none';
    }
  }
}
