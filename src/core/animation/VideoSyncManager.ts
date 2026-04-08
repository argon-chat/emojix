/**
 * VideoSyncManager - Synchronizes playback of identical video emoji
 * 
 * Uses a single master video per URL and renders frames to canvas elements.
 * This ensures perfect sync - all instances show exactly the same frame.
 */

interface CanvasTarget {
  id: string;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
}

interface MasterEntry {
  url: string;
  video: HTMLVideoElement;
  targets: Map<string, CanvasTarget>;
  rafId: number | null;
  isPlaying: boolean;
}

/**
 * Manages synchronized video playback via shared rendering
 */
export class VideoSyncManager {
  private masters: Map<string, MasterEntry> = new Map();
  private container: HTMLDivElement | null = null;
  private idCounter = 0;
  
  /**
   * Get or create hidden container for master videos
   */
  private getContainer(): HTMLDivElement {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;pointer-events:none;';
      this.container.setAttribute('aria-hidden', 'true');
      document.body.appendChild(this.container);
    }
    return this.container;
  }
  
  /**
   * Register a canvas to receive frames from a video URL
   * Returns: { id, canvas } - use the canvas element for display
   */
  register(url: string, width: number, height: number): { id: string; canvas: HTMLCanvasElement } {
    const id = `vsync-${++this.idCounter}`;
    
    // Create canvas for this instance
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
      throw new Error('Failed to get canvas 2d context');
    }
    
    const target: CanvasTarget = { id, canvas, ctx, width, height };
    
    let master = this.masters.get(url);
    
    if (!master) {
      master = this.createMaster(url);
      this.masters.set(url, master);
    }
    
    master.targets.set(id, target);
    
    // Draw first frame if video is ready
    if (master.video.readyState >= 2) {
      this.drawFrame(master, target);
    }
    
    return { id, canvas };
  }
  
  /**
   * Unregister a canvas
   */
  unregister(url: string, id: string): void {
    const master = this.masters.get(url);
    if (!master) return;
    
    master.targets.delete(id);
    
    // Cleanup if no more targets
    if (master.targets.size === 0) {
      this.destroyMaster(url);
    }
  }
  
  /**
   * Create hidden master video
   */
  private createMaster(url: string): MasterEntry {
    const video = document.createElement('video');
    video.src = url;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';
    
    // Add to hidden container
    this.getContainer().appendChild(video);
    
    const master: MasterEntry = {
      url,
      video,
      targets: new Map(),
      rafId: null,
      isPlaying: false,
    };
    
    // Start render loop when video can play
    video.addEventListener('canplay', () => {
      video.play().catch(() => {});
    });
    
    video.addEventListener('play', () => {
      master.isPlaying = true;
      this.startRenderLoop(master);
    });
    
    video.addEventListener('pause', () => {
      master.isPlaying = false;
      this.stopRenderLoop(master);
    });
    
    video.addEventListener('ended', () => {
      // Loop should handle this, but just in case
      video.currentTime = 0;
      video.play().catch(() => {});
    });
    
    // Start loading
    video.load();
    
    return master;
  }
  
  /**
   * Start RAF render loop
   */
  private startRenderLoop(master: MasterEntry): void {
    if (master.rafId !== null) return;
    
    const render = () => {
      if (!master.isPlaying) {
        master.rafId = null;
        return;
      }
      
      // Draw to all targets
      for (const target of master.targets.values()) {
        this.drawFrame(master, target);
      }
      
      master.rafId = requestAnimationFrame(render);
    };
    
    master.rafId = requestAnimationFrame(render);
  }
  
  /**
   * Stop render loop
   */
  private stopRenderLoop(master: MasterEntry): void {
    if (master.rafId !== null) {
      cancelAnimationFrame(master.rafId);
      master.rafId = null;
    }
  }
  
  /**
   * Draw current video frame to canvas
   */
  private drawFrame(master: MasterEntry, target: CanvasTarget): void {
    const { video } = master;
    const { ctx, width, height } = target;
    
    // Clear and draw
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(video, 0, 0, width, height);
  }
  
  /**
   * Cleanup master
   */
  private destroyMaster(url: string): void {
    const master = this.masters.get(url);
    if (!master) return;
    
    this.stopRenderLoop(master);
    
    master.video.pause();
    master.video.src = '';
    master.video.remove();
    
    this.masters.delete(url);
  }
  
  /**
   * Pause/resume a specific URL
   */
  setPaused(url: string, paused: boolean): void {
    const master = this.masters.get(url);
    if (!master) return;
    
    if (paused) {
      master.video.pause();
    } else {
      master.video.play().catch(() => {});
    }
  }
  
  /**
   * Pause all animations
   */
  pauseAll(): void {
    for (const master of this.masters.values()) {
      master.video.pause();
    }
  }
  
  /**
   * Resume all animations
   */
  resumeAll(): void {
    for (const master of this.masters.values()) {
      master.video.play().catch(() => {});
    }
  }
  
  /**
   * Get sync stats
   */
  getStats(): { masters: number; totalTargets: number } {
    let totalTargets = 0;
    for (const master of this.masters.values()) {
      totalTargets += master.targets.size;
    }
    return {
      masters: this.masters.size,
      totalTargets,
    };
  }
  
  /**
   * Clear all
   */
  clear(): void {
    for (const url of [...this.masters.keys()]) {
      this.destroyMaster(url);
    }
    
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}

// Global singleton
export const videoSyncManager = new VideoSyncManager();
