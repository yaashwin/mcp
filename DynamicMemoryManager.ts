import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger';

export interface MemoryEntry {
  id: string;
  sessionId: string;
  repository: {
    owner: string;
    repo: string;
    branch?: string;
  };
  type: 'repository_analysis' | 'infrastructure_generation' | 'security_scan' | 'deployment_validation';
  data: any;
  timestamp: number;
  tags: string[];
  metadata: {
    confidence: number;
    tokens: number;
    processingTime: number;
    version: string;
  };
  embeddings?: number[];
  relationships: string[];
}

export interface MemoryContext {
  insights: any[];
  patterns: any[];
  similarities: any[];
  recommendations: any[];
  vulnerabilities?: any[];
  threatPatterns?: any[];
  optimizations?: any[];
  trends?: any[];
  utilizationStats: {
    totalEntries: number;
    relevantEntries: number;
    confidenceScore: number;
    memoryUsage: number;
  };
  computePatterns?: any[];
  networkingPatterns?: any[];
  storagePatterns?: any[];
  securityPatterns?: any[];
  costOptimizations?: any[];
  similarProjects?: number;
}

export interface MemoryQuery {
  type: string;
  timeframe?: string;
  similarity_threshold?: number;
  includePatterns?: boolean;
  includeBestPractices?: boolean;
  includeVulnerabilities?: boolean;
  includeThreatPatterns?: boolean;
  includeDeploymentPatterns?: boolean;
  tags?: string[];
  limit?: number;
}

export class DynamicMemoryManager extends EventEmitter {
  private static instance: DynamicMemoryManager;
  private logger: Logger;
  private memoryStore: Map<string, MemoryEntry>;
  private indexedEntries: Map<string, Set<string>>;
  private similarityCache: Map<string, any[]>;
  private maxMemorySize: number;
  private compressionThreshold: number;
  private retentionPeriod: number;

  private constructor() {
    super();
    this.logger = Logger.getInstance();
    this.memoryStore = new Map();
    this.indexedEntries = new Map();
    this.similarityCache = new Map();
    this.maxMemorySize = 10000; // Max entries
    this.compressionThreshold = 8000; // When to start compression
    this.retentionPeriod = 90 * 24 * 60 * 60 * 1000; // 90 days
    
    this.initializeMemoryManagement();
  }

  public static getInstance(): DynamicMemoryManager {
    if (!DynamicMemoryManager.instance) {
      DynamicMemoryManager.instance = new DynamicMemoryManager();
    }
    return DynamicMemoryManager.instance;
  }

  private initializeMemoryManagement(): void {
    // Periodic cleanup
    setInterval(() => {
      this.performMemoryCleanup();
    }, 60 * 60 * 1000); // Every hour

    // Compression when needed
    setInterval(() => {
      if (this.memoryStore.size > this.compressionThreshold) {
        this.compressMemory();
      }
    }, 30 * 60 * 1000); // Every 30 minutes

    this.logger.info('DynamicMemoryManager initialized');
  }

  public async storeAnalysisResult(data: {
    sessionId: string;
    repository: any;
    analysis: any;
    recommendations: any;
    timestamp: number;
    context: any;
  }): Promise<void> {
    const entry: MemoryEntry = {
      id: `analysis_${data.sessionId}_${data.timestamp}`,
      sessionId: data.sessionId,
      repository: data.repository,
      type: 'repository_analysis',
      data: {
        analysis: data.analysis,
        recommendations: data.recommendations,
        context: data.context
      },
      timestamp: data.timestamp,
      tags: this.extractTags(data.analysis, data.repository),
      metadata: {
        confidence: this.calculateConfidence(data.analysis),
        tokens: data.context.totalTokens || 0,
        processingTime: Date.now() - data.timestamp,
        version: '1.0'
      },
      embeddings: await this.generateEmbeddings(data.analysis),
      relationships: this.findRelationships(data.analysis)
    };

    this.storeEntry(entry);
    this.updateIndices(entry);
    this.emit('analysis_stored', entry);
  }

  public async storeInfrastructureGeneration(data: {
    sessionId: string;
    repository: any;
    infraCode: any;
    context: any;
    timestamp: number;
  }): Promise<void> {
    const entry: MemoryEntry = {
      id: `infra_${data.sessionId}_${data.timestamp}`,
      sessionId: data.sessionId,
      repository: data.repository,
      type: 'infrastructure_generation',
      data: {
        infraCode: data.infraCode,
        context: data.context
      },
      timestamp: data.timestamp,
      tags: this.extractInfraTags(data.infraCode, data.repository),
      metadata: {
        confidence: this.calculateInfraConfidence(data.infraCode),
        tokens: data.infraCode.metadata?.tokensUsed || 0,
        processingTime: Date.now() - data.timestamp,
        version: '1.0'
      },
      embeddings: await this.generateEmbeddings(data.infraCode),
      relationships: this.findInfraRelationships(data.infraCode)
    };

    this.storeEntry(entry);
    this.updateIndices(entry);
    this.emit('infrastructure_stored', entry);
  }

  public async storeSecurityFindings(data: {
    sessionId: string;
    repository: any;
    findings: any;
    timestamp: number;
  }): Promise<void> {
    const entry: MemoryEntry = {
      id: `security_${data.sessionId}_${data.timestamp}`,
      sessionId: data.sessionId,
      repository: data.repository,
      type: 'security_scan',
      data: {
        findings: data.findings
      },
      timestamp: data.timestamp,
      tags: this.extractSecurityTags(data.findings, data.repository),
      metadata: {
        confidence: this.calculateSecurityConfidence(data.findings),
        tokens: 0,
        processingTime: Date.now() - data.timestamp,
        version: '1.0'
      },
      embeddings: await this.generateEmbeddings(data.findings),
      relationships: this.findSecurityRelationships(data.findings)
    };

    this.storeEntry(entry);
    this.updateIndices(entry);
    this.emit('security_stored', entry);
  }

  public async getRelevantMemory(repository: any, query: MemoryQuery): Promise<MemoryContext> {
    const startTime = Date.now();
    
    // Get entries matching the query
    const relevantEntries = await this.queryMemory(repository, query);
    
    // Build context from relevant entries
    const context: MemoryContext = {
      insights: this.extractInsights(relevantEntries),
      patterns: this.extractPatterns(relevantEntries),
      similarities: this.findSimilarities(relevantEntries),
      recommendations: this.generateRecommendations(relevantEntries),
      utilizationStats: {
        totalEntries: this.memoryStore.size,
        relevantEntries: relevantEntries.length,
        confidenceScore: this.calculateContextConfidence(relevantEntries),
        memoryUsage: Date.now() - startTime
      }
    };

    // Add type-specific context
    if (query.type === 'security_scan') {
      context.vulnerabilities = this.extractVulnerabilities(relevantEntries);
      context.threatPatterns = this.extractThreatPatterns(relevantEntries);
    }

    if (query.type === 'infrastructure_generation') {
      context.computePatterns = this.extractComputePatterns(relevantEntries);
      context.networkingPatterns = this.extractNetworkingPatterns(relevantEntries);
      context.storagePatterns = this.extractStoragePatterns(relevantEntries);
      context.securityPatterns = this.extractSecurityPatterns(relevantEntries);
      context.costOptimizations = this.extractCostOptimizations(relevantEntries);
    }

    if (query.type === 'deployment_validation') {
      context.optimizations = this.extractOptimizations(relevantEntries);
    }

    // Add similarity metrics
    context.similarProjects = this.countSimilarProjects(repository, relevantEntries);
    context.trends = this.analyzeTrends(relevantEntries);

    this.logger.info('Memory context retrieved', {
      type: query.type,
      relevantEntries: relevantEntries.length,
      processingTime: Date.now() - startTime
    });

    return context;
  }

  public async getLongTermMemory(repository: any): Promise<any> {
    const entries = Array.from(this.memoryStore.values())
      .filter(entry => this.isRepositoryMatch(entry.repository, repository))
      .sort((a, b) => b.timestamp - a.timestamp);

    return {
      totalAnalyses: entries.length,
      recentAnalyses: entries.slice(0, 10),
      patterns: this.extractLongTermPatterns(entries),
      evolution: this.analyzeEvolution(entries),
      bestPractices: this.extractBestPractices(entries)
    };
  }

  private async queryMemory(repository: any, query: MemoryQuery): Promise<MemoryEntry[]> {
    let entries = Array.from(this.memoryStore.values());

    // Filter by type
    if (query.type) {
      entries = entries.filter(entry => entry.type === query.type);
    }

    // Filter by timeframe
    if (query.timeframe) {
      const timeLimit = this.parseTimeframe(query.timeframe);
      entries = entries.filter(entry => entry.timestamp > timeLimit);
    }

    // Filter by tags
    if (query.tags && query.tags.length > 0) {
      entries = entries.filter(entry => 
        query.tags!.some(tag => entry.tags.includes(tag))
      );
    }

    // Filter by similarity
    if (query.similarity_threshold) {
      entries = entries.filter(entry => 
        this.calculateSimilarity(entry.repository, repository) >= query.similarity_threshold!
      );
    }

    // Sort by relevance
    entries.sort((a, b) => {
      const aRelevance = this.calculateRelevance(a, repository, query);
      const bRelevance = this.calculateRelevance(b, repository, query);
      return bRelevance - aRelevance;
    });

    // Limit results
    if (query.limit) {
      entries = entries.slice(0, query.limit);
    }

    return entries;
  }

  private storeEntry(entry: MemoryEntry): void {
    this.memoryStore.set(entry.id, entry);
    
    // Check if we need to cleanup old entries
    if (this.memoryStore.size > this.maxMemorySize) {
      this.performMemoryCleanup();
    }
  }

  private updateIndices(entry: MemoryEntry): void {
    // Update type index
    const typeKey = `type:${entry.type}`;
    if (!this.indexedEntries.has(typeKey)) {
      this.indexedEntries.set(typeKey, new Set());
    }
    this.indexedEntries.get(typeKey)!.add(entry.id);

    // Update tag indices
    entry.tags.forEach(tag => {
      const tagKey = `tag:${tag}`;
      if (!this.indexedEntries.has(tagKey)) {
        this.indexedEntries.set(tagKey, new Set());
      }
      this.indexedEntries.get(tagKey)!.add(entry.id);
    });

    // Update repository index
    const repoKey = `repo:${entry.repository.owner}/${entry.repository.repo}`;
    if (!this.indexedEntries.has(repoKey)) {
      this.indexedEntries.set(repoKey, new Set());
    }
    this.indexedEntries.get(repoKey)!.add(entry.id);
  }

  private performMemoryCleanup(): void {
    const now = Date.now();
    const cutoff = now - this.retentionPeriod;
    
    const entriesToDelete = Array.from(this.memoryStore.entries())
      .filter(([_, entry]) => entry.timestamp < cutoff)
      .map(([id, _]) => id);

    entriesToDelete.forEach(id => {
      this.memoryStore.delete(id);
    });

    this.logger.info('Memory cleanup completed', {
      deletedEntries: entriesToDelete.length,
      remainingEntries: this.memoryStore.size
    });
  }

  private compressMemory(): void {
    const entries = Array.from(this.memoryStore.values())
      .sort((a, b) => b.timestamp - a.timestamp);

    const keepCount = Math.floor(this.maxMemorySize * 0.8);
    const toDelete = entries.slice(keepCount);

    toDelete.forEach(entry => {
      this.memoryStore.delete(entry.id);
    });

    this.logger.info('Memory compression completed', {
      compressedEntries: toDelete.length,
      remainingEntries: this.memoryStore.size
    });
  }

  // Helper methods for extracting various types of information
  private extractTags(analysis: any, repository: any): string[] {
    const tags = [];
    
    if (analysis.techStack?.languages) {
      tags.push(...analysis.techStack.languages.map((lang: string) => `lang:${lang}`));
    }
    
    if (analysis.techStack?.frameworks) {
      tags.push(...analysis.techStack.frameworks.map((fw: string) => `framework:${fw}`));
    }
    
    if (repository.topics) {
      tags.push(...repository.topics.map((topic: string) => `topic:${topic}`));
    }
    
    return tags;
  }

  private extractInfraTags(infraCode: any, repository: any): string[] {
    const tags = [];
    
    if (infraCode.provider) {
      tags.push(`provider:${infraCode.provider}`);
    }
    
    if (infraCode.services) {
      tags.push(...infraCode.services.map((service: string) => `service:${service}`));
    }
    
    return tags;
  }

  private extractSecurityTags(findings: any, repository: any): string[] {
    const tags = ['security'];
    
    if (findings.findings) {
      findings.findings.forEach((finding: any) => {
        if (finding.severity) {
          tags.push(`severity:${finding.severity}`);
        }
        if (finding.category) {
          tags.push(`category:${finding.category}`);
        }
      });
    }
    
    return tags;
  }

  private async generateEmbeddings(data: any): Promise<number[]> {
    // Simplified embedding generation - in production, use a proper embedding model
    const text = JSON.stringify(data);
    const hash = this.simpleHash(text);
    return Array.from({ length: 128 }, (_, i) => (hash + i) % 1000 / 1000);
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private findRelationships(analysis: any): string[] {
    const relationships = [];
    
    if (analysis.dependencies) {
      relationships.push(...analysis.dependencies.map((dep: string) => `depends:${dep}`));
    }
    
    return relationships;
  }

  private findInfraRelationships(infraCode: any): string[] {
    const relationships = [];
    
    if (infraCode.dependencies) {
      relationships.push(...infraCode.dependencies.map((dep: string) => `infra_depends:${dep}`));
    }
    
    return relationships;
  }

  private findSecurityRelationships(findings: any): string[] {
    const relationships = [];
    
    if (findings.relatedVulnerabilities) {
      relationships.push(...findings.relatedVulnerabilities.map((vuln: string) => `related_vuln:${vuln}`));
    }
    
    return relationships;
  }

  private calculateConfidence(analysis: any): number {
    let confidence = 0;
    
    if (analysis.techStack?.languages?.length > 0) confidence += 25;
    if (analysis.documentation?.readme) confidence += 25;
    if (analysis.dependencies?.length > 0) confidence += 25;
    if (analysis.tests?.coverage > 0) confidence += 25;
    
    return Math.min(confidence, 100);
  }

  private calculateInfraConfidence(infraCode: any): number {
    let confidence = 0;
    
    if (infraCode.provider) confidence += 30;
    if (infraCode.services?.length > 0) confidence += 30;
    if (infraCode.configurations?.length > 0) confidence += 40;
    
    return Math.min(confidence, 100);
  }

  private calculateSecurityConfidence(findings: any): number {
    let confidence = 50; // Base confidence for security scans
    
    if (findings.findings?.length > 0) confidence += 30;
    if (findings.recommendations?.length > 0) confidence += 20;
    
    return Math.min(confidence, 100);
  }

  private extractInsights(entries: MemoryEntry[]): any[] {
    return entries.map(entry => ({
      type: entry.type,
      insight: this.generateInsight(entry),
      confidence: entry.metadata.confidence,
      timestamp: entry.timestamp
    }));
  }

  private extractPatterns(entries: MemoryEntry[]): any[] {
    const patterns = new Map();
    
    entries.forEach(entry => {
      entry.tags.forEach(tag => {
        if (!patterns.has(tag)) {
          patterns.set(tag, { tag, count: 0, entries: [] });
        }
        patterns.get(tag).count++;
        patterns.get(tag).entries.push(entry.id);
      });
    });
    
    return Array.from(patterns.values())
      .filter(pattern => pattern.count > 1)
      .sort((a, b) => b.count - a.count);
  }

  private findSimilarities(entries: MemoryEntry[]): any[] {
    const similarities = [];
    
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const similarity = this.calculateEntrySimilarity(entries[i], entries[j]);
        if (similarity > 0.7) {
          similarities.push({
            entry1: entries[i].id,
            entry2: entries[j].id,
            similarity,
            commonTags: this.findCommonTags(entries[i], entries[j])
          });
        }
      }
    }
    
    return similarities.sort((a, b) => b.similarity - a.similarity);
  }

  private generateRecommendations(entries: MemoryEntry[]): any[] {
    const recommendations = [];
    
    // Pattern-based recommendations
    const patterns = this.extractPatterns(entries);
    patterns.forEach(pattern => {
      if (pattern.count >= 3) {
        recommendations.push({
          type: 'pattern_based',
          pattern: pattern.tag,
          recommendation: `Consider standardizing on ${pattern.tag} based on ${pattern.count} similar projects`,
          confidence: Math.min(pattern.count * 20, 100)
        });
      }
    });
    
    return recommendations;
  }

  private extractVulnerabilities(entries: MemoryEntry[]): any[] {
    return entries
      .filter(entry => entry.type === 'security_scan')
      .flatMap(entry => entry.data.findings?.findings || []);
  }

  private extractThreatPatterns(entries: MemoryEntry[]): any[] {
    const threats = new Map();
    
    entries
      .filter(entry => entry.type === 'security_scan')
      .forEach(entry => {
        entry.data.findings?.findings?.forEach((finding: any) => {
          if (finding.category) {
            if (!threats.has(finding.category)) {
              threats.set(finding.category, { category: finding.category, count: 0, severity: [] });
            }
            threats.get(finding.category).count++;
            threats.get(finding.category).severity.push(finding.severity);
          }
        });
      });
    
    return Array.from(threats.values());
  }

  private extractComputePatterns(entries: MemoryEntry[]): any[] {
    return entries
      .filter(entry => entry.type === 'infrastructure_generation')
      .flatMap(entry => entry.data.infraCode?.compute || []);
  }

  private extractNetworkingPatterns(entries: MemoryEntry[]): any[] {
    return entries
      .filter(entry => entry.type === 'infrastructure_generation')
      .flatMap(entry => entry.data.infraCode?.networking || []);
  }

  private extractStoragePatterns(entries: MemoryEntry[]): any[] {
    return entries
      .filter(entry => entry.type === 'infrastructure_generation')
      .flatMap(entry => entry.data.infraCode?.storage || []);
  }

  private extractSecurityPatterns(entries: MemoryEntry[]): any[] {
    return entries
      .filter(entry => entry.type === 'infrastructure_generation')
      .flatMap(entry => entry.data.infraCode?.security || []);
  }

  private extractCostOptimizations(entries: MemoryEntry[]): any[] {
    return entries
      .filter(entry => entry.type === 'infrastructure_generation')
      .flatMap(entry => entry.data.infraCode?.costOptimizations || []);
  }

  private extractOptimizations(entries: MemoryEntry[]): any[] {
    return entries
      .filter(entry => entry.type === 'deployment_validation')
      .flatMap(entry => entry.data.optimizations || []);
  }

  private parseTimeframe(timeframe: string): number {
    const now = Date.now();
    const multipliers: { [key: string]: number } = {
      'd': 24 * 60 * 60 * 1000,
      'h': 60 * 60 * 1000,
      'm': 60 * 1000
    };
    
    const match = timeframe.match(/^(\d+)([dhm])$/);
    if (match) {
      const [, amount, unit] = match;
      return now - (parseInt(amount) * multipliers[unit]);
    }
    
    return now - (7 * 24 * 60 * 60 * 1000); // Default to 7 days
  }

  private calculateSimilarity(repo1: any, repo2: any): number {
    if (repo1.owner === repo2.owner && repo1.repo === repo2.repo) {
      return 1.0;
    }
    
    // Simple similarity based on owner
    if (repo1.owner === repo2.owner) {
      return 0.3;
    }
    
    return 0.1;
  }

  private calculateRelevance(entry: MemoryEntry, repository: any, query: MemoryQuery): number {
    let relevance = 0;
    
    // Repository similarity
    relevance += this.calculateSimilarity(entry.repository, repository) * 40;
    
    // Type match
    if (entry.type === query.type) {
      relevance += 30;
    }
    
    // Tag matches
    if (query.tags) {
      const matchingTags = entry.tags.filter(tag => query.tags!.includes(tag));
      relevance += (matchingTags.length / query.tags.length) * 20;
    }
    
    // Recency
    const age = Date.now() - entry.timestamp;
    const maxAge = 90 * 24 * 60 * 60 * 1000; // 90 days
    relevance += Math.max(0, (1 - age / maxAge) * 10);
    
    return relevance;
  }

  private calculateContextConfidence(entries: MemoryEntry[]): number {
    if (entries.length === 0) return 0;
    
    const avgConfidence = entries.reduce((sum, entry) => sum + entry.metadata.confidence, 0) / entries.length;
    const recencyBonus = entries.filter(entry => 
      Date.now() - entry.timestamp < 7 * 24 * 60 * 60 * 1000
    ).length * 5;
    
    return Math.min(avgConfidence + recencyBonus, 100);
  }

  private isRepositoryMatch(repo1: any, repo2: any): boolean {
    return repo1.owner === repo2.owner && repo1.repo === repo2.repo;
  }

  private extractLongTermPatterns(entries: MemoryEntry[]): any[] {
    // Analyze patterns over time
    const patterns = new Map();
    
    entries.forEach(entry => {
      const month = new Date(entry.timestamp).toISOString().substr(0, 7);
      entry.tags.forEach(tag => {
        const key = `${tag}:${month}`;
        if (!patterns.has(key)) {
          patterns.set(key, { tag, month, count: 0 });
        }
        patterns.get(key).count++;
      });
    });
    
    return Array.from(patterns.values());
  }

  private analyzeEvolution(entries: MemoryEntry[]): any {
    if (entries.length < 2) return null;
    
    const sortedEntries = entries.sort((a, b) => a.timestamp - b.timestamp);
    const first = sortedEntries[0];
    const last = sortedEntries[sortedEntries.length - 1];
    
    return {
      timespan: last.timestamp - first.timestamp,
      totalAnalyses: entries.length,
      avgConfidenceChange: last.metadata.confidence - first.metadata.confidence,
      trendingTags: this.findTrendingTags(entries)
    };
  }

  private extractBestPractices(entries: MemoryEntry[]): any[] {
    const highConfidenceEntries = entries.filter(entry => entry.metadata.confidence > 80);
    
    return highConfidenceEntries.map(entry => ({
      practice: this.extractPractice(entry),
      confidence: entry.metadata.confidence,
      type: entry.type,
      timestamp: entry.timestamp
    }));
  }

  private countSimilarProjects(repository: any, entries: MemoryEntry[]): number {
    return entries.filter(entry => 
      entry.repository.owner !== repository.owner || entry.repository.repo !== repository.repo
    ).length;
  }

  private analyzeTrends(entries: MemoryEntry[]): any[] {
    const trends = new Map();
    
    entries.forEach(entry => {
      const week = Math.floor(entry.timestamp / (7 * 24 * 60 * 60 * 1000));
      entry.tags.forEach(tag => {
        const key = `${tag}:${week}`;
        if (!trends.has(key)) {
          trends.set(key, { tag, week, count: 0 });
        }
        trends.get(key).count++;
      });
    });
    
    return Array.from(trends.values());
  }

  private calculateEntrySimilarity(entry1: MemoryEntry, entry2: MemoryEntry): number {
    const commonTags = this.findCommonTags(entry1, entry2);
    const totalTags = new Set([...entry1.tags, ...entry2.tags]).size;
    
    return commonTags.length / totalTags;
  }

  private findCommonTags(entry1: MemoryEntry, entry2: MemoryEntry): string[] {
    return entry1.tags.filter(tag => entry2.tags.includes(tag));
  }

  private generateInsight(entry: MemoryEntry): string {
    switch (entry.type) {
      case 'repository_analysis':
        return `Repository analysis shows ${entry.tags.length} key characteristics`;
      case 'infrastructure_generation':
        return `Infrastructure generation used ${entry.data.infraCode?.provider || 'unknown'} provider`;
      case 'security_scan':
        return `Security scan found ${entry.data.findings?.findings?.length || 0} issues`;
      case 'deployment_validation':
        return `Deployment validation completed with ${entry.metadata.confidence}% confidence`;
      default:
        return 'General analysis completed';
    }
  }

  private extractPractice(entry: MemoryEntry): string {
    return `Best practice from ${entry.type} analysis`;
  }

  private findTrendingTags(entries: MemoryEntry[]): string[] {
    const tagCounts = new Map();
    
    entries.forEach(entry => {
      entry.tags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });
    
    return Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, _]) => tag);
  }
}
