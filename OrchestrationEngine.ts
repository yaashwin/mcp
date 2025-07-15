import { Logger } from '../utils/Logger';
import { StateManager, SystemState, TaskState } from './StateManager';
import { PromptEngineeringService, PromptContext, GeneratedPrompt } from './PromptEngineeringService';
import { DynamicMemoryManager } from './DynamicMemoryManager';
import { LongContextManager } from './LongContextManager';

export interface OrchestrationConfig {
  maxConcurrentTasks: number;
  taskTimeout: number;
  retryEnabled: boolean;
  adaptiveScheduling: boolean;
  memoryIntegration: boolean;
  longContextEnabled: boolean;
  performanceMonitoring: boolean;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  phases: WorkflowPhase[];
  dependencies: { [phaseId: string]: string[] };
  config: OrchestrationConfig;
}

export interface WorkflowPhase {
  id: string;
  name: string;
  type: 'analysis' | 'infrastructure' | 'security' | 'validation' | 'optimization';
  priority: number;
  parallel: boolean;
  required: boolean;
  timeout: number;
  retryCount: number;
  condition?: (context: PromptContext) => boolean;
}

export interface ExecutionContext {
  sessionId: string;
  repository: any;
  requirements: any;
  deploymentOptions: any;
  userPreferences: any;
}

export interface TaskResult {
  taskId: string;
  type: string;
  status: 'success' | 'failure' | 'timeout';
  result?: any;
  error?: string;
  duration: number;
  metadata: {
    promptUsed: string;
    tokensUsed: number;
    quality: number;
    complexity: string;
  };
}

export class OrchestrationEngine {
  private logger: Logger;
  private stateManager: StateManager;
  private promptService: PromptEngineeringService;
  private memoryManager?: DynamicMemoryManager;
  private longContextManager?: LongContextManager;
  private config: OrchestrationConfig;
  private activeWorkflows: Map<string, WorkflowDefinition>;
  private taskQueue: TaskState[];
  private runningTasks: Map<string, TaskState>;
  private taskResults: Map<string, TaskResult>;
  private executionTimer?: NodeJS.Timeout;

  constructor(
    stateManager: StateManager,
    promptService: PromptEngineeringService,
    config: OrchestrationConfig,
    memoryManager?: DynamicMemoryManager,
    longContextManager?: LongContextManager
  ) {
    this.logger = Logger.getInstance();
    this.stateManager = stateManager;
    this.promptService = promptService;
    this.memoryManager = memoryManager;
    this.longContextManager = longContextManager;
    this.config = config;
    this.activeWorkflows = new Map();
    this.taskQueue = [];
    this.runningTasks = new Map();
    this.taskResults = new Map();

    this.initializeDefaultWorkflows();
    this.setupEventHandlers();
    this.startTaskProcessor();

    this.logger.info('OrchestrationEngine initialized', {
      maxConcurrentTasks: config.maxConcurrentTasks,
      adaptiveScheduling: config.adaptiveScheduling,
      memoryIntegration: config.memoryIntegration
    });
  }

  private initializeDefaultWorkflows(): void {
    const defaultWorkflow: WorkflowDefinition = {
      id: 'comprehensive_analysis',
      name: 'Comprehensive Repository Analysis',
      phases: [
        {
          id: 'initial_analysis',
          name: 'Initial Repository Analysis',
          type: 'analysis',
          priority: 100,
          parallel: false,
          required: true,
          timeout: 300000, // 5 minutes
          retryCount: 2
        },
        {
          id: 'security_analysis',
          name: 'Security Analysis',
          type: 'security',
          priority: 90,
          parallel: true,
          required: true,
          timeout: 300000,
          retryCount: 2
        },
        {
          id: 'infrastructure_generation',
          name: 'Infrastructure Generation',
          type: 'infrastructure',
          priority: 80,
          parallel: true,
          required: false,
          timeout: 400000,
          retryCount: 1
        },
        {
          id: 'optimization_analysis',
          name: 'Performance Optimization',
          type: 'optimization',
          priority: 70,
          parallel: true,
          required: false,
          timeout: 300000,
          retryCount: 1
        },
        {
          id: 'deployment_validation',
          name: 'Deployment Validation',
          type: 'validation',
          priority: 60,
          parallel: false,
          required: false,
          timeout: 200000,
          retryCount: 1
        }
      ],
      dependencies: {
        'security_analysis': ['initial_analysis'],
        'infrastructure_generation': ['initial_analysis'],
        'optimization_analysis': ['initial_analysis', 'security_analysis'],
        'deployment_validation': ['infrastructure_generation']
      },
      config: this.config
    };

    this.activeWorkflows.set('comprehensive_analysis', defaultWorkflow);

    // Add more specialized workflows
    this.addSpecializedWorkflows();
  }

  private addSpecializedWorkflows(): void {
    // Security-focused workflow
    const securityWorkflow: WorkflowDefinition = {
      id: 'security_focused',
      name: 'Security-Focused Analysis',
      phases: [
        {
          id: 'initial_analysis',
          name: 'Initial Analysis',
          type: 'analysis',
          priority: 100,
          parallel: false,
          required: true,
          timeout: 200000,
          retryCount: 2
        },
        {
          id: 'comprehensive_security',
          name: 'Comprehensive Security Analysis',
          type: 'security',
          priority: 95,
          parallel: false,
          required: true,
          timeout: 400000,
          retryCount: 3
        },
        {
          id: 'security_validation',
          name: 'Security Validation',
          type: 'validation',
          priority: 90,
          parallel: false,
          required: true,
          timeout: 300000,
          retryCount: 2
        }
      ],
      dependencies: {
        'comprehensive_security': ['initial_analysis'],
        'security_validation': ['comprehensive_security']
      },
      config: this.config
    };

    this.activeWorkflows.set('security_focused', securityWorkflow);

    // Infrastructure-focused workflow
    const infrastructureWorkflow: WorkflowDefinition = {
      id: 'infrastructure_focused',
      name: 'Infrastructure-Focused Analysis',
      phases: [
        {
          id: 'initial_analysis',
          name: 'Initial Analysis',
          type: 'analysis',
          priority: 100,
          parallel: false,
          required: true,
          timeout: 200000,
          retryCount: 2
        },
        {
          id: 'infrastructure_comprehensive',
          name: 'Comprehensive Infrastructure',
          type: 'infrastructure',
          priority: 95,
          parallel: false,
          required: true,
          timeout: 500000,
          retryCount: 2
        },
        {
          id: 'infrastructure_optimization',
          name: 'Infrastructure Optimization',
          type: 'optimization',
          priority: 90,
          parallel: false,
          required: true,
          timeout: 300000,
          retryCount: 1
        },
        {
          id: 'deployment_validation',
          name: 'Deployment Validation',
          type: 'validation',
          priority: 85,
          parallel: false,
          required: true,
          timeout: 250000,
          retryCount: 2
        }
      ],
      dependencies: {
        'infrastructure_comprehensive': ['initial_analysis'],
        'infrastructure_optimization': ['infrastructure_comprehensive'],
        'deployment_validation': ['infrastructure_optimization']
      },
      config: this.config
    };

    this.activeWorkflows.set('infrastructure_focused', infrastructureWorkflow);
  }

  private setupEventHandlers(): void {
    this.stateManager.on('task_completed', (data: { taskId: string; task: TaskState }) => {
      this.handleTaskCompletion(data.taskId, data.task);
    });

    this.stateManager.on('task_failed', (data: { taskId: string; task: TaskState }) => {
      this.handleTaskFailure(data.taskId, data.task);
    });

    this.stateManager.on('phase_changed', (data: { from: string; to: string }) => {
      this.handlePhaseChange(data.from, data.to);
    });
  }

  private startTaskProcessor(): void {
    this.executionTimer = setInterval(() => {
      this.processTaskQueue();
    }, 1000);
  }

  public async executeWorkflow(
    workflowId: string,
    context: ExecutionContext
  ): Promise<void> {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    this.logger.info('Starting workflow execution', {
      workflowId,
      sessionId: context.sessionId,
      phases: workflow.phases.length
    });

    // Initialize state
    this.stateManager.updateSystemState({
      phase: 'initialization',
      status: 'processing',
      context: await this.buildPromptContext(context)
    });

    // Create tasks for all phases
    const tasks = await this.createTasksFromWorkflow(workflow, context);
    
    // Start with ready tasks
    this.scheduleReadyTasks();

    this.logger.info('Workflow tasks scheduled', {
      workflowId,
      totalTasks: tasks.length,
      readyTasks: this.stateManager.getReadyTasks().length
    });
  }

  private async createTasksFromWorkflow(
    workflow: WorkflowDefinition,
    context: ExecutionContext
  ): Promise<string[]> {
    const taskIds: string[] = [];
    const promptContext = await this.buildPromptContext(context);

    for (const phase of workflow.phases) {
      // Check if phase should be executed
      if (phase.condition && !phase.condition(promptContext)) {
        continue;
      }

      const dependencies = workflow.dependencies[phase.id] || [];
      const existingDependencies = dependencies.filter(depId => 
        taskIds.some(id => id.includes(depId))
      );

      const taskId = this.stateManager.addTask({
        type: phase.type,
        status: 'pending',
        priority: phase.priority,
        dependencies: existingDependencies,
        retryCount: 0,
        maxRetries: phase.retryCount,
        metadata: {
          estimatedDuration: phase.timeout,
          complexity: this.assessPhaseComplexity(phase, promptContext),
          resources: [phase.type]
        }
      });

      taskIds.push(taskId);
    }

    return taskIds;
  }

  private async buildPromptContext(context: ExecutionContext): Promise<PromptContext> {
    const promptContext: PromptContext = {
      repository: context.repository,
      context: context,
      requirements: context.requirements,
      deploymentOptions: context.deploymentOptions
    };

    // Add memory context if available
    if (this.config.memoryIntegration && this.memoryManager) {
      try {
        const memoryContext = await this.memoryManager.getContextualMemory(
          context.repository,
          ['analysis', 'infrastructure', 'security']
        );
        promptContext.memoryContext = memoryContext;
        promptContext.memoryInsights = memoryContext.insights || [];
        promptContext.memoryPatterns = memoryContext.patterns || [];
      } catch (error) {
        this.logger.warn('Failed to retrieve memory context', { error: error.message });
      }
    }

    // Add long context if available
    if (this.config.longContextEnabled && this.longContextManager) {
      try {
        const longContext = await this.longContextManager.getContextSummary(
          context.repository
        );
        promptContext.longContext = longContext;
      } catch (error) {
        this.logger.warn('Failed to retrieve long context', { error: error.message });
      }
    }

    return promptContext;
  }

  private assessPhaseComplexity(phase: WorkflowPhase, context: PromptContext): 'low' | 'medium' | 'high' {
    let complexity: 'low' | 'medium' | 'high' = 'medium';

    // Base complexity on phase type
    const typeComplexity = {
      'analysis': 'medium',
      'infrastructure': 'high',
      'security': 'high',
      'validation': 'medium',
      'optimization': 'medium'
    };

    complexity = typeComplexity[phase.type] as 'low' | 'medium' | 'high';

    // Adjust based on context
    if (context.memoryContext && Object.keys(context.memoryContext).length > 0) {
      complexity = complexity === 'low' ? 'medium' : 'high';
    }

    if (context.longContext && Object.keys(context.longContext).length > 0) {
      complexity = complexity === 'low' ? 'medium' : 'high';
    }

    return complexity;
  }

  private scheduleReadyTasks(): void {
    const readyTasks = this.stateManager.getReadyTasks();
    const availableSlots = this.config.maxConcurrentTasks - this.runningTasks.size;

    if (availableSlots <= 0 || readyTasks.length === 0) {
      return;
    }

    // Sort tasks by priority and complexity
    const sortedTasks = readyTasks.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      
      // Secondary sort by complexity (simple tasks first if same priority)
      const complexityOrder = { 'low': 0, 'medium': 1, 'high': 2 };
      return complexityOrder[a.metadata.complexity] - complexityOrder[b.metadata.complexity];
    });

    // Schedule up to available slots
    const tasksToSchedule = sortedTasks.slice(0, availableSlots);
    
    for (const task of tasksToSchedule) {
      this.scheduleTask(task);
    }
  }

  private async scheduleTask(task: TaskState): Promise<void> {
    try {
      this.stateManager.updateTaskState(task.id, { status: 'running' });
      this.runningTasks.set(task.id, task);

      // Generate prompt for the task
      const prompt = await this.generatePromptForTask(task);
      if (prompt) {
        this.stateManager.updateTaskState(task.id, { prompt });
      }

      // Execute the task
      this.executeTask(task);

      this.logger.info('Task scheduled for execution', {
        taskId: task.id,
        type: task.type,
        priority: task.priority,
        complexity: task.metadata.complexity
      });

    } catch (error) {
      this.logger.error('Failed to schedule task', {
        taskId: task.id,
        error: error.message
      });
      
      this.stateManager.updateTaskState(task.id, {
        status: 'failed',
        error: error.message
      });
    }
  }

  private async generatePromptForTask(task: TaskState): Promise<GeneratedPrompt | null> {
    const currentState = this.stateManager.getCurrentState();
    const context = currentState.context;

    try {
      let prompts: GeneratedPrompt[] = [];

      switch (task.type) {
        case 'analysis':
          prompts = await this.promptService.generateAnalysisPrompts(context);
          break;
        case 'infrastructure':
          prompts = await this.promptService.generateInfrastructurePrompts(context);
          break;
        case 'security':
          prompts = await this.promptService.generateSecurityPrompts(context);
          break;
        case 'validation':
          prompts = await this.promptService.generateValidationPrompts(context);
          break;
        case 'optimization':
          prompts = await this.promptService.generateOptimizationPrompts(context);
          break;
        default:
          this.logger.warn('Unknown task type for prompt generation', { type: task.type });
          return null;
      }

      // Select the most appropriate prompt
      return prompts.length > 0 ? prompts[0] : null;

    } catch (error) {
      this.logger.error('Failed to generate prompt for task', {
        taskId: task.id,
        type: task.type,
        error: error.message
      });
      return null;
    }
  }

  private async executeTask(task: TaskState): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Set timeout for the task
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Task execution timeout'));
        }, task.metadata.estimatedDuration);
      });

      // Execute the actual task
      const executionPromise = this.performTaskExecution(task);

      // Race between execution and timeout
      const result = await Promise.race([executionPromise, timeoutPromise]);

      const duration = Date.now() - startTime;
      
      // Store result
      const taskResult: TaskResult = {
        taskId: task.id,
        type: task.type,
        status: 'success',
        result,
        duration,
        metadata: {
          promptUsed: task.prompt?.id || '',
          tokensUsed: task.prompt?.metadata.estimatedTokens || 0,
          quality: this.assessResultQuality(result),
          complexity: task.metadata.complexity
        }
      };

      this.taskResults.set(task.id, taskResult);
      this.stateManager.updateTaskState(task.id, {
        status: 'completed',
        result
      });

      // Update result in state manager
      this.stateManager.setResult(task.type, result);

      // Update prompt performance if applicable
      if (task.prompt) {
        this.promptService.updatePromptPerformance(
          task.prompt.id,
          taskResult.metadata.quality
        );
      }

      this.logger.info('Task executed successfully', {
        taskId: task.id,
        type: task.type,
        duration,
        quality: taskResult.metadata.quality
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      const isTimeout = error.message.includes('timeout');
      
      const taskResult: TaskResult = {
        taskId: task.id,
        type: task.type,
        status: isTimeout ? 'timeout' : 'failure',
        error: error.message,
        duration,
        metadata: {
          promptUsed: task.prompt?.id || '',
          tokensUsed: task.prompt?.metadata.estimatedTokens || 0,
          quality: 0,
          complexity: task.metadata.complexity
        }
      };

      this.taskResults.set(task.id, taskResult);
      this.stateManager.updateTaskState(task.id, {
        status: 'failed',
        error: error.message
      });

      this.logger.error('Task execution failed', {
        taskId: task.id,
        type: task.type,
        error: error.message,
        duration,
        isTimeout
      });
    } finally {
      this.runningTasks.delete(task.id);
    }
  }

  private async performTaskExecution(task: TaskState): Promise<any> {
    // This is a placeholder for the actual task execution logic
    // In a real implementation, this would call the appropriate service
    // based on the task type and execute the generated prompt
    
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    // Mock result based on task type
    switch (task.type) {
      case 'analysis':
        return {
          summary: 'Repository analysis completed',
          findings: ['Finding 1', 'Finding 2'],
          recommendations: ['Recommendation 1', 'Recommendation 2']
        };
      case 'infrastructure':
        return {
          templates: ['template1.yaml', 'template2.yaml'],
          resources: ['resource1', 'resource2'],
          estimated_cost: 150.75
        };
      case 'security':
        return {
          vulnerabilities: ['vuln1', 'vuln2'],
          risk_score: 7.5,
          recommendations: ['security_rec1', 'security_rec2']
        };
      case 'validation':
        return {
          validation_results: { passed: 8, failed: 2 },
          issues: ['issue1', 'issue2'],
          status: 'passed_with_warnings'
        };
      case 'optimization':
        return {
          optimizations: ['opt1', 'opt2'],
          potential_savings: 25.5,
          performance_improvements: ['perf1', 'perf2']
        };
      default:
        return { message: 'Task completed successfully' };
    }
  }

  private assessResultQuality(result: any): number {
    // Simple quality assessment based on result completeness
    if (!result) return 0;
    
    const keys = Object.keys(result);
    const hasContent = keys.some(key => {
      const value = result[key];
      return Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined;
    });
    
    return hasContent ? Math.floor(Math.random() * 30) + 70 : Math.floor(Math.random() * 50) + 20;
  }

  private processTaskQueue(): void {
    if (this.runningTasks.size < this.config.maxConcurrentTasks) {
      this.scheduleReadyTasks();
    }
    
    // Check for completed workflows
    this.checkWorkflowCompletion();
  }

  private handleTaskCompletion(taskId: string, task: TaskState): void {
    this.logger.info('Task completed', { taskId, type: task.type });
    
    // Update memory if integration is enabled
    if (this.config.memoryIntegration && this.memoryManager && task.result) {
      this.memoryManager.storeInteraction({
        type: 'task_completion',
        taskId,
        taskType: task.type,
        result: task.result,
        timestamp: Date.now()
      });
    }
    
    // Update long context if enabled
    if (this.config.longContextEnabled && this.longContextManager && task.result) {
      this.longContextManager.addAnalysisResult(task.type, task.result);
    }
    
    // Schedule any newly ready tasks
    this.scheduleReadyTasks();
  }

  private handleTaskFailure(taskId: string, task: TaskState): void {
    this.logger.warn('Task failed', { taskId, type: task.type, error: task.error });
    
    // Attempt retry if configured
    if (this.config.retryEnabled && task.retryCount < task.maxRetries) {
      setTimeout(() => {
        if (this.stateManager.retryTask(taskId)) {
          this.logger.info('Task queued for retry', { taskId, retryCount: task.retryCount + 1 });
        }
      }, 5000); // Wait 5 seconds before retry
    }
  }

  private handlePhaseChange(from: string, to: string): void {
    this.logger.info('Phase changed', { from, to });
    
    // Update workflow state based on phase
    if (to === 'completed') {
      this.handleWorkflowCompletion();
    }
  }

  private checkWorkflowCompletion(): void {
    const allTasks = this.stateManager.getTasksByStatus('completed').length +
                    this.stateManager.getTasksByStatus('failed').length +
                    this.stateManager.getTasksByStatus('cancelled').length;
    
    const totalTasks = this.stateManager.getCurrentState().metadata.totalTasks;
    
    if (allTasks === totalTasks && totalTasks > 0) {
      this.stateManager.updateSystemState({
        phase: 'completed',
        status: 'completed',
        progress: 100
      });
      
      this.handleWorkflowCompletion();
    }
  }

  private handleWorkflowCompletion(): void {
    const currentState = this.stateManager.getCurrentState();
    const results = this.stateManager.getAllResults();
    
    this.logger.info('Workflow completed', {
      sessionId: currentState.sessionId,
      totalTasks: currentState.metadata.totalTasks,
      completedTasks: currentState.metadata.completedTasks,
      failedTasks: currentState.metadata.failedTasks,
      results: Object.keys(results)
    });
    
    // Generate final report
    const report = this.generateFinalReport();
    this.stateManager.setResult('final_report', report);
    
    // Cleanup
    this.cleanup();
  }

  private generateFinalReport(): any {
    const currentState = this.stateManager.getCurrentState();
    const allResults = this.stateManager.getAllResults();
    const taskResults = Array.from(this.taskResults.values());
    
    return {
      summary: {
        sessionId: currentState.sessionId,
        totalTasks: currentState.metadata.totalTasks,
        completedTasks: currentState.metadata.completedTasks,
        failedTasks: currentState.metadata.failedTasks,
        successRate: (currentState.metadata.completedTasks / currentState.metadata.totalTasks) * 100,
        totalDuration: Date.now() - currentState.metadata.startTime
      },
      results: allResults,
      taskMetrics: {
        averageQuality: taskResults.reduce((sum, task) => sum + task.metadata.quality, 0) / taskResults.length,
        averageDuration: taskResults.reduce((sum, task) => sum + task.duration, 0) / taskResults.length,
        totalTokensUsed: taskResults.reduce((sum, task) => sum + task.metadata.tokensUsed, 0)
      },
      recommendations: this.generateRecommendations(allResults),
      errors: currentState.errors
    };
  }

  private generateRecommendations(results: any): string[] {
    const recommendations: string[] = [];
    
    // Analyze results and generate recommendations
    if (results.security && results.security.vulnerabilities?.length > 0) {
      recommendations.push('Address identified security vulnerabilities immediately');
    }
    
    if (results.optimization && results.optimization.potential_savings > 20) {
      recommendations.push('Implement performance optimizations for significant cost savings');
    }
    
    if (results.validation && results.validation.validation_results?.failed > 0) {
      recommendations.push('Review and fix validation failures before deployment');
    }
    
    return recommendations;
  }

  public pauseExecution(): void {
    if (this.executionTimer) {
      clearInterval(this.executionTimer);
      this.executionTimer = undefined;
    }
    
    this.stateManager.updateSystemState({ status: 'waiting' });
    this.logger.info('Execution paused');
  }

  public resumeExecution(): void {
    if (!this.executionTimer) {
      this.startTaskProcessor();
    }
    
    this.stateManager.updateSystemState({ status: 'processing' });
    this.logger.info('Execution resumed');
  }

  public cancelExecution(): void {
    this.pauseExecution();
    
    // Cancel all pending tasks
    const pendingTasks = this.stateManager.getTasksByStatus('pending');
    pendingTasks.forEach(task => {
      this.stateManager.cancelTask(task.id);
    });
    
    this.stateManager.updateSystemState({ 
      status: 'completed',
      phase: 'completed'
    });
    
    this.logger.info('Execution cancelled');
  }

  public getExecutionStatus(): {
    isRunning: boolean;
    currentPhase: string;
    progress: number;
    runningTasks: number;
    pendingTasks: number;
  } {
    const currentState = this.stateManager.getCurrentState();
    
    return {
      isRunning: !!this.executionTimer,
      currentPhase: currentState.phase,
      progress: currentState.progress,
      runningTasks: this.runningTasks.size,
      pendingTasks: this.stateManager.getTasksByStatus('pending').length
    };
  }

  public getTaskResults(): Map<string, TaskResult> {
    return new Map(this.taskResults);
  }

  public addWorkflow(workflow: WorkflowDefinition): void {
    this.activeWorkflows.set(workflow.id, workflow);
    this.logger.info('Workflow added', { workflowId: workflow.id, phases: workflow.phases.length });
  }

  public removeWorkflow(workflowId: string): boolean {
    const removed = this.activeWorkflows.delete(workflowId);
    if (removed) {
      this.logger.info('Workflow removed', { workflowId });
    }
    return removed;
  }

  public getWorkflows(): WorkflowDefinition[] {
    return Array.from(this.activeWorkflows.values());
  }

  public updateConfig(config: Partial<OrchestrationConfig>): void {
    Object.assign(this.config, config);
    this.logger.info('Configuration updated', { config: this.config });
  }

  private cleanup(): void {
    if (this.executionTimer) {
      clearInterval(this.executionTimer);
      this.executionTimer = undefined;
    }
    
    this.runningTasks.clear();
    this.taskQueue = [];
    
    this.logger.info('OrchestrationEngine cleanup completed');
  }

  public destroy(): void {
    this.cleanup();
    this.activeWorkflows.clear();
    this.taskResults.clear();
    
    this.logger.info('OrchestrationEngine destroyed');
  }
}
