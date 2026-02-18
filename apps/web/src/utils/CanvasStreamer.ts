
/**
 * CanvasStreamer.ts
 * Canvasの内容を一定間隔でキャプチャし、WebSocketでバックエンドに送信する
 */

export class CanvasStreamer {
    private canvas: HTMLCanvasElement;
    private wsUrl: string;
    private fps: number;
    private ws: WebSocket | null = null;
    private intervalId: number | null = null;
    private isStreaming: boolean = false;

    constructor(canvas: HTMLCanvasElement, wsUrl: string, fps: number = 24) {
        this.canvas = canvas;
        this.wsUrl = wsUrl;
        this.fps = fps;
    }

    /**
     * ストリーミング開始
     */
    start() {
        if (this.isStreaming) return;

        try {
            console.log(`🔌 Connecting to virtual camera stream: ${this.wsUrl}`);
            this.ws = new WebSocket(this.wsUrl);

            this.ws.onopen = () => {
                console.log('✅ Virtual Camera WebSocket Connected');
                this.isStreaming = true;
                this.startCapture();
            };

            this.ws.onclose = () => {
                console.log('❌ Virtual Camera WebSocket Closed');
                this.stop();
            };

            this.ws.onerror = (err) => {
                console.error('⚠️ Virtual Camera WebSocket Error:', err);
                this.stop();
            };

        } catch (error) {
            console.error('Failed to start streaming:', error);
        }
    }

    /**
     * ストリーミング停止
     */
    stop() {
        if (!this.isStreaming) return;

        this.isStreaming = false;

        if (this.intervalId !== null) {
            window.clearInterval(this.intervalId);
            this.intervalId = null;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        console.log('🛑 Virtual Camera Streaming Stopped');
    }

    private startCapture() {
        // オフスクリーンCanvasを作成 (大幅リサイズ: 640x360)
        // メインスレッドでのtoBlobが重いため、解像度を下げて負荷を減らす
        const offScreen = document.createElement('canvas');
        offScreen.width = 640;
        offScreen.height = 360;
        const ctx = offScreen.getContext('2d', { alpha: false, desynchronized: true });

        // 指定したFPSで画像を送信
        this.intervalId = window.setInterval(() => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
            if (!ctx) return;

            // メインCanvasをオフスクリーンに描画
            ctx.drawImage(this.canvas, 0, 0, offScreen.width, offScreen.height);

            // 品質を落として高速化 (0.5)
            offScreen.toBlob((blob) => {
                if (blob && this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(blob);
                }
            }, 'image/jpeg', 0.5);
        }, 1000 / 15); // 15 FPSに制限
    }

    public get isActive(): boolean {
        return this.isStreaming;
    }
}
