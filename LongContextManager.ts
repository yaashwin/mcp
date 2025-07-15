import { EventEmitter } from 'events';

export interface ContextWindow {
  id: string;
  content: string;
  timestamp: number;
  priority: number;
  type: 'conversation' | 'system' | 'memory' | 'tool_result';
  tokens: number;
  metadata: Record<string, any>;
}

export interface ContextSegment {
  id: string;
  windows: ContextWindow[];
  summary: string;
  importance: number;
  lastAccessed: number;
}

export interface CompressionResult {
  compressedContent: string;
  originalTokens: number;
  compressedTokens: number;
  compressionRatio: number;
  lossMetrics: {
    informationLoss: number;
    semanticSimilarity: number;
  };
}

export interface ContextRetrievalOptions {
  maxTokens?: number;
  priorityThreshold?: number;
  timeWindow?: number;
  includeTypes?: string[];
  excludeTypes?: string[];
  semanticQuery?: string;
}

export class LongContextManager extends EventEmitter {
  private contextWindows: Map<string, ContextWindow> = new Map();
  private contextSegments: Map<string, ContextSegment> = new Map();
  private compressionCache: Map<string, CompressionResult> = new Map();
  private maxContextTokens: number;
  private compressionThreshold: number;
  private retentionPeriod: number;
  private isProcessing: boolean = false;

  constructor(options: {
    maxContextTokens?: number;
    compressionThreshold?: number;
    retentionPeriod?: number;
  } = {}) {
    super();
    this.maxContextTokens = options.maxContextTokens || 100000;
    this.compressionThreshold = options.compressionThreshold || 0.8;
    this.retentionPeriod = options.retentionPeriod || 24 * 60 * 60 * 1000; // 24 hours
  }

  async addContext(window: Omit<ContextWindow, 'id' | 'timestamp'>): Promise<string> {
    const id = this.generateId();
    const contextWindow: ContextWindow = {
      id,
      ...window,
      timestamp: Date.now(),
      tokens: this.estimateTokens(window.content)
    };

    this.contextWindows.set(id, contextWindow);
    this.emit('contextAdded', { window: contextWindow });

    // Check if compression is needed
    if (this.getTotalTokens() > this.maxContextTokens * this.compressionThreshold) {
      await this.compressOldContext();
    }

    return id;
  }

  async retrieveContext(options: ContextRetrievalOptions = {}): Promise<ContextWindow[]> {
    const {
      maxTokens = this.maxContextTokens,
      priorityThreshold = 0,
      timeWindow,
      includeTypes,
      excludeTypes,
      semanticQuery
    } = options;

    let windows = Array.from(this.contextWindows.values());

    // Apply filters
    if (timeWindow) {
      const cutoff = Date.now() - timeWindow;
      windows = windows.filter(w => w.timestamp > cutoff);
    }

    if (includeTypes?.length) {
      windows = windows.filter(w => includeTypes.includes(w.type));
    }

    if (excludeTypes?.length) {
      windows = windows.filter(w => !excludeTypes.includes(w.type));
    }

    if (priorityThreshold > 0) {
      windows = windows.filter(w => w.priority >= priorityThreshold);
    }

    // Semantic filtering
    if (semanticQuery) {
      windows = await this.semanticFilter(windows, semanticQuery);
    }

    // Sort by priority and recency
    windows.sort((a, b) => {
      const priorityDiff = b.priority - a.priority;
      if (priorityDiff !== 0) return priorityDiff;
      return b.timestamp - a.timestamp;
    });

    // Limit by token count
    const result: ContextWindow[] = [];
    let tokenCount = 0;

    for (const window of windows) {
      if (tokenCount + window.tokens <= maxTokens) {
        result.push(window);
        tokenCount += window.tokens;
      } else {
        break;
      }
    }

    this.emit('contextRetrieved', { 
      windows: result, 
      totalTokens: tokenCount,
      options 
    });

    return result;
  }

  async compressContext(windowIds: string[]): Promise<CompressionResult> {
    this.isProcessing = true;
    
    try {
      const windows = windowIds
        .map(id => this.contextWindows.get(id))
        .filter(Boolean) as ContextWindow[];

      if (windows.length === 0) {
        throw new Error('No valid windows found for compression');
      }

      const combinedContent = windows.map(w => w.content).join('\n\n');
      const originalTokens = windows.reduce((sum, w) => sum + w.tokens, 0);

      // Simulate compression (in real implementation, use actual compression algorithm)
      const compressedContent = await this.performCompression(combinedContent);
      const compressedTokens = this.estimateTokens(compressedContent);

      const result: CompressionResult = {
        compressedContent,
        originalTokens,
        compressedTokens,
        compressionRatio: compressedTokens / originalTokens,
        lossMetrics: {
          informationLoss: this.calculateInformationLoss(combinedContent, compressedContent),
          semanticSimilarity: this.calculateSemanticSimilarity(combinedContent, compressedContent)
        }
      };

      // Cache compression result
      const cacheKey = windowIds.sort().join('-');
      this.compressionCache.set(cacheKey, result);

      this.emit('contextCompressed', { windowIds, result });
      return result;

    } finally {
      this.isProcessing = false;
    }
  }

  async createSegment(windowIds: string[], summary: string, importance: number = 0.5): Promise<string> {
    const id = this.generateId();
    const windows = windowIds
      .map(id => this.contextWindows.get(id))
      .filter(Boolean) as ContextWindow[];

    const segment: ContextSegment = {
      id,
      windows,
      summary,
      importance,
      lastAccessed: Date.now()
    };

    this.contextSegments.set(id, segment);

    // Remove individual windows from main collection
    windowIds.forEach(windowId => {
      this.contextWindows.delete(windowId);
    });

    this.emit('segmentCreated', { segment });
    return id;
  }

  async expandSegment(segmentId: string): Promise<ContextWindow[]> {
    const segment = this.contextSegments.get(segmentId);
    if (!segment) {
      throw new Error(`Segment ${segmentId} not found`);
    }

    segment.lastAccessed = Date.now();
    this.emit('segmentExpanded', { segment });
    return segment.windows;
  }

  async summarizeContext(windowIds: string[]): Promise<string> {
    const windows = windowIds
      .map(id => this.contextWindows.get(id))
      .filter(Boolean) as ContextWindow[];

    if (windows.length === 0) {
      return '';
    }

    const content = windows.map(w => w.content).join('\n\n');
    
    // Simulate summarization (in real implementation, use AI summarization)
    const summary = await this.performSummarization(content);
    
    this.emit('contextSummarized', { windowIds, summary });
    return summary;
  }

  getContextStatistics(): {
    totalWindows: number;
    totalSegments: number;
    totalTokens: number;
    averageTokensPerWindow: number;
    compressionRatio: number;
    memoryUsage: number;
  } {
    const totalWindows = this.contextWindows.size;
    const totalSegments = this.contextSegments.size;
    const totalTokens = this.getTotalTokens();
    const averageTokensPerWindow = totalWindows > 0 ? totalTokens / totalWindows : 0;
    
    const compressionResults = Array.from(this.compressionCache.values());
    const compressionRatio = compressionResults.length > 0 
      ? compressionResults.reduce((sum, r) => sum + r.compressionRatio, 0) / compressionResults.length
      : 1.0;

    return {
      totalWindows,
      totalSegments,
      totalTokens,
      averageTokensPerWindow,
      compressionRatio,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  async cleanupOldContext(): Promise<void> {
    const cutoff = Date.now() - this.retentionPeriod;
    const toDelete: string[] = [];

    for (const [id, window] of this.contextWindows) {
      if (window.timestamp < cutoff && window.priority < 0.5) {
        toDelete.push(id);
      }
    }

    toDelete.forEach(id => {
      this.contextWindows.delete(id);
    });

    // Clean up old segments
    const segmentsToDelete: string[] = [];
    for (const [id, segment] of this.contextSegments) {
      if (segment.lastAccessed < cutoff && segment.importance < 0.3) {
        segmentsToDelete.push(id);
      }
    }

    segmentsToDelete.forEach(id => {
      this.contextSegments.delete(id);
    });

    this.emit('contextCleaned', { 
      deletedWindows: toDelete.length, 
      deletedSegments: segmentsToDelete.length 
    });
  }

  private async compressOldContext(): Promise<void> {
    if (this.isProcessing) return;

    const windows = Array.from(this.contextWindows.values())
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(0, Math.floor(this.contextWindows.size * 0.3));

    if (windows.length > 0) {
      const windowIds = windows.map(w => w.id);
      const summary = await this.summarizeContext(windowIds);
      await this.createSegment(windowIds, summary, 0.6);
    }
  }

  private async performCompression(content: string): Promise<string> {
    // Simulate compression algorithm
    // In real implementation, use techniques like:
    // - Extractive summarization
    // - Semantic compression
    // - Information-preserving reduction
    
    const sentences = content.split(/[.!?]+/).filter(s => s.trim());
    const importantSentences = sentences.filter((_, i) => i % 2 === 0); // Simple simulation
    
    return importantSentences.join('. ') + '.';
  }

  private async performSummarization(content: string): Promise<string> {
    // Simulate summarization
    // In real implementation, use AI models for summarization
    
    const words = content.split(/\s+/);
    const summary = words.slice(0, Math.min(50, words.length)).join(' ');
    
    return summary + (words.length > 50 ? '...' : '');
  }

  private async semanticFilter(windows: ContextWindow[], query: string): Promise<ContextWindow[]> {
    // Simulate semantic filtering
    // In real implementation, use vector similarity search
    
    const queryWords = query.toLowerCase().split(/\s+/);
    
    return windows.filter(window => {
      const windowWords = window.content.toLowerCase().split(/\s+/);
      const overlap = queryWords.filter(word => windowWords.includes(word)).length;
      return overlap > 0;
    });
  }

  private calculateInformationLoss(original: string, compressed: string): number {
    // Simulate information loss calculation
    return Math.max(0, 1 - (compressed.length / original.length));
  }

  private calculateSemanticSimilarity(original: string, compressed: string): number {
    // Simulate semantic similarity calculation
    const originalWords = new Set(original.toLowerCase().split(/\s+/));
    const compressedWords = new Set(compressed.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...originalWords].filter(word => compressedWords.has(word)));
    const union = new Set([...originalWords, ...compressedWords]);
    
    return intersection.size / union.size;
  }

  private getTotalTokens(): number {
    return Array.from(this.contextWindows.values())
      .reduce((sum, window) => sum + window.tokens, 0);
  }

  private estimateTokens(content: string): number {
    // Simple token estimation (in real implementation, use proper tokenizer)
    return Math.ceil(content.length / 4);
  }

  private estimateMemoryUsage(): number {
    // Estimate memory usage in bytes
    let usage = 0;
    
    for (const window of this.contextWindows.values()) {
      usage += JSON.stringify(window).length * 2; // Rough estimate
    }
    
    for (const segment of this.contextSegments.values()) {
      usage += JSON.stringify(segment).length * 2;
    }
    
    return usage;
  }

  private generateId(): string {
    return `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
