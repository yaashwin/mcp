import { Logger } from '../utils/Logger';
import { PromptContext, GeneratedPrompt } from './PromptEngineeringService';

export interface SystemState {
  id: string;
  sessionId: string;
  timestamp: number;
  phase: 'initialization' | 'analysis' | 'infrastructure' | 'security' | 'validation' | 'optimization' | 'completed' | 'error';
  status: 'idle' | 'processing' | 'waiting' | 'completed' | 'failed';
  progress: number;
  currentTask?: string;
  context: PromptContext;
  results: {
    analysis?: any;
    infrastructure?: any;
    security?: any;
    validation?: any;
    optimization?: any;
  };
  metadata: {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    startTime: number;
    endTime?: number;
    estimatedCompletion?: number;
  };
  errors: Array<{
    timestamp: number;
    phase: string;
    task: string;
    error: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
}

export interface TaskState {
  id: string;
  type: 'analysis' | 'infrastructure' | 'security' | 'validation' | 'optimization';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  dependencies: string[];
  prompt?: GeneratedPrompt;
  result?: any;
  error?: string;
  startTime?: number;
  endTime?: number;
  retryCount: number;
  maxRetries: number;
  metadata: {
    estimatedDuration: number;
    complexity: 'low' | 'medium' | 'high';
    resources: string[];
  };
}

export interface StateSnapshot {
  timestamp: number;
  systemState: SystemState;
  taskStates: Map<string, TaskState>;
  metrics: {
    performance: any;
    resource: any;
    quality: any;
  };
}

export class StateManager {
  private logger: Logger;
  private currentState: SystemState;
  private taskStates: Map<string, TaskState>;
  private stateHistory: StateSnapshot[];
  private listeners: Map<string, Function[]>;
  private persistenceEnabled: boolean;
  private maxHistorySize: number;

  constructor(sessionId: string, persistenceEnabled: boolean = true) {
    this.logger = Logger.getInstance();
    this.taskStates = new Map();
    this.stateHistory = [];
    this.listeners = new Map();
    this.persistenceEnabled = persistenceEnabled;
    this.maxHistorySize = 100;

    this.currentState = this.createInitialState(sessionId);
    this.initializeEventTypes();
    
    this.logger.info('StateManager initialized', { sessionId, persistenceEnabled });
  }

  private createInitialState(sessionId: string): SystemState {
    return {
      id: `state_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      timestamp: Date.now(),
      phase: 'initialization',
      status: 'idle',
      progress: 0,
      context: {} as PromptContext,
      results: {},
      metadata: {
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        startTime: Date.now()
      },
      errors: []
    };
  }

  private initializeEventTypes(): void {
    const eventTypes = [
      'state_changed',
      'phase_changed',
      'task_started',
      'task_completed',
      'task_failed',
      'progress_updated',
      'error_occurred',
      'session_completed'
    ];

    eventTypes.forEach(eventType => {
      this.listeners.set(eventType, []);
    });
  }

  public updateSystemState(updates: Partial<SystemState>): void {
    const previousState = { ...this.currentState };
    
    Object.assign(this.currentState, updates);
    this.currentState.timestamp = Date.now();
    
    // Update progress based on task completion
    this.updateProgress();
    
    // Emit state change event
    this.emit('state_changed', {
      previous: previousState,
      current: this.currentState,
      changes: updates
    });
    
    // Check for phase changes
    if (previousState.phase !== this.currentState.phase) {
      this.emit('phase_changed', {
        from: previousState.phase,
        to: this.currentState.phase,
        timestamp: this.currentState.timestamp
      });
    }
    
    // Save snapshot
    this.saveSnapshot();
    
    this.logger.info('System state updated', {
      sessionId: this.currentState.sessionId,
      phase: this.currentState.phase,
      status: this.currentState.status,
      progress: this.currentState.progress
    });
  }

  public addTask(task: Omit<TaskState, 'id'>): string {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const fullTask: TaskState = {
      id: taskId,
      ...task,
      retryCount: 0,
      maxRetries: task.maxRetries || 3
    };
    
    this.taskStates.set(taskId, fullTask);
    
    // Update total tasks count
    this.currentState.metadata.totalTasks = this.taskStates.size;
    
    this.logger.info('Task added', {
      taskId,
      type: task.type,
      priority: task.priority,
      dependencies: task.dependencies
    });
    
    return taskId;
  }

  public updateTaskState(taskId: string, updates: Partial<TaskState>): boolean {
    const task = this.taskStates.get(taskId);
    if (!task) {
      this.logger.error('Task not found for update', { taskId });
      return false;
    }
    
    const previousStatus = task.status;
    Object.assign(task, updates);
    
    // Handle status changes
    if (previousStatus !== task.status) {
      this.handleTaskStatusChange(taskId, task, previousStatus);
    }
    
    // Update current task if it's running
    if (task.status === 'running') {
      this.currentState.currentTask = `${task.type}: ${taskId}`;
    }
    
    this.updateProgress();
    
    this.logger.info('Task state updated', {
      taskId,
      type: task.type,
      status: task.status,
      previousStatus
    });
    
    return true;
  }

  private handleTaskStatusChange(taskId: string, task: TaskState, previousStatus: string): void {
    const now = Date.now();
    
    switch (task.status) {
      case 'running':
        task.startTime = now;
        this.emit('task_started', { taskId, task });
        break;
        
      case 'completed':
        task.endTime = now;
        this.currentState.metadata.completedTasks++;
        this.emit('task_completed', { taskId, task });
        break;
        
      case 'failed':
        task.endTime = now;
        this.currentState.metadata.failedTasks++;
        this.addError(this.currentState.phase, taskId, task.error || 'Unknown error', 'medium');
        this.emit('task_failed', { taskId, task });
        break;
        
      case 'cancelled':
        task.endTime = now;
        break;
    }
  }

  public getTask(taskId: string): TaskState | null {
    return this.taskStates.get(taskId) || null;
  }

  public getTasksByType(type: TaskState['type']): TaskState[] {
    return Array.from(this.taskStates.values()).filter(task => task.type === type);
  }

  public getTasksByStatus(status: TaskState['status']): TaskState[] {
    return Array.from(this.taskStates.values()).filter(task => task.status === status);
  }

  public getPendingTasks(): TaskState[] {
    return Array.from(this.taskStates.values())
      .filter(task => task.status === 'pending')
      .sort((a, b) => b.priority - a.priority);
  }

  public getReadyTasks(): TaskState[] {
    return this.getPendingTasks().filter(task => 
      task.dependencies.every(depId => {
        const depTask = this.taskStates.get(depId);
        return depTask && depTask.status === 'completed';
      })
    );
  }

  public retryTask(taskId: string): boolean {
    const task = this.taskStates.get(taskId);
    if (!task || task.status !== 'failed') {
      return false;
    }
    
    if (task.retryCount >= task.maxRetries) {
      this.logger.warn('Task retry limit exceeded', { taskId, retryCount: task.retryCount });
      return false;
    }
    
    task.retryCount++;
    task.status = 'pending';
    task.error = undefined;
    task.startTime = undefined;
    task.endTime = undefined;
    
    this.logger.info('Task queued for retry', { taskId, retryCount: task.retryCount });
    return true;
  }

  public cancelTask(taskId: string): boolean {
    const task = this.taskStates.get(taskId);
    if (!task || task.status === 'completed') {
      return false;
    }
    
    task.status = 'cancelled';
    task.endTime = Date.now();
    
    this.logger.info('Task cancelled', { taskId });
    return true;
  }

  private updateProgress(): void {
    const total = this.currentState.metadata.totalTasks;
    const completed = this.currentState.metadata.completedTasks;
    const failed = this.currentState.metadata.failedTasks;
    
    if (total === 0) {
      this.currentState.progress = 0;
      return;
    }
    
    const progress = ((completed + failed) / total) * 100;
    const previousProgress = this.currentState.progress;
    
    this.currentState.progress = Math.round(progress);
    
    if (Math.abs(progress - previousProgress) >= 5) {
      this.emit('progress_updated', {
        progress: this.currentState.progress,
        completed,
        failed,
        total
      });
    }
    
    // Update estimated completion time
    if (completed > 0) {
      const elapsed = Date.now() - this.currentState.metadata.startTime;
      const avgTimePerTask = elapsed / completed;
      const remaining = total - completed - failed;
      
      this.currentState.metadata.estimatedCompletion = 
        Date.now() + (avgTimePerTask * remaining);
    }
  }

  public addError(phase: string, task: string, error: string, severity: 'low' | 'medium' | 'high' | 'critical'): void {
    const errorEntry = {
      timestamp: Date.now(),
      phase,
      task,
      error,
      severity
    };
    
    this.currentState.errors.push(errorEntry);
    
    this.emit('error_occurred', errorEntry);
    
    this.logger.error('Error added to state', errorEntry);
  }

  public setResult(type: keyof SystemState['results'], result: any): void {
    this.currentState.results[type] = result;
    
    this.logger.info('Result set', { type, hasResult: !!result });
  }

  public getResult(type: keyof SystemState['results']): any {
    return this.currentState.results[type];
  }

  public getAllResults(): SystemState['results'] {
    return { ...this.currentState.results };
  }

  public getCurrentState(): SystemState {
    return { ...this.currentState };
  }

  public getStateSnapshot(): StateSnapshot {
    return {
      timestamp: Date.now(),
      systemState: { ...this.currentState },
      taskStates: new Map(this.taskStates),
      metrics: {
        performance: this.getPerformanceMetrics(),
        resource: this.getResourceMetrics(),
        quality: this.getQualityMetrics()
      }
    };
  }

  private saveSnapshot(): void {
    const snapshot = this.getStateSnapshot();
    this.stateHistory.push(snapshot);
    
    // Maintain history size limit
    if (this.stateHistory.length > this.maxHistorySize) {
      this.stateHistory.shift();
    }
    
    if (this.persistenceEnabled) {
      this.persistState(snapshot);
    }
  }

  private persistState(snapshot: StateSnapshot): void {
    // In a real implementation, this would save to a database or file
    // For now, we'll just log the persistence action
    this.logger.debug('State persisted', {
      sessionId: this.currentState.sessionId,
      timestamp: snapshot.timestamp,
      phase: snapshot.systemState.phase
    });
  }

  public getStateHistory(): StateSnapshot[] {
    return [...this.stateHistory];
  }

  public getHistoryByPhase(phase: string): StateSnapshot[] {
    return this.stateHistory.filter(snapshot => snapshot.systemState.phase === phase);
  }

  public on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    
    this.listeners.get(event)!.push(listener);
  }

  public off(event: string, listener: Function): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          this.logger.error('Event listener error', { event, error: error.message });
        }
      });
    }
  }

  private getPerformanceMetrics(): any {
    const tasks = Array.from(this.taskStates.values());
    const completedTasks = tasks.filter(task => task.status === 'completed');
    
    if (completedTasks.length === 0) {
      return { averageTaskTime: 0, totalProcessingTime: 0 };
    }
    
    const totalTime = completedTasks.reduce((sum, task) => {
      return sum + (task.endTime! - task.startTime!);
    }, 0);
    
    return {
      averageTaskTime: totalTime / completedTasks.length,
      totalProcessingTime: totalTime,
      taskThroughput: completedTasks.length / ((Date.now() - this.currentState.metadata.startTime) / 1000)
    };
  }

  private getResourceMetrics(): any {
    const tasks = Array.from(this.taskStates.values());
    
    return {
      totalTasks: tasks.length,
      activeTasks: tasks.filter(task => task.status === 'running').length,
      queuedTasks: tasks.filter(task => task.status === 'pending').length,
      memoryUsage: process.memoryUsage ? process.memoryUsage() : null
    };
  }

  private getQualityMetrics(): any {
    const tasks = Array.from(this.taskStates.values());
    const completedTasks = tasks.filter(task => task.status === 'completed');
    const failedTasks = tasks.filter(task => task.status === 'failed');
    
    return {
      successRate: tasks.length > 0 ? (completedTasks.length / tasks.length) * 100 : 0,
      failureRate: tasks.length > 0 ? (failedTasks.length / tasks.length) * 100 : 0,
      averageRetries: tasks.reduce((sum, task) => sum + task.retryCount, 0) / tasks.length,
      errorSeverityDistribution: this.getErrorSeverityDistribution()
    };
  }

  private getErrorSeverityDistribution(): { [severity: string]: number } {
    const distribution: { [severity: string]: number } = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };
    
    this.currentState.errors.forEach(error => {
      distribution[error.severity]++;
    });
    
    return distribution;
  }

  public reset(): void {
    this.currentState = this.createInitialState(this.currentState.sessionId);
    this.taskStates.clear();
    this.stateHistory = [];
    
    this.logger.info('State manager reset', { sessionId: this.currentState.sessionId });
  }

  public cleanup(): void {
    this.listeners.clear();
    this.stateHistory = [];
    
    this.logger.info('State manager cleanup completed');
  }
}
