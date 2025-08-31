export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  role: 'admin' | 'user';
  lastLogin?: string;
  preferences?: {
    theme: 'light' | 'dark';
    notifications: boolean;
    autoConnect: boolean;
  };
}

export interface Connection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  lastConnected?: string;
  type: 'ssh' | 'telnet';
  saved: boolean;
}

export interface SystemMetrics {
  timestamp: string;
  cpu: {
    usage: number;
    cores: number;
    frequency: number;
    temperature?: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
    swap?: {
      total: number;
      used: number;
      free: number;
    };
  };
  disk: {
    total: number;
    used: number;
    free: number;
    percentage: number;
    reads?: number;
    writes?: number;
  };
  network?: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
    interfaces: NetworkInterface[];
  };
  loadAverage: number[];
  uptime: number;
}

export interface NetworkInterface {
  name: string;
  ip: string;
  mac: string;
  type: string;
  speed?: number;
  status: 'up' | 'down';
}

export interface Process {
  pid: number;
  name: string;
  user: string;
  cpu: number;
  memory: number;
  status: string;
  command: string;
  startTime?: string;
  threads?: number;
}

export interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink';
  size: number;
  permissions: string;
  owner: string;
  group: string;
  modified: string;
  hidden: boolean;
}

export interface TerminalSession {
  id: string;
  name: string;
  active: boolean;
  output: string;
  history: string[];
  workingDirectory: string;
  environment: Record<string, string>;
}

export interface Command {
  id: string;
  command: string;
  timestamp: string;
  output: string;
  exitCode: number;
  duration: number;
  sessionId: string;
}

export interface AIInsight {
  id: string;
  type: 'performance' | 'security' | 'optimization' | 'warning' | 'info';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  actionable: boolean;
}

export interface Prediction {
  id: string;
  metric: string;
  prediction: number;
  confidence: number;
  timeframe: string;
  reasoning: string;
}

export interface SecurityThreat {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  source: string;
  target: string;
  timestamp: string;
  blocked: boolean;
  data: any;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'alert' | 'success';
  priority: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  data?: any;
  actions?: {
    id: string;
    label: string;
    type: 'navigate' | 'action';
  }[];
}
