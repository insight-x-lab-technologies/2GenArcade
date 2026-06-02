// Sizes a <canvas> for crisp rendering on high-DPI screens while letting games
// draw in CSS pixels. The context transform absorbs devicePixelRatio so game
// code never multiplies coordinates by DPR.

export class CanvasManager {
  readonly ctx: CanvasRenderingContext2D;
  private cssWidth = 0;
  private cssHeight = 0;
  private dpr = 1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.ctx = ctx;
  }

  /** Resize the backing store to `cssWidth`×`cssHeight` CSS px at the current
   *  devicePixelRatio (capped at 3 to bound fill cost on dense phone screens). */
  resize(cssWidth: number, cssHeight: number, devicePixelRatio = globalThis.devicePixelRatio || 1): void {
    this.cssWidth = cssWidth;
    this.cssHeight = cssHeight;
    this.dpr = Math.min(Math.max(devicePixelRatio, 1), 3);

    this.canvas.width = Math.round(cssWidth * this.dpr);
    this.canvas.height = Math.round(cssHeight * this.dpr);
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  }

  get viewport(): { width: number; height: number } {
    return { width: this.cssWidth, height: this.cssHeight };
  }

  clear(): void {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }
}
