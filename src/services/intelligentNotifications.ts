import { SystemMetrics, Process, AIInsight, Notification } from '@/types';

interface NotificationRule {
  id: string;
  name: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  condition: (data: any) => boolean;
  template: (data: any) => Notification;
  cooldown: number;
  enabled: boolean;
  lastTriggered?: number;
}

interface NotificationChannel {
  id: string;
  name: string;
  type: 'push' | 'email' | 'sms' | 'webhook';
  config: any;
  enabled: boolean;
}

class IntelligentNotificationSystem {
  private rules: NotificationRule[] = [];
  private channels: NotificationChannel[] = [];
  private notificationQueue: Notification[] = [];
  private sentNotifications: Map<string, number> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    this.loadNotificationRules();
    this.loadNotificationChannels();
    this.initialized = true;
    console.log('🔔 Intelligent Notification System initialized');
  }

  async processSystemUpdate(metrics: SystemMetrics, processes: Process[]): Promise<Notification[]> {
    const notifications: Notification[] = [];
    const now = Date.now();

    for (const rule of this.rules.filter(r => r.enabled)) {
      // Check cooldown
      if (rule.lastTriggered && (now - rule.lastTriggered) < rule.cooldown) {
        continue;
      }

      const data = { metrics, processes, timestamp: now };
      
      if (rule.condition(data)) {
        const notification = rule.template(data);
        notifications.push(notification);
        rule.lastTriggered = now;
      }
    }

    // Add to queue and process
    this.notificationQueue.push(...notifications);
    await this.processNotificationQueue();

    return notifications;
  }

  async processInsights(insights: AIInsight[]): Promise<Notification[]> {
    const notifications: Notification[] = [];

    for (const insight of insights) {
      if (insight.severity === 'high' || insight.severity === 'critical') {
        const notification: Notification = {
          id: `insight_${insight.id}`,
          title: insight.title,
          message: insight.description,
          type: 'alert',
          priority: insight.severity === 'critical' ? 'critical' : 'high',
          timestamp: insight.timestamp,
          data: insight,
          actions: insight.actionable ? [
            { id: 'view_details', label: 'View Details', type: 'navigate' }
          ] : undefined
        };

        notifications.push(notification);
      }
    }

    this.notificationQueue.push(...notifications);
    await this.processNotificationQueue();

    return notifications;
  }

  async sendNotification(notification: Notification, channelId?: string): Promise<boolean> {
    try {
      const channels = channelId 
        ? this.channels.filter(c => c.id === channelId && c.enabled)
        : this.channels.filter(c => c.enabled);

      for (const channel of channels) {
        await this.sendToChannel(notification, channel);
      }

      // Track sent notification
      this.sentNotifications.set(notification.id, Date.now());
      
      // Clean old tracking entries
      if (this.sentNotifications.size > 1000) {
        const entries = Array.from(this.sentNotifications.entries());
        const recent = entries.slice(-500);
        this.sentNotifications = new Map(recent);
      }

      return true;
    } catch (error) {
      console.error('Failed to send notification:', error);
      return false;
    }
  }

  getRecentNotifications(limit: number = 50): Notification[] {
    return Array.from(this.sentNotifications.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([id]) => this.notificationQueue.find(n => n.id === id))
      .filter(Boolean) as Notification[];
  }

  enableRule(ruleId: string): void {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = true;
    }
  }

  disableRule(ruleId: string): void {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = false;
    }
  }

  private async processNotificationQueue(): Promise<void> {
    const highPriority = this.notificationQueue.filter(n => n.priority === 'critical' || n.priority === 'high');
    const mediumPriority = this.notificationQueue.filter(n => n.priority === 'medium');
    const lowPriority = this.notificationQueue.filter(n => n.priority === 'low');

    // Process in priority order
    for (const notification of [...highPriority, ...mediumPriority, ...lowPriority]) {
      await this.sendNotification(notification);
    }

    this.notificationQueue = [];
  }

  private async sendToChannel(notification: Notification, channel: NotificationChannel): Promise<void> {
    console.log(`📱 Sending notification via ${channel.name}: ${notification.title}`);
    
    switch (channel.type) {
      case 'push':
        // Would send push notification
        break;
      case 'email':
        // Would send email
        break;
      case 'sms':
        // Would send SMS
        break;
      case 'webhook':
        // Would call webhook
        break;
    }
  }

  private loadNotificationRules(): void {
    this.rules = [
      {
        id: 'cpu_spike',
        name: 'CPU Usage Spike',
        priority: 'high',
        condition: (data) => data.metrics.cpu.usage > 90,
        template: (data) => ({
          id: `cpu_spike_${Date.now()}`,
          title: 'High CPU Usage Alert',
          message: `CPU usage has reached ${data.metrics.cpu.usage.toFixed(1)}%`,
          type: 'alert',
          priority: 'high',
          timestamp: new Date(data.timestamp).toISOString(),
          data: { metric: 'cpu', value: data.metrics.cpu.usage }
        }),
        cooldown: 300000, // 5 minutes
        enabled: true
      },
      {
        id: 'memory_critical',
        name: 'Critical Memory Usage',
        priority: 'critical',
        condition: (data) => data.metrics.memory.percentage > 95,
        template: (data) => ({
          id: `memory_critical_${Date.now()}`,
          title: 'Critical Memory Usage',
          message: `Memory usage is critically high at ${data.metrics.memory.percentage.toFixed(1)}%`,
          type: 'alert',
          priority: 'critical',
          timestamp: new Date(data.timestamp).toISOString(),
          data: { metric: 'memory', value: data.metrics.memory.percentage }
        }),
        cooldown: 180000, // 3 minutes
        enabled: true
      },
      {
        id: 'disk_full',
        name: 'Disk Space Full',
        priority: 'critical',
        condition: (data) => data.metrics.disk.percentage > 98,
        template: (data) => ({
          id: `disk_full_${Date.now()}`,
          title: 'Disk Space Critical',
          message: `Disk usage has reached ${data.metrics.disk.percentage.toFixed(1)}%`,
          type: 'alert',
          priority: 'critical',
          timestamp: new Date(data.timestamp).toISOString(),
          data: { metric: 'disk', value: data.metrics.disk.percentage }
        }),
        cooldown: 600000, // 10 minutes
        enabled: true
      },
      {
        id: 'process_crash',
        name: 'Process Crash Detection',
        priority: 'medium',
        condition: (data) => data.processes.some((p: Process) => p.status === 'Z'),
        template: (data) => {
          const zombies = data.processes.filter((p: Process) => p.status === 'Z');
          return {
            id: `process_crash_${Date.now()}`,
            title: 'Process Crash Detected',
            message: `${zombies.length} zombie process(es) detected`,
            type: 'info',
            priority: 'medium',
            timestamp: new Date(data.timestamp).toISOString(),
            data: { zombies: zombies.map((p: Process) => ({ name: p.name, pid: p.pid })) }
          };
        },
        cooldown: 900000, // 15 minutes
        enabled: true
      },
      {
        id: 'load_average_high',
        name: 'High Load Average',
        priority: 'medium',
        condition: (data) => data.metrics.loadAverage[0] > data.metrics.cpu.cores * 2,
        template: (data) => ({
          id: `load_high_${Date.now()}`,
          title: 'High System Load',
          message: `Load average is ${data.metrics.loadAverage[0].toFixed(2)} (cores: ${data.metrics.cpu.cores})`,
          type: 'warning',
          priority: 'medium',
          timestamp: new Date(data.timestamp).toISOString(),
          data: { loadAverage: data.metrics.loadAverage[0], cores: data.metrics.cpu.cores }
        }),
        cooldown: 600000, // 10 minutes
        enabled: true
      },
      {
        id: 'performance_degradation',
        name: 'Performance Degradation',
        priority: 'medium',
        condition: (data) => 
          data.metrics.cpu.usage > 80 && 
          data.metrics.memory.percentage > 80 &&
          data.metrics.loadAverage[0] > data.metrics.cpu.cores,
        template: (data) => ({
          id: `perf_degradation_${Date.now()}`,
          title: 'Performance Degradation',
          message: 'System performance has significantly degraded across multiple metrics',
          type: 'warning',
          priority: 'medium',
          timestamp: new Date(data.timestamp).toISOString(),
          data: {
            cpu: data.metrics.cpu.usage,
            memory: data.metrics.memory.percentage,
            load: data.metrics.loadAverage[0]
          }
        }),
        cooldown: 1800000, // 30 minutes
        enabled: true
      }
    ];
  }

  private loadNotificationChannels(): void {
    this.channels = [
      {
        id: 'push_notifications',
        name: 'Push Notifications',
        type: 'push',
        config: {
          sound: true,
          vibrate: true,
          badge: true
        },
        enabled: true
      },
      {
        id: 'console_log',
        name: 'Console Log',
        type: 'push',
        config: {},
        enabled: true
      }
    ];
  }

  dispose(): void {
    this.rules = [];
    this.channels = [];
    this.notificationQueue = [];
    this.sentNotifications.clear();
    this.initialized = false;
  }
}

export const intelligentNotifications = new IntelligentNotificationSystem();
