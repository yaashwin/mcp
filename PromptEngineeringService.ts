import { Logger } from '../utils/Logger';

export interface PromptTemplate {
  id: string;
  name: string;
  category: 'analysis' | 'infrastructure' | 'security' | 'validation' | 'optimization';
  template: string;
  variables: string[];
  metadata: {
    version: string;
    effectiveness: number;
    usageCount: number;
    avgResponseQuality: number;
    lastUpdated: number;
  };
}

export interface PromptContext {
  repository: any;
  context: any;
  memoryContext?: any;
  analysisType?: string;
  requirements?: any;
  deploymentOptions?: any;
  longContext?: any;
  memoryInsights?: any[];
  memoryPatterns?: any[];
  knownVulnerabilities?: any[];
  threatPatterns?: any[];
  deploymentData?: any;
}

export interface GeneratedPrompt {
  id: string;
  prompt: string;
  context: PromptContext;
  template: PromptTemplate;
  variables: { [key: string]: any };
  metadata: {
    generatedAt: number;
    estimatedTokens: number;
    complexity: 'low' | 'medium' | 'high';
    expectedResponseType: string;
  };
}

export class PromptEngineeringService {
  private logger: Logger;
  private templates: Map<string, PromptTemplate>;
  private promptHistory: Map<string, GeneratedPrompt[]>;
  private performanceMetrics: Map<string, any>;

  constructor() {
    this.logger = Logger.getInstance();
    this.templates = new Map();
    this.promptHistory = new Map();
    this.performanceMetrics = new Map();
    
    this.initializeTemplates();
  }

  private initializeTemplates(): void {
    // Repository Analysis Templates
    this.addTemplate({
      id: 'repo_analysis_comprehensive',
      name: 'Comprehensive Repository Analysis',
      category: 'analysis',
      template: `
Analyze this repository comprehensively with the following context:

Repository: {{repository.owner}}/{{repository.repo}}
Branch: {{repository.branch}}
Language(s): {{techStack.languages}}
Frameworks: {{techStack.frameworks}}

Memory Context:
{{#if memoryInsights}}
Previous insights: {{memoryInsights}}
{{/if}}

{{#if memoryPatterns}}
Identified patterns: {{memoryPatterns}}
{{/if}}

Long Context:
{{longContext.summary}}

Please provide a detailed analysis focusing on:
1. Architecture patterns and design decisions
2. Code quality and maintainability
3. Technology stack assessment
4. Infrastructure requirements
5. Security considerations
6. Performance optimization opportunities
7. Deployment readiness
8. Best practices compliance

Consider the memory context and previous analyses to provide continuity and build upon existing insights.
`,
      variables: ['repository', 'techStack', 'memoryInsights', 'memoryPatterns', 'longContext'],
      metadata: {
        version: '1.0',
        effectiveness: 85,
        usageCount: 0,
        avgResponseQuality: 0,
        lastUpdated: Date.now()
      }
    });

    this.addTemplate({
      id: 'repo_analysis_focused',
      name: 'Focused Repository Analysis',
      category: 'analysis',
      template: `
Perform a focused analysis of {{repository.owner}}/{{repository.repo}} with emphasis on {{analysisType}}.

Context from memory:
{{#if memoryContext.patterns}}
Relevant patterns: {{memoryContext.patterns}}
{{/if}}

{{#if memoryContext.similarities}}
Similar projects: {{memoryContext.similarities}}
{{/if}}

Analyze specifically:
1. {{analysisType}} characteristics
2. Best practices for {{analysisType}}
3. Common issues and solutions
4. Recommendations based on similar projects

Provide actionable insights and specific recommendations.
`,
      variables: ['repository', 'analysisType', 'memoryContext'],
      metadata: {
        version: '1.0',
        effectiveness: 78,
        usageCount: 0,
        avgResponseQuality: 0,
        lastUpdated: Date.now()
      }
    });

    // Infrastructure Generation Templates
    this.addTemplate({
      id: 'infra_generation_comprehensive',
      name: 'Comprehensive Infrastructure Generation',
      category: 'infrastructure',
      template: `
Generate comprehensive infrastructure code for {{repository.owner}}/{{repository.repo}} based on:

Application Analysis:
- Tech Stack: {{techStack.languages}} with {{techStack.frameworks}}
- Dependencies: {{dependencies}}
- Architecture: {{architecture}}

Requirements:
- Environment: {{requirements.environment}}
- Scale: {{requirements.scale}}
- Performance: {{requirements.performance}}
- Security: {{requirements.security}}

Memory-Based Patterns:
{{#if memoryPatterns}}
{{#each memoryPatterns}}
- {{this.pattern}}: {{this.description}}
{{/each}}
{{/if}}

Previous Similar Projects:
{{#if memoryContext.similarities}}
{{#each memoryContext.similarities}}
- {{this.project}}: {{this.approach}}
{{/each}}
{{/if}}

Generate infrastructure code including:
1. Compute resources (containers, VMs, serverless)
2. Networking (VPC, subnets, load balancers)
3. Storage (databases, file systems, caches)
4. Security (IAM, encryption, firewalls)
5. Monitoring and logging
6. CI/CD pipeline integration
7. Cost optimization strategies

Use best practices from similar projects and learned patterns.
`,
      variables: ['repository', 'techStack', 'dependencies', 'architecture', 'requirements', 'memoryPatterns', 'memoryContext'],
      metadata: {
        version: '1.0',
        effectiveness: 92,
        usageCount: 0,
        avgResponseQuality: 0,
        lastUpdated: Date.now()
      }
    });

    this.addTemplate({
      id: 'infra_generation_cloud_specific',
      name: 'Cloud-Specific Infrastructure Generation',
      category: 'infrastructure',
      template: `
Generate {{cloudProvider}} infrastructure for {{repository.owner}}/{{repository.repo}}.

Application Context:
{{longContext.applicationSummary}}

Cloud Provider: {{cloudProvider}}
Region: {{deploymentOptions.region}}
Environment: {{deploymentOptions.environment}}

Memory-Based Optimizations:
{{#if memoryPatterns}}
Cost optimizations from similar projects:
{{#each memoryPatterns}}
- {{this.optimization}}: {{this.savings}}
{{/each}}
{{/if}}

Generate platform-specific infrastructure:
1. {{cloudProvider}}-native services
2. Auto-scaling configurations
3. Network security groups
4. Database configurations
5. Storage optimization
6. Cost management policies
7. Backup and disaster recovery

Focus on {{cloudProvider}} best practices and cost optimization.
`,
      variables: ['repository', 'cloudProvider', 'deploymentOptions', 'longContext', 'memoryPatterns'],
      metadata: {
        version: '1.0',
        effectiveness: 88,
        usageCount: 0,
        avgResponseQuality: 0,
        lastUpdated: Date.now()
      }
    });

    // Security Analysis Templates
    this.addTemplate({
      id: 'security_comprehensive',
      name: 'Comprehensive Security Analysis',
      category: 'security',
      template: `
Perform comprehensive security analysis for {{repository.owner}}/{{repository.repo}}.

Application Context:
- Languages: {{techStack.languages}}
- Frameworks: {{techStack.frameworks}}
- Dependencies: {{dependencies}}

Known Vulnerabilities from Memory:
{{#if knownVulnerabilities}}
{{#each knownVulnerabilities}}
- {{this.cve}}: {{this.description}} ({{this.severity}})
{{/each}}
{{/if}}

Threat Patterns from Similar Projects:
{{#if threatPatterns}}
{{#each threatPatterns}}
- {{this.category}}: {{this.description}}
{{/each}}
{{/if}}

Historical Security Context:
{{longContext.securityHistory}}

Analyze for:
1. Code vulnerabilities (OWASP Top 10)
2. Dependency security issues
3. Configuration security
4. Infrastructure security
5. Authentication and authorization
6. Data protection
7. Input validation
8. Error handling security
9. Logging and monitoring security
10. Third-party integrations security

Provide:
- Risk assessment with severity levels
- Specific remediation steps
- Security best practices
- Compliance requirements
- Monitoring recommendations

Consider historical vulnerabilities and threat patterns from similar projects.
`,
      variables: ['repository', 'techStack', 'dependencies', 'knownVulnerabilities', 'threatPatterns', 'longContext'],
      metadata: {
        version: '1.0',
        effectiveness: 91,
        usageCount: 0,
        avgResponseQuality: 0,
        lastUpdated: Date.now()
      }
    });

    this.addTemplate({
      id: 'security_focused',
      name: 'Focused Security Analysis',
      category: 'security',
      template: `
Perform focused security analysis for {{securityAspect}} in {{repository.owner}}/{{repository.repo}}.

Focus Area: {{securityAspect}}

Memory Context:
{{#if memoryContext.vulnerabilities}}
Previous vulnerabilities in {{securityAspect}}:
{{#each memoryContext.vulnerabilities}}
- {{this.issue}}: {{this.resolution}}
{{/each}}
{{/if}}

Similar Project Patterns:
{{#if memoryContext.patterns}}
{{#each memoryContext.patterns}}
- {{this.pattern}}: {{this.impact}}
{{/each}}
{{/if}}

Long Context:
{{longContext.securitySummary}}

Analyze specifically:
1. {{securityAspect}} vulnerabilities
2. Best practices for {{securityAspect}}
3. Common attack vectors
4. Mitigation strategies
5. Monitoring and detection

Provide targeted, actionable security recommendations.
`,
      variables: ['repository', 'securityAspect', 'memoryContext', 'longContext'],
      metadata: {
        version: '1.0',
        effectiveness: 84,
        usageCount: 0,
        avgResponseQuality: 0,
        lastUpdated: Date.now()
      }
    });

    // Deployment Validation Templates
    this.addTemplate({
      id: 'deployment_validation_comprehensive',
      name: 'Comprehensive Deployment Validation',
      category: 'validation',
      template: `
Validate deployment configuration for {{repository.owner}}/{{repository.repo}}.

Deployment Configuration:
{{deploymentData.configuration}}

Environment: {{deploymentData.environment}}
Target Platform: {{deploymentData.platform}}

Memory-Based Patterns:
{{#if memoryPatterns}}
Deployment patterns from similar projects:
{{#each memoryPatterns}}
- {{this.pattern}}: {{this.outcome}}
{{/each}}
{{/if}}

Historical Context:
{{longContext.deploymentHistory}}

Validate:
1. Infrastructure configuration
2. Application configuration
3. Environment variables
4. Security settings
5. Network configuration
6. Database settings
7. Monitoring setup
8. Backup configuration
9. Scaling configuration
10. Health checks

Provide:
- Validation results with pass/fail status
- Configuration recommendations
- Best practice compliance
- Performance optimization suggestions
- Security validation
- Cost optimization opportunities

Consider lessons learned from similar deployments.
`,
      variables: ['repository', 'deploymentData', 'memoryPatterns', 'longContext'],
      metadata: {
        version: '1.0',
        effectiveness: 87,
        usageCount: 0,
        avgResponseQuality: 0,
        lastUpdated: Date.now()
      }
    });

    // Optimization Templates
    this.addTemplate({
      id: 'performance_optimization',
      name: 'Performance Optimization Analysis',
      category: 'optimization',
      template: `
Analyze and optimize performance for {{repository.owner}}/{{repository.repo}}.

Current Performance Context:
{{longContext.performanceMetrics}}

Memory-Based Optimizations:
{{#if memoryContext.optimizations}}
Successful optimizations from similar projects:
{{#each memoryContext.optimizations}}
- {{this.optimization}}: {{this.impact}}
{{/each}}
{{/if}}

Application Profile:
- Tech Stack: {{techStack.languages}} with {{techStack.frameworks}}
- Architecture: {{architecture}}
- Scale: {{scale}}

Analyze and optimize:
1. Application performance bottlenecks
2. Database query optimization
3. Caching strategies
4. Load balancing
5. Resource utilization
6. Network optimization
7. Frontend performance
8. API performance
9. Background job optimization
10. Memory management

Provide specific, measurable optimization recommendations with expected impact.
`,
      variables: ['repository', 'longContext', 'memoryContext', 'techStack', 'architecture', 'scale'],
      metadata: {
        version: '1.0',
        effectiveness: 89,
        usageCount: 0,
        avgResponseQuality: 0,
        lastUpdated: Date.now()
      }
    });

    this.logger.info('PromptEngineeringService initialized with templates', {
      templateCount: this.templates.size
    });
  }

  public async generateAnalysisPrompts(context: PromptContext): Promise<GeneratedPrompt[]> {
    const prompts: GeneratedPrompt[] = [];
    
    // Select appropriate templates based on analysis type
    let templateIds: string[] = [];
    
    if (context.analysisType === 'repository') {
      templateIds = context.memoryContext?.insights?.length > 0 ? 
        ['repo_analysis_comprehensive'] : 
        ['repo_analysis_focused'];
    } else if (context.analysisType) {
      templateIds = ['repo_analysis_focused'];
    } else {
      templateIds = ['repo_analysis_comprehensive'];
    }
    
    for (const templateId of templateIds) {
      const template = this.templates.get(templateId);
      if (template) {
        const prompt = await this.generatePrompt(template, context);
        prompts.push(prompt);
      }
    }
    
    return prompts;
  }

  public async generateInfrastructurePrompts(context: PromptContext): Promise<GeneratedPrompt[]> {
    const prompts: GeneratedPrompt[] = [];
    
    // Determine if cloud-specific or comprehensive
    const isCloudSpecific = context.deploymentOptions?.cloudProvider;
    const templateId = isCloudSpecific ? 'infra_generation_cloud_specific' : 'infra_generation_comprehensive';
    
    const template = this.templates.get(templateId);
    if (template) {
      const prompt = await this.generatePrompt(template, context);
      prompts.push(prompt);
    }
    
    return prompts;
  }

  public async generateSecurityPrompts(context: PromptContext): Promise<GeneratedPrompt[]> {
    const prompts: GeneratedPrompt[] = [];
    
    // Choose between comprehensive and focused security analysis
    const hasFocus = context.analysisType && context.analysisType !== 'general';
    const templateId = hasFocus ? 'security_focused' : 'security_comprehensive';
    
    const template = this.templates.get(templateId);
    if (template) {
      const prompt = await this.generatePrompt(template, context);
      prompts.push(prompt);
    }
    
    return prompts;
  }

  public async generateValidationPrompts(context: PromptContext): Promise<GeneratedPrompt[]> {
    const prompts: GeneratedPrompt[] = [];
    
    const template = this.templates.get('deployment_validation_comprehensive');
    if (template) {
      const prompt = await this.generatePrompt(template, context);
      prompts.push(prompt);
    }
    
    return prompts;
  }

  public async generateOptimizationPrompts(context: PromptContext): Promise<GeneratedPrompt[]> {
    const prompts: GeneratedPrompt[] = [];
    
    const template = this.templates.get('performance_optimization');
    if (template) {
      const prompt = await this.generatePrompt(template, context);
      prompts.push(prompt);
    }
    
    return prompts;
  }

  public async generateCustomPrompt(templateId: string, context: PromptContext): Promise<GeneratedPrompt | null> {
    const template = this.templates.get(templateId);
    if (!template) {
      this.logger.error('Template not found', { templateId });
      return null;
    }
    
    return await this.generatePrompt(template, context);
  }

  private async generatePrompt(template: PromptTemplate, context: PromptContext): Promise<GeneratedPrompt> {
    const variables = this.extractVariables(template, context);
    const prompt = this.renderTemplate(template.template, variables);
    
    const generatedPrompt: GeneratedPrompt = {
      id: `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      prompt,
      context,
      template,
      variables,
      metadata: {
        generatedAt: Date.now(),
        estimatedTokens: this.estimateTokens(prompt),
        complexity: this.assessComplexity(prompt, context),
        expectedResponseType: this.determineResponseType(template)
      }
    };
    
    // Store in history
    if (!this.promptHistory.has(template.id)) {
      this.promptHistory.set(template.id, []);
    }
    this.promptHistory.get(template.id)!.push(generatedPrompt);
    
    // Update template usage
    template.metadata.usageCount++;
    template.metadata.lastUpdated = Date.now();
    
    this.logger.info('Generated prompt', {
      templateId: template.id,
      promptId: generatedPrompt.id,
      estimatedTokens: generatedPrompt.metadata.estimatedTokens
    });
    
    return generatedPrompt;
  }

  private extractVariables(template: PromptTemplate, context: PromptContext): { [key: string]: any } {
    const variables: { [key: string]: any } = {};
    
    // Map context properties to template variables
    const contextMapping: { [key: string]: any } = {
      repository: context.repository,
      techStack: context.repository?.techStack || {},
      dependencies: context.repository?.dependencies || [],
      architecture: context.repository?.architecture || 'unknown',
      requirements: context.requirements || {},
      deploymentOptions: context.deploymentOptions || {},
      longContext: context.longContext || {},
      memoryContext: context.memoryContext || {},
      memoryInsights: context.memoryInsights || [],
      memoryPatterns: context.memoryPatterns || [],
      knownVulnerabilities: context.knownVulnerabilities || [],
      threatPatterns: context.threatPatterns || [],
      deploymentData: context.deploymentData || {},
      analysisType: context.analysisType || 'general',
      securityAspect: context.analysisType || 'general',
      cloudProvider: context.deploymentOptions?.cloudProvider || 'aws',
      scale: context.requirements?.scale || 'medium'
    };
    
    // Extract only the variables needed by the template
    template.variables.forEach(varName => {
      if (contextMapping[varName] !== undefined) {
        variables[varName] = contextMapping[varName];
      }
    });
    
    return variables;
  }

  private renderTemplate(template: string, variables: { [key: string]: any }): string {
    let rendered = template;
    
    // Simple template rendering (in production, use a proper template engine)
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      const stringValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
      rendered = rendered.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\export interface PromptTemplate {
  id: string;
  name: string;
  category: 'analysis' | 'infrastructure' | 'security' | 'validation' | 'optimization';
  template: string;
  variables: string[];
  metadata: {
    version: string;
    effectiveness: number;
    usageCount: number;
    avgResponseQuality: number;
    lastUpdated: number;
  };
}'), 'g'), stringValue);
    });
    
    // Handle conditional blocks (simplified)
    rendered = this.renderConditionals(rendered, variables);
    
    // Handle loops (simplified)
    rendered = this.renderLoops(rendered, variables);
    
    // Clean up any remaining placeholders
    rendered = rendered.replace(/\{\{[^}]+\}\}/g, '');
    
    return rendered.trim();
  }

  private renderConditionals(template: string, variables: { [key: string]: any }): string {
    // Handle {{#if condition}} blocks
    const ifPattern = /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    
    return template.replace(ifPattern, (match, condition, content) => {
      const value = this.resolveVariable(condition, variables);
      return value && (Array.isArray(value) ? value.length > 0 : true) ? content : '';
    });
  }

  private renderLoops(template: string, variables: { [key: string]: any }): string {
    // Handle {{#each array}} blocks
    const eachPattern = /\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
    
    return template.replace(eachPattern, (match, arrayName, content) => {
      const array = this.resolveVariable(arrayName, variables);
      if (!Array.isArray(array)) return '';
      
      return array.map(item => {
        let itemContent = content;
        // Replace {{this.property}} with actual values
        itemContent = itemContent.replace(/\{\{this\.([^}]+)\}\}/g, (match, prop) => {
          return item[prop] || '';
        });
        itemContent = itemContent.replace(/\{\{this\}\}/g, String(item));
        return itemContent;
      }).join('');
    });
  }

  private resolveVariable(path: string, variables: { [key: string]: any }): any {
    const parts = path.split('.');
    let current = variables;
    
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return null;
      }
    }
    
    return current;
  }

  private estimateTokens(prompt: string): number {
    // Simple token estimation (in production, use a proper tokenizer)
    return Math.ceil(prompt.length / 4);
  }

  private assessComplexity(prompt: string, context: PromptContext): 'low' | 'medium' | 'high' {
    const tokenCount = this.estimateTokens(prompt);
    const hasMemoryContext = context.memoryContext && Object.keys(context.memoryContext).length > 0;
    const hasLongContext = context.longContext && Object.keys(context.longContext).length > 0;
    
    if (tokenCount > 2000 || (hasMemoryContext && hasLongContext)) {
      return 'high';
    } else if (tokenCount > 1000 || hasMemoryContext || hasLongContext) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  private determineResponseType(template: PromptTemplate): string {
    const responseTypes: { [key: string]: string } = {
      'analysis': 'structured_analysis',
      'infrastructure': 'code_generation',
      'security': 'security_report',
      'validation': 'validation_report',
      'optimization': 'optimization_recommendations'
    };
    
    return responseTypes[template.category] || 'general_response';
  }

  public addTemplate(template: PromptTemplate): void {
    this.templates.set(template.id, template);
    this.logger.info('Added new template', { templateId: template.id, category: template.category });
  }

  public updateTemplate(templateId: string, updates: Partial<PromptTemplate>): boolean {
    const template = this.templates.get(templateId);
    if (!template) {
      this.logger.error('Template not found for update', { templateId });
      return false;
    }
    
    Object.assign(template, updates);
    template.metadata.lastUpdated = Date.now();
    
    this.logger.info('Updated template', { templateId });
    return true;
  }

  public getTemplate(templateId: string): PromptTemplate | null {
    return this.templates.get(templateId) || null;
  }

  public getTemplatesByCategory(category: string): PromptTemplate[] {
    return Array.from(this.templates.values()).filter(template => template.category === category);
  }

  public updatePromptPerformance(promptId: string, responseQuality: number): void {
    // Find the prompt in history
    for (const [templateId, prompts] of this.promptHistory.entries()) {
      const prompt = prompts.find(p => p.id === promptId);
      if (prompt) {
        const template = this.templates.get(templateId);
        if (template) {
          // Update template effectiveness
          const currentAvg = template.metadata.avgResponseQuality;
          const currentCount = template.metadata.usageCount;
          
          template.metadata.avgResponseQuality = 
            (currentAvg * (currentCount - 1) + responseQuality) / currentCount;
          
          // Update overall effectiveness
          template.metadata.effectiveness = 
            (template.metadata.effectiveness * 0.7) + (responseQuality * 0.3);
          
          this.logger.info('Updated prompt performance', {
            templateId,
            promptId,
            responseQuality,
            newEffectiveness: template.metadata.effectiveness
          });
        }
        break;
      }
    }
  }

  public getPromptHistory(templateId: string): GeneratedPrompt[] {
    return this.promptHistory.get(templateId) || [];
  }

  public getPerformanceMetrics(): { [templateId: string]: any } {
    const metrics: { [templateId: string]: any } = {};
    
    this.templates.forEach((template, templateId) => {
      metrics[templateId] = {
        effectiveness: template.metadata.effectiveness,
        usageCount: template.metadata.usageCount,
        avgResponseQuality: template.metadata.avgResponseQuality,
        category: template.category,
        lastUpdated: template.metadata.lastUpdated
      };
    });
    
    return metrics;
  }

  public optimizeTemplates(): void {
    // Remove underperforming templates
    const underPerformingTemplates = Array.from(this.templates.entries())
      .filter(([_, template]) => 
        template.metadata.usageCount > 10 && 
        template.metadata.effectiveness < 60
      );
    
    underPerformingTemplates.forEach(([templateId, template]) => {
      this.logger.warn('Removing underperforming template', {
        templateId,
        effectiveness: template.metadata.effectiveness,
        usageCount: template.metadata.usageCount
      });
      
      this.templates.delete(templateId);
      this.promptHistory.delete(templateId);
    });
    
    // Log optimization results
    this.logger.info('Template optimization completed', {
      removedTemplates: underPerformingTemplates.length,
      remainingTemplates: this.templates.size
    });
  }
}
