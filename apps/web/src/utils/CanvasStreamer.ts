
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
        // 指定したFPSで画像を送信
        this.intervalId = window.setInterval(() => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

            this.canvas.toBlob((blob) => {
                if (blob && this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(blob);
                }
            }, 'image/jpeg', 0.8); // JPEG品質0.8
        }, 1000 / this.fps);
    }

    public get isActive(): boolean {
        return this.isStreaming;
    }
}
