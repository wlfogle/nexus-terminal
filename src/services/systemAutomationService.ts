import AsyncStorage from '@react-native-async-storage/async-storage';
import { connectionService } from './connectionService';

interface Script {
  id: string;
  name: string;
  description: string;
  content: string;
  language: 'bash' | 'python' | 'javascript' | 'powershell';
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  isTemplate: boolean;
  parameters: ScriptParameter[];
  lastRun?: Date;
  runCount: number;
}

interface ScriptParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'file' | 'directory';
  required: boolean;
  defaultValue?: any;
  description: string;
  validation?: string; // regex pattern for validation
}

interface ScheduledTask {
  id: string;
  scriptId: string;
  name: string;
  schedule: CronSchedule;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
  lastResult?: TaskResult;
  parameters: Record<string, any>;
}

interface CronSchedule {
  minute: string; // 0-59
  hour: string;   // 0-23
  day: string;    // 1-31
  month: string;  // 1-12
  weekday: string; // 0-7 (0 or 7 is Sunday)
  expression?: string; // Full cron expression
}

interface TaskResult {
  success: boolean;
  output: string;
  error?: string;
  duration: number;
  timestamp: Date;
}

interface MacroAction {
  type: 'command' | 'delay' | 'input' | 'condition';
  command?: string;
  delay?: number;
  input?: string;
  condition?: {
    check: string;
    action: 'continue' | 'stop' | 'jump';
    target?: number;
  };
}

interface Macro {
  id: string;
  name: string;
  description: string;
  actions: MacroAction[];
  hotkey?: string;
  createdAt: Date;
  updatedAt: Date;
  runCount: number;
}

interface WorkflowStep {
  id: string;
  type: 'script' | 'command' | 'approval' | 'notification';
  name: string;
  scriptId?: string;
  command?: string;
  approvers?: string[];
  notificationMessage?: string;
  onSuccess?: string; // next step id
  onFailure?: string; // next step id
  timeout?: number;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  triggers: WorkflowTrigger[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface WorkflowTrigger {
  type: 'schedule' | 'file' | 'system' | 'webhook';
  schedule?: CronSchedule;
  filePath?: string;
  fileEvent?: 'create' | 'modify' | 'delete';
  systemMetric?: string;
  threshold?: number;
  webhookUrl?: string;
}

class SystemAutomationService {
  private scripts: Map<string, Script> = new Map();
  private scheduledTasks: Map<string, ScheduledTask> = new Map();
  private macros: Map<string, Macro> = new Map();
  private workflows: Map<string, Workflow> = new Map();
  private runningTasks: Map<string, boolean> = new Map();
  private schedulerInterval: NodeJS.Timeout | null = null;
  
  private readonly STORAGE_KEYS = {
    SCRIPTS: 'automation_scripts',
    TASKS: 'automation_tasks',
    MACROS: 'automation_macros',
    WORKFLOWS: 'automation_workflows'
  };

  async initialize(): Promise<void> {
    await this.loadData();
    this.startScheduler();
    console.log('🤖 System Automation Service initialized');
  }

  // Script Management
  async createScript(
    name: string,
    content: string,
    language: 'bash' | 'python' | 'javascript' | 'powershell',
    options: {
      description?: string;
      tags?: string[];
      parameters?: ScriptParameter[];
      isTemplate?: boolean;
    } = {}
  ): Promise<string> {
    const scriptId = `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const script: Script = {
      id: scriptId,
      name,
      description: options.description || '',
      content,
      language,
      tags: options.tags || [],
      createdAt: new Date(),
      updatedAt: new Date(),
      isTemplate: options.isTemplate || false,
      parameters: options.parameters || [],
      runCount: 0
    };

    this.scripts.set(scriptId, script);
    await this.saveScripts();

    return scriptId;
  }

  async updateScript(scriptId: string, updates: Partial<Script>): Promise<boolean> {
    const script = this.scripts.get(scriptId);
    if (!script) return false;

    Object.assign(script, {
      ...updates,
      updatedAt: new Date()
    });

    this.scripts.set(scriptId, script);
    await this.saveScripts();
    
    return true;
  }

  async deleteScript(scriptId: string): Promise<boolean> {
    const deleted = this.scripts.delete(scriptId);
    if (deleted) {
      // Remove associated scheduled tasks
      const tasksToDelete = Array.from(this.scheduledTasks.values())
        .filter(task => task.scriptId === scriptId)
        .map(task => task.id);
      
      for (const taskId of tasksToDelete) {
        await this.deleteScheduledTask(taskId);
      }
      
      await this.saveScripts();
    }
    return deleted;
  }

  getScripts(): Script[] {
    return Array.from(this.scripts.values())
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  getScript(scriptId: string): Script | undefined {
    return this.scripts.get(scriptId);
  }

  async runScript(
    scriptId: string,
    parameters: Record<string, any> = {},
    timeout: number = 300000 // 5 minutes default
  ): Promise<TaskResult> {
    const script = this.scripts.get(scriptId);
    if (!script) {
      throw new Error('Script not found');
    }

    if (this.runningTasks.get(scriptId)) {
      throw new Error('Script is already running');
    }

    const startTime = Date.now();
    this.runningTasks.set(scriptId, true);

    try {
      if (!connectionService.isConnected()) {
        throw new Error('Not connected to remote server');
      }

      // Replace parameters in script content
      let processedContent = script.content;
      for (const [key, value] of Object.entries(parameters)) {
        const placeholder = new RegExp(`\\$\\{${key}\\}`, 'g');
        processedContent = processedContent.replace(placeholder, String(value));
      }

      // Create temporary script file
      const tempFile = `/tmp/nexus_script_${scriptId}.${this.getScriptExtension(script.language)}`;
      const writeResult = await connectionService.executeCommand(
        `echo '${processedContent.replace(/'/g, "'\\''")}' > ${tempFile}`
      );

      if (writeResult.exitCode !== 0) {
        throw new Error(`Failed to create script file: ${writeResult.output}`);
      }

      // Make script executable if needed
      if (script.language === 'bash') {
        await connectionService.executeCommand(`chmod +x ${tempFile}`);
      }

      // Execute script
      const command = this.getExecutionCommand(script.language, tempFile);
      const result = await connectionService.executeCommand(command, timeout);

      // Cleanup
      await connectionService.executeCommand(`rm -f ${tempFile}`);

      // Update script run count
      script.runCount++;
      script.lastRun = new Date();
      await this.saveScripts();

      const taskResult: TaskResult = {
        success: result.exitCode === 0,
        output: result.output,
        error: result.exitCode !== 0 ? result.output : undefined,
        duration: Date.now() - startTime,
        timestamp: new Date()
      };

      return taskResult;
    } catch (error) {
      const taskResult: TaskResult = {
        success: false,
        output: '',
        error: error.message,
        duration: Date.now() - startTime,
        timestamp: new Date()
      };

      return taskResult;
    } finally {
      this.runningTasks.delete(scriptId);
    }
  }

  // Scheduled Tasks
  async createScheduledTask(
    scriptId: string,
    name: string,
    schedule: CronSchedule,
    parameters: Record<string, any> = {}
  ): Promise<string> {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const task: ScheduledTask = {
      id: taskId,
      scriptId,
      name,
      schedule,
      enabled: true,
      parameters,
      runCount: 0,
      nextRun: this.calculateNextRun(schedule)
    };

    this.scheduledTasks.set(taskId, task);
    await this.saveScheduledTasks();

    return taskId;
  }

  async updateScheduledTask(taskId: string, updates: Partial<ScheduledTask>): Promise<boolean> {
    const task = this.scheduledTasks.get(taskId);
    if (!task) return false;

    Object.assign(task, updates);
    
    if (updates.schedule) {
      task.nextRun = this.calculateNextRun(updates.schedule);
    }

    this.scheduledTasks.set(taskId, task);
    await this.saveScheduledTasks();
    
    return true;
  }

  async deleteScheduledTask(taskId: string): Promise<boolean> {
    const deleted = this.scheduledTasks.delete(taskId);
    if (deleted) {
      await this.saveScheduledTasks();
    }
    return deleted;
  }

  getScheduledTasks(): ScheduledTask[] {
    return Array.from(this.scheduledTasks.values())
      .sort((a, b) => (a.nextRun?.getTime() || 0) - (b.nextRun?.getTime() || 0));
  }

  // Macros
  async createMacro(
    name: string,
    actions: MacroAction[],
    options: {
      description?: string;
      hotkey?: string;
    } = {}
  ): Promise<string> {
    const macroId = `macro_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const macro: Macro = {
      id: macroId,
      name,
      description: options.description || '',
      actions,
      hotkey: options.hotkey,
      createdAt: new Date(),
      updatedAt: new Date(),
      runCount: 0
    };

    this.macros.set(macroId, macro);
    await this.saveMacros();

    return macroId;
  }

  async runMacro(macroId: string): Promise<boolean> {
    const macro = this.macros.get(macroId);
    if (!macro) return false;

    try {
      if (!connectionService.isConnected()) {
        throw new Error('Not connected to remote server');
      }

      let currentStep = 0;
      
      while (currentStep < macro.actions.length) {
        const action = macro.actions[currentStep];
        
        switch (action.type) {
          case 'command':
            if (action.command) {
              const result = await connectionService.executeCommand(action.command);
              console.log(`Macro command result: ${result.output}`);
            }
            break;
            
          case 'delay':
            if (action.delay) {
              await new Promise(resolve => setTimeout(resolve, action.delay));
            }
            break;
            
          case 'input':
            if (action.input) {
              // This would need terminal session integration
              console.log(`Macro input: ${action.input}`);
            }
            break;
            
          case 'condition':
            if (action.condition) {
              const conditionResult = await connectionService.executeCommand(action.condition.check);
              
              if (conditionResult.exitCode === 0) {
                if (action.condition.action === 'jump' && action.condition.target !== undefined) {
                  currentStep = action.condition.target;
                  continue;
                } else if (action.condition.action === 'stop') {
                  break;
                }
              }
            }
            break;
        }
        
        currentStep++;
      }

      macro.runCount++;
      await this.saveMacros();
      
      return true;
    } catch (error) {
      console.error('Macro execution failed:', error);
      return false;
    }
  }

  getMacros(): Macro[] {
    return Array.from(this.macros.values())
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  // Workflows
  async createWorkflow(
    name: string,
    description: string,
    steps: WorkflowStep[],
    triggers: WorkflowTrigger[] = []
  ): Promise<string> {
    const workflowId = `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const workflow: Workflow = {
      id: workflowId,
      name,
      description,
      steps,
      triggers,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.workflows.set(workflowId, workflow);
    await this.saveWorkflows();

    return workflowId;
  }

  async runWorkflow(workflowId: string): Promise<boolean> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || !workflow.enabled) return false;

    try {
      let currentStepIndex = 0;
      
      while (currentStepIndex < workflow.steps.length) {
        const step = workflow.steps[currentStepIndex];
        let stepResult: TaskResult | null = null;
        
        switch (step.type) {
          case 'script':
            if (step.scriptId) {
              stepResult = await this.runScript(step.scriptId);
            }
            break;
            
          case 'command':
            if (step.command) {
              const result = await connectionService.executeCommand(step.command);
              stepResult = {
                success: result.exitCode === 0,
                output: result.output,
                error: result.exitCode !== 0 ? result.output : undefined,
                duration: 0,
                timestamp: new Date()
              };
            }
            break;
            
          case 'approval':
            // This would need UI integration for approval requests
            console.log(`Workflow approval required: ${step.name}`);
            stepResult = { success: true, output: 'Approved', duration: 0, timestamp: new Date() };
            break;
            
          case 'notification':
            console.log(`Workflow notification: ${step.notificationMessage}`);
            stepResult = { success: true, output: 'Notification sent', duration: 0, timestamp: new Date() };
            break;
        }
        
        if (stepResult) {
          const nextStepId = stepResult.success ? step.onSuccess : step.onFailure;
          
          if (nextStepId) {
            const nextStepIndex = workflow.steps.findIndex(s => s.id === nextStepId);
            if (nextStepIndex !== -1) {
              currentStepIndex = nextStepIndex;
              continue;
            }
          }
          
          if (!stepResult.success && !step.onFailure) {
            console.error(`Workflow step failed: ${step.name}`);
            return false;
          }
        }
        
        currentStepIndex++;
      }
      
      return true;
    } catch (error) {
      console.error('Workflow execution failed:', error);
      return false;
    }
  }

  // System Integration
  async exportScript(scriptId: string): Promise<string> {
    const script = this.scripts.get(scriptId);
    if (!script) throw new Error('Script not found');

    return JSON.stringify(script, null, 2);
  }

  async importScript(scriptData: string): Promise<string> {
    try {
      const script: Script = JSON.parse(scriptData);
      script.id = `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      script.createdAt = new Date();
      script.updatedAt = new Date();
      script.runCount = 0;
      delete script.lastRun;

      this.scripts.set(script.id, script);
      await this.saveScripts();

      return script.id;
    } catch (error) {
      throw new Error('Invalid script data');
    }
  }

  // Private Methods
  private async loadData(): Promise<void> {
    try {
      const [scriptsData, tasksData, macrosData, workflowsData] = await Promise.all([
        AsyncStorage.getItem(this.STORAGE_KEYS.SCRIPTS),
        AsyncStorage.getItem(this.STORAGE_KEYS.TASKS),
        AsyncStorage.getItem(this.STORAGE_KEYS.MACROS),
        AsyncStorage.getItem(this.STORAGE_KEYS.WORKFLOWS)
      ]);

      if (scriptsData) {
        const scripts = JSON.parse(scriptsData);
        scripts.forEach((script: any) => {
          script.createdAt = new Date(script.createdAt);
          script.updatedAt = new Date(script.updatedAt);
          if (script.lastRun) script.lastRun = new Date(script.lastRun);
          this.scripts.set(script.id, script);
        });
      }

      if (tasksData) {
        const tasks = JSON.parse(tasksData);
        tasks.forEach((task: any) => {
          if (task.lastRun) task.lastRun = new Date(task.lastRun);
          if (task.nextRun) task.nextRun = new Date(task.nextRun);
          if (task.lastResult?.timestamp) {
            task.lastResult.timestamp = new Date(task.lastResult.timestamp);
          }
          this.scheduledTasks.set(task.id, task);
        });
      }

      if (macrosData) {
        const macros = JSON.parse(macrosData);
        macros.forEach((macro: any) => {
          macro.createdAt = new Date(macro.createdAt);
          macro.updatedAt = new Date(macro.updatedAt);
          this.macros.set(macro.id, macro);
        });
      }

      if (workflowsData) {
        const workflows = JSON.parse(workflowsData);
        workflows.forEach((workflow: any) => {
          workflow.createdAt = new Date(workflow.createdAt);
          workflow.updatedAt = new Date(workflow.updatedAt);
          this.workflows.set(workflow.id, workflow);
        });
      }
    } catch (error) {
      console.error('Failed to load automation data:', error);
    }
  }

  private async saveScripts(): Promise<void> {
    try {
      const scriptsArray = Array.from(this.scripts.values());
      await AsyncStorage.setItem(this.STORAGE_KEYS.SCRIPTS, JSON.stringify(scriptsArray));
    } catch (error) {
      console.error('Failed to save scripts:', error);
    }
  }

  private async saveScheduledTasks(): Promise<void> {
    try {
      const tasksArray = Array.from(this.scheduledTasks.values());
      await AsyncStorage.setItem(this.STORAGE_KEYS.TASKS, JSON.stringify(tasksArray));
    } catch (error) {
      console.error('Failed to save scheduled tasks:', error);
    }
  }

  private async saveMacros(): Promise<void> {
    try {
      const macrosArray = Array.from(this.macros.values());
      await AsyncStorage.setItem(this.STORAGE_KEYS.MACROS, JSON.stringify(macrosArray));
    } catch (error) {
      console.error('Failed to save macros:', error);
    }
  }

  private async saveWorkflows(): Promise<void> {
    try {
      const workflowsArray = Array.from(this.workflows.values());
      await AsyncStorage.setItem(this.STORAGE_KEYS.WORKFLOWS, JSON.stringify(workflowsArray));
    } catch (error) {
      console.error('Failed to save workflows:', error);
    }
  }

  private startScheduler(): void {
    this.schedulerInterval = setInterval(async () => {
      const now = new Date();
      
      for (const task of this.scheduledTasks.values()) {
        if (task.enabled && task.nextRun && task.nextRun <= now) {
          try {
            const result = await this.runScript(task.scriptId, task.parameters);
            
            task.lastRun = now;
            task.lastResult = result;
            task.runCount++;
            task.nextRun = this.calculateNextRun(task.schedule);
            
            await this.saveScheduledTasks();
          } catch (error) {
            console.error(`Scheduled task execution failed: ${task.name}`, error);
          }
        }
      }
    }, 60000); // Check every minute
  }

  private calculateNextRun(schedule: CronSchedule): Date {
    // Simplified cron calculation - in production, use a proper cron library
    const now = new Date();
    const next = new Date(now);
    
    // For now, just add 1 hour as a placeholder
    next.setHours(next.getHours() + 1);
    
    return next;
  }

  private getScriptExtension(language: string): string {
    switch (language) {
      case 'bash': return 'sh';
      case 'python': return 'py';
      case 'javascript': return 'js';
      case 'powershell': return 'ps1';
      default: return 'txt';
    }
  }

  private getExecutionCommand(language: string, filePath: string): string {
    switch (language) {
      case 'bash': return filePath;
      case 'python': return `python3 ${filePath}`;
      case 'javascript': return `node ${filePath}`;
      case 'powershell': return `powershell -File ${filePath}`;
      default: return `cat ${filePath}`;
    }
  }

  dispose(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
    }
    this.scripts.clear();
    this.scheduledTasks.clear();
    this.macros.clear();
    this.workflows.clear();
    this.runningTasks.clear();
  }
}

export const systemAutomationService = new SystemAutomationService();
