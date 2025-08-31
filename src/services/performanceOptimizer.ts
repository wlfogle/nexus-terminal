import { SystemMetrics, Process, AIInsight } from '@/types';

interface OptimizationRule {
  id: string;
  name: string;
  description: string;
  priority: number;
  condition: (metrics: SystemMetrics, processes: Process[]) => boolean;
  action: (metrics: SystemMetrics, processes: Process[]) => OptimizationAction[];
  enabled: boolean;
}

interface OptimizationAction {
  type: 'kill' | 'renice' | 'limit' | 'cleanup' | 'suggest';
  target: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  reversible: boolean;
  command?: string;
}

interface PerformanceProfile {
  name: string;
  cpuThreshold: number;
  memoryThreshold: number;
  diskThreshold: number;
  aggressiveness: 'conservative' | 'balanced' | 'aggressive';
  rules: string[];
}

class PerformanceOptimizer {
  private rules: OptimizationRule[] = [];
  private profiles: PerformanceProfile[] = [];
  private activeProfile: string = 'balanced';
  private lastOptimization: number = 0;
  private optimizationHistory: OptimizationAction[] = [];
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    this.loadOptimizationRules();
    this.loadPerformanceProfiles();
    this.initialized = true;
    console.log('⚡ Performance Optimizer initialized');
  }

  async analyzeAndOptimize(metrics: SystemMetrics, processes: Process[]): Promise<{
    insights: AIInsight[];
    actions: OptimizationAction[];
    recommendedProfile: string;
  }> {
    const insights: AIInsight[] = [];
    const actions: OptimizationAction[] = [];
    
    const profile = this.profiles.find(p => p.name === this.activeProfile);
    if (!profile) {
      return { insights, actions, recommendedProfile: this.activeProfile };
    }

    // Analyze current performance
    const performanceScore = this.calculatePerformanceScore(metrics, processes);
    
    if (performanceScore < 70) {
      insights.push({
        id: `perf_low_${Date.now()}`,
        type: 'optimization',
        title: 'Performance Degradation Detected',
        description: `System performance score: ${performanceScore}/100. Optimization recommended.`,
        severity: performanceScore < 40 ? 'high' : 'medium',
        timestamp: new Date().toISOString(),
        actionable: true
      });
    }

    // Apply optimization rules
    for (const rule of this.rules.filter(r => r.enabled && profile.rules.includes(r.id))) {
      if (rule.condition(metrics, processes)) {
        const ruleActions = rule.action(metrics, processes);
        actions.push(...ruleActions);
      }
    }

    // Recommend profile changes
    const recommendedProfile = this.recommendProfile(metrics, processes);

    return { insights, actions, recommendedProfile };
  }

  async executeOptimization(action: OptimizationAction): Promise<boolean> {
    try {
      console.log(`⚡ Executing optimization: ${action.description}`);
      
      switch (action.type) {
        case 'kill':
          // Would kill process in real implementation
          break;
        case 'renice':
          // Would change process priority
          break;
        case 'limit':
          // Would set resource limits
          break;
        case 'cleanup':
          // Would clean temporary files
          break;
        case 'suggest':
          // Already handled by returning the action
          break;
      }

      this.optimizationHistory.push({
        ...action,
        description: `${action.description} (executed at ${new Date().toLocaleTimeString()})`
      });

      if (this.optimizationHistory.length > 100) {
        this.optimizationHistory = this.optimizationHistory.slice(-100);
      }

      return true;
    } catch (error) {
      console.error('Optimization failed:', error);
      return false;
    }
  }

  setProfile(profileName: string): boolean {
    const profile = this.profiles.find(p => p.name === profileName);
    if (profile) {
      this.activeProfile = profileName;
      console.log(`⚡ Performance profile set to: ${profileName}`);
      return true;
    }
    return false;
  }

  getOptimizationHistory(): OptimizationAction[] {
    return [...this.optimizationHistory].reverse();
  }

  private calculatePerformanceScore(metrics: SystemMetrics, processes: Process[]): number {
    let score = 100;

    // CPU penalty
    if (metrics.cpu.usage > 80) score -= 30;
    else if (metrics.cpu.usage > 60) score -= 15;

    // Memory penalty
    if (metrics.memory.percentage > 90) score -= 25;
    else if (metrics.memory.percentage > 80) score -= 10;

    // Disk penalty
    if (metrics.disk.percentage > 95) score -= 20;
    else if (metrics.disk.percentage > 85) score -= 10;

    // Load average penalty
    const loadAvg = metrics.loadAverage[0];
    if (loadAvg > metrics.cpu.cores * 2) score -= 20;
    else if (loadAvg > metrics.cpu.cores) score -= 10;

    // Process count penalty
    const processCount = processes.length;
    if (processCount > 500) score -= 15;
    else if (processCount > 300) score -= 8;

    return Math.max(score, 0);
  }

  private recommendProfile(metrics: SystemMetrics, processes: Process[]): string {
    const highUsage = metrics.cpu.usage > 80 || metrics.memory.percentage > 80;
    const veryHighUsage = metrics.cpu.usage > 95 || metrics.memory.percentage > 95;

    if (veryHighUsage) return 'aggressive';
    if (highUsage) return 'balanced';
    return 'conservative';
  }

  private loadOptimizationRules(): void {
    this.rules = [
      {
        id: 'high_memory_cleanup',
        name: 'High Memory Usage Cleanup',
        description: 'Free memory when usage exceeds threshold',
        priority: 1,
        condition: (metrics) => metrics.memory.percentage > 85,
        action: () => [
          {
            type: 'cleanup',
            target: 'memory',
            description: 'Clear system caches and buffers',
            impact: 'medium',
            reversible: false,
            command: 'sync && echo 3 > /proc/sys/vm/drop_caches'
          }
        ],
        enabled: true
      },
      {
        id: 'cpu_hog_detection',
        name: 'CPU Intensive Process Detection',
        description: 'Identify and manage CPU-intensive processes',
        priority: 2,
        condition: (metrics, processes) => 
          metrics.cpu.usage > 80 && processes.some(p => p.cpu > 50),
        action: (metrics, processes) => {
          const cpuHogs = processes
            .filter(p => p.cpu > 50)
            .sort((a, b) => b.cpu - a.cpu)
            .slice(0, 3);

          return cpuHogs.map(process => ({
            type: 'renice' as const,
            target: process.name,
            description: `Lower priority of ${process.name} (PID: ${process.pid}, CPU: ${process.cpu}%)`,
            impact: 'low' as const,
            reversible: true,
            command: `renice +10 ${process.pid}`
          }));
        },
        enabled: true
      },
      {
        id: 'memory_leak_detection',
        name: 'Memory Leak Detection',
        description: 'Detect processes with excessive memory usage',
        priority: 3,
        condition: (metrics, processes) => 
          processes.some(p => p.memory > 30 && p.cpu < 5),
        action: (metrics, processes) => {
          const memoryLeaks = processes
            .filter(p => p.memory > 30 && p.cpu < 5)
            .sort((a, b) => b.memory - a.memory)
            .slice(0, 2);

          return memoryLeaks.map(process => ({
            type: 'suggest' as const,
            target: process.name,
            description: `Investigate ${process.name} for memory leak (PID: ${process.pid}, Memory: ${process.memory}%)`,
            impact: 'high' as const,
            reversible: false
          }));
        },
        enabled: true
      },
      {
        id: 'zombie_process_cleanup',
        name: 'Zombie Process Cleanup',
        description: 'Clean up zombie processes',
        priority: 4,
        condition: (metrics, processes) => 
          processes.some(p => p.status === 'Z'),
        action: (metrics, processes) => {
          const zombies = processes.filter(p => p.status === 'Z');
          return zombies.map(process => ({
            type: 'kill' as const,
            target: process.name,
            description: `Kill zombie process ${process.name} (PID: ${process.pid})`,
            impact: 'low' as const,
            reversible: false,
            command: `kill -9 ${process.pid}`
          }));
        },
        enabled: true
      },
      {
        id: 'disk_cleanup',
        name: 'Disk Space Cleanup',
        description: 'Clean disk space when usage is high',
        priority: 5,
        condition: (metrics) => metrics.disk.percentage > 90,
        action: () => [
          {
            type: 'cleanup',
            target: 'disk',
            description: 'Clean temporary files and logs',
            impact: 'medium',
            reversible: false,
            command: 'find /tmp -type f -atime +7 -delete'
          }
        ],
        enabled: true
      },
      {
        id: 'service_optimization',
        name: 'Service Optimization',
        description: 'Optimize system services',
        priority: 6,
        condition: (metrics, processes) => 
          processes.filter(p => p.name.includes('systemd')).length > 50,
        action: () => [
          {
            type: 'suggest',
            target: 'services',
            description: 'Review and disable unnecessary system services',
            impact: 'medium',
            reversible: true
          }
        ],
        enabled: true
      }
    ];
  }

  private loadPerformanceProfiles(): void {
    this.profiles = [
      {
        name: 'conservative',
        cpuThreshold: 90,
        memoryThreshold: 90,
        diskThreshold: 95,
        aggressiveness: 'conservative',
        rules: ['high_memory_cleanup', 'zombie_process_cleanup', 'disk_cleanup']
      },
      {
        name: 'balanced',
        cpuThreshold: 80,
        memoryThreshold: 85,
        diskThreshold: 90,
        aggressiveness: 'balanced',
        rules: ['high_memory_cleanup', 'cpu_hog_detection', 'memory_leak_detection', 'zombie_process_cleanup', 'disk_cleanup']
      },
      {
        name: 'aggressive',
        cpuThreshold: 70,
        memoryThreshold: 80,
        diskThreshold: 85,
        aggressiveness: 'aggressive',
        rules: ['high_memory_cleanup', 'cpu_hog_detection', 'memory_leak_detection', 'zombie_process_cleanup', 'disk_cleanup', 'service_optimization']
      }
    ];
  }

  dispose(): void {
    this.rules = [];
    this.profiles = [];
    this.optimizationHistory = [];
    this.initialized = false;
  }
}

export const performanceOptimizer = new PerformanceOptimizer();
