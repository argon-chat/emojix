/**
 * CustomEmojiQueue - Telegram-inspired batched emoji loading
 * 
 * Based on Telegram Web's approach:
 * - Collects emoji load requests over a window
 * - Batches them into single API calls
 * - Notifies subscribers when emojis are loaded
 */

export interface QueuedEmoji {
  id: string;
  documentId: string;
}

export interface LoadedEmoji {
  id: string;
  documentId: string;
  url: string;
  isVideo?: boolean;
  width?: number;
  height?: number;
}

export type LoaderFunction = (documentIds: string[]) => Promise<LoadedEmoji[]>;
export type LoadCallback = (loaded: LoadedEmoji[]) => void;

export interface CustomEmojiQueueOptions {
  /** Batch window in ms (default: 200) */
  batchDelay?: number;
  /** Max emojis per batch (default: 100) */
  maxBatchSize?: number;
  /** Retry failed loads (default: true) */
  retryFailed?: boolean;
  /** Max retries (default: 2) */
  maxRetries?: number;
}

const DEFAULT_OPTIONS: Required<CustomEmojiQueueOptions> = {
  batchDelay: 200,
  maxBatchSize: 100,
  retryFailed: true,
  maxRetries: 2,
};

interface PendingRequest {
  documentId: string;
  callbacks: Set<LoadCallback>;
  retryCount: number;
}

export class CustomEmojiQueue {
  private options: Required<CustomEmojiQueueOptions>;
  private loader: LoaderFunction;
  
  // Pending requests waiting to be batched
  private pending: Map<string, PendingRequest> = new Map();
  
  // Already loaded emojis (cache)
  private loaded: Map<string, LoadedEmoji> = new Map();
  
  // Failed loads (for retry logic)
  private failed: Set<string> = new Set();
  
  // Batch timer
  private batchTimer: ReturnType<typeof setTimeout> | null = null;
  
  // Is currently loading
  private isLoading = false;

  constructor(loader: LoaderFunction, options: CustomEmojiQueueOptions = {}) {
    this.loader = loader;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Request an emoji to be loaded
   * Returns immediately if already cached
   */
  request(documentId: string, callback?: LoadCallback): LoadedEmoji | null {
    // Already loaded - return immediately
    const cached = this.loaded.get(documentId);
    if (cached) {
      callback?.([cached]);
      return cached;
    }

    // Gave up on it already (retries exhausted): every render used to re-admit it with a fresh
    // retry budget, a steady drip of loader requests for an emoji that no longer exists.
    if (this.failed.has(documentId)) return null;

    // Check if already pending
    const existing = this.pending.get(documentId);
    if (existing) {
      if (callback) {
        existing.callbacks.add(callback);
      }
      return null;
    }

    // Add to pending
    this.pending.set(documentId, {
      documentId,
      callbacks: callback ? new Set([callback]) : new Set(),
      retryCount: 0,
    });

    // Schedule batch
    this.scheduleBatch();

    return null;
  }

  /**
   * Request multiple emojis at once
   */
  requestMany(documentIds: string[], callback?: LoadCallback): LoadedEmoji[] {
    const immediateResults: LoadedEmoji[] = [];
    const toLoad: string[] = [];

    for (const id of documentIds) {
      const cached = this.loaded.get(id);
      if (cached) {
        immediateResults.push(cached);
      } else {
        toLoad.push(id);
      }
    }

    // Add callback for remaining
    if (toLoad.length > 0 && callback) {
      for (const id of toLoad) {
        this.request(id, callback);
      }
    }

    return immediateResults;
  }

  /**
   * Check if emoji is already loaded
   */
  isLoaded(documentId: string): boolean {
    return this.loaded.has(documentId);
  }

  /**
   * Get loaded emoji if cached
   */
  get(documentId: string): LoadedEmoji | undefined {
    return this.loaded.get(documentId);
  }

  /**
   * Get all loaded emojis
   */
  getAll(): LoadedEmoji[] {
    return Array.from(this.loaded.values());
  }

  /**
   * Clear cache and pending requests
   */
  clear(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    this.pending.clear();
    this.loaded.clear();
    this.failed.clear();
  }

  /**
   * Preload emojis without callbacks
   */
  preload(documentIds: string[]): void {
    for (const id of documentIds) {
      if (!this.loaded.has(id) && !this.pending.has(id)) {
        this.request(id);
      }
    }
  }

  private scheduleBatch(): void {
    if (this.batchTimer) return;

    this.batchTimer = setTimeout(() => {
      this.batchTimer = null;
      this.processBatch();
    }, this.options.batchDelay);
  }

  private async processBatch(): Promise<void> {
    // If already loading, schedule for later
    if (this.isLoading) {
      return;
    }

    // Get pending document IDs (up to max batch size)
    const pendingIds = Array.from(this.pending.keys()).slice(0, this.options.maxBatchSize);
    
    if (pendingIds.length === 0) return;

    this.isLoading = true;

    try {
      // Call the loader
      const results = await this.loader(pendingIds);
      
      // Process results
      const loadedIds = new Set<string>();
      
      for (const emoji of results) {
        this.loaded.set(emoji.documentId, emoji);
        loadedIds.add(emoji.documentId);
        
        // Notify callbacks
        const pendingReq = this.pending.get(emoji.documentId);
        if (pendingReq) {
          for (const cb of pendingReq.callbacks) {
            try {
              cb([emoji]);
            } catch (e) {
              console.error('[CustomEmojiQueue] Callback error:', e);
            }
          }
          this.pending.delete(emoji.documentId);
        }
      }

      // Handle failed loads
      for (const id of pendingIds) {
        if (!loadedIds.has(id)) {
          const req = this.pending.get(id);
          if (req) {
            if (this.options.retryFailed && req.retryCount < this.options.maxRetries) {
              req.retryCount++;
              // Will be retried in next batch
            } else {
              this.failed.add(id);
              this.pending.delete(id);
            }
          }
        }
      }
    } catch (error) {
      console.error('[CustomEmojiQueue] Batch load error:', error);
      
      // Mark all as failed for retry
      for (const id of pendingIds) {
        const req = this.pending.get(id);
        if (req) {
          if (this.options.retryFailed && req.retryCount < this.options.maxRetries) {
            req.retryCount++;
          } else {
            this.failed.add(id);
            this.pending.delete(id);
          }
        }
      }
    } finally {
      this.isLoading = false;
      
      // If there are more pending, schedule another batch
      if (this.pending.size > 0) {
        this.scheduleBatch();
      }
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    pending: number;
    loaded: number;
    failed: number;
    isLoading: boolean;
  } {
    return {
      pending: this.pending.size,
      loaded: this.loaded.size,
      failed: this.failed.size,
      isLoading: this.isLoading,
    };
  }
}

// Singleton instance for app-wide use
let defaultQueue: CustomEmojiQueue | null = null;

/**
 * Initialize the default emoji queue
 */
export function initCustomEmojiQueue(
  loader: LoaderFunction,
  options?: CustomEmojiQueueOptions
): CustomEmojiQueue {
  defaultQueue = new CustomEmojiQueue(loader, options);
  return defaultQueue;
}

/**
 * Get the default emoji queue
 */
export function getCustomEmojiQueue(): CustomEmojiQueue | null {
  return defaultQueue;
}

/**
 * Request emoji from default queue
 */
export function requestCustomEmoji(
  documentId: string,
  callback?: LoadCallback
): LoadedEmoji | null {
  if (!defaultQueue) {
    console.warn('[CustomEmojiQueue] Queue not initialized');
    return null;
  }
  return defaultQueue.request(documentId, callback);
}
