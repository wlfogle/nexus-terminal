import { Process, SecurityThreat, AIInsight } from '@/types';
import { neuralEngine } from './neuralEngine';

interface SecurityRule {
  id: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  pattern: RegExp | ((data: any) => boolean);
  action: 'log' | 'alert' | 'block' | 'kill';
  enabled: boolean;
}

interface SecurityEvent {
  id: string;
  timestamp: number;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  target?: string;
  description: string;
  data: any;
  blocked: boolean;
  resolved: boolean;
}

class AutonomousSecurityService {
  private rules: SecurityRule[] = [];
  private events: SecurityEvent[] = [];
  private whitelist: Set<string> = new Set();
  private monitoring = false;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    this.loadDefaultRules();
    this.initialized = true;
    console.log('🛡️ Autonomous Security Monitor initialized');
  }

  startMonitoring(): void {
    if (this.monitoring) return;
    this.monitoring = true;
    console.log('🛡️ Security monitoring started');
  }

  stopMonitoring(): void {
    this.monitoring = false;
    console.log('🛡️ Security monitoring stopped');
  }

  async analyzeProcesses(processes: Process[]): Promise<SecurityThreat[]> {
    if (!this.monitoring) return [];

    const threats: SecurityThreat[] = [];

    for (const process of processes) {
      const processThreats = await this.evaluateProcess(process);
      threats.push(...processThreats);
    }

    return threats.sort((a, b) => this.getSeverityScore(b.severity) - this.getSeverityScore(a.severity));
  }

  async evaluateProcess(process: Process): Promise<SecurityThreat[]> {
    const threats: SecurityThreat[] = [];

    // Check against security rules
    for (const rule of this.rules.filter(r => r.enabled)) {
      let matches = false;

      if (rule.pattern instanceof RegExp) {
        matches = rule.pattern.test(process.command) || rule.pattern.test(process.name);
      } else if (typeof rule.pattern === 'function') {
        matches = rule.pattern(process);
      }

      if (matches && !this.whitelist.has(process.name)) {
        const threat: SecurityThreat = {
          id: `threat_${Date.now()}_${process.pid}`,
          type: rule.name,
          severity: rule.severity,
          description: `${rule.description}: ${process.name} (PID: ${process.pid})`,
          source: process.name,
          target: process.user,
          timestamp: new Date().toISOString(),
          blocked: false,
          data: {
            process,
            rule: rule.id,
            command: process.command
          }
        };

        threats.push(threat);

        // Execute rule action
        await this.executeAction(rule, threat, process);
      }
    }

    return threats;
  }

  async getSecurityInsights(): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];

    // Recent threat analysis
    const recentThreats = this.events.filter(e => Date.now() - e.timestamp < 3600000);
    if (recentThreats.length > 5) {
      insights.push({
        id: `security_spike_${Date.now()}`,
        type: 'warning',
        title: 'High Security Activity',
        description: `${recentThreats.length} security events detected in the last hour`,
        severity: 'medium',
        timestamp: new Date().toISOString(),
        actionable: true
      });
    }

    // Critical unresolved threats
    const criticalThreats = this.events.filter(e => e.severity === 'critical' && !e.resolved);
    if (criticalThreats.length > 0) {
      insights.push({
        id: `critical_threats_${Date.now()}`,
        type: 'warning',
        title: 'Critical Threats Active',
        description: `${criticalThreats.length} critical security threats require immediate attention`,
        severity: 'high',
        timestamp: new Date().toISOString(),
        actionable: true
      });
    }

    return insights;
  }

  addToWhitelist(processName: string): void {
    this.whitelist.add(processName);
  }

  removeFromWhitelist(processName: string): void {
    this.whitelist.delete(processName);
  }

  getSecurityEvents(limit: number = 100): SecurityEvent[] {
    return this.events
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  resolveEvent(eventId: string): void {
    const event = this.events.find(e => e.id === eventId);
    if (event) {
      event.resolved = true;
    }
  }

  private loadDefaultRules(): void {
    this.rules = [
      {
        id: 'suspicious_tmp_execution',
        name: 'Suspicious Temp Execution',
        description: 'Process executing from temporary directory',
        severity: 'high',
        pattern: /\/(tmp|temp)\/.*$/,
        action: 'alert',
        enabled: true
      },
      {
        id: 'high_cpu_usage',
        name: 'High CPU Usage',
        description: 'Process consuming excessive CPU resources',
        severity: 'medium',
        pattern: (process: Process) => process.cpu > 90,
        action: 'log',
        enabled: true
      },
      {
        id: 'root_process_anomaly',
        name: 'Root Process Anomaly',
        description: 'Unexpected root process detected',
        severity: 'high',
        pattern: (process: Process) => 
          process.user === 'root' && 
          !['init', 'kthreadd', 'ksoftirqd', 'migration', 'rcu_', 'watchdog'].some(sys => 
            process.name.includes(sys)
          ),
        action: 'alert',
        enabled: true
      },
      {
        id: 'network_scanner',
        name: 'Network Scanner',
        description: 'Potential network scanning activity',
        severity: 'medium',
        pattern: /(nmap|masscan|zmap|netcat|nc)\s/,
        action: 'log',
        enabled: true
      },
      {
        id: 'privilege_escalation',
        name: 'Privilege Escalation',
        description: 'Potential privilege escalation attempt',
        severity: 'critical',
        pattern: /(sudo|su|pkexec|doas)\s+(bash|sh|zsh|fish)/,
        action: 'alert',
        enabled: true
      },
      {
        id: 'crypto_mining',
        name: 'Cryptocurrency Mining',
        description: 'Potential cryptocurrency mining activity',
        severity: 'high',
        pattern: /(xmrig|cgminer|bfgminer|cpuminer|minerd)/,
        action: 'block',
        enabled: true
      },
      {
        id: 'reverse_shell',
        name: 'Reverse Shell',
        description: 'Potential reverse shell connection',
        severity: 'critical',
        pattern: /(bash|sh|zsh)\s+.*\/dev\/tcp/,
        action: 'block',
        enabled: true
      },
      {
        id: 'suspicious_download',
        name: 'Suspicious Download',
        description: 'Download from suspicious source',
        severity: 'medium',
        pattern: /(wget|curl).*\.(sh|py|pl|exe)$/,
        action: 'alert',
        enabled: true
      }
    ];
  }

  private async executeAction(rule: SecurityRule, threat: SecurityThreat, process: Process): Promise<void> {
    const event: SecurityEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type: rule.name,
      severity: rule.severity,
      source: process.name,
      target: process.user,
      description: threat.description,
      data: { process, rule: rule.id },
      blocked: false,
      resolved: false
    };

    switch (rule.action) {
      case 'log':
        console.log(`🛡️ Security Log: ${threat.description}`);
        break;

      case 'alert':
        console.warn(`🚨 Security Alert: ${threat.description}`);
        break;

      case 'block':
        console.error(`🛡️ Security Block: ${threat.description}`);
        event.blocked = true;
        break;

      case 'kill':
        console.error(`💀 Security Kill: ${threat.description}`);
        event.blocked = true;
        break;
    }

    this.events.push(event);
    
    // Keep only last 1000 events
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }

    // Learn from security events
    if (neuralEngine) {
      try {
        await neuralEngine.learnFromUserBehavior(
          `security_${rule.name}`, 
          { process, threat }, 
          'error'
        );
      } catch (error) {
        console.error('Failed to record security event for learning:', error);
      }
    }
  }

  private getSeverityScore(severity: string): number {
    switch (severity) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 0;
    }
  }

  dispose(): void {
    this.stopMonitoring();
    this.rules = [];
    this.events = [];
    this.whitelist.clear();
    this.initialized = false;
  }
}

export const autonomousSecurity = new AutonomousSecurityService();
