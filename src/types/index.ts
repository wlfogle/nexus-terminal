// Connection Types
export interface ConnectionConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  secure: boolean;
  autoConnect: boolean;
  timeout: number;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// Authentication Types
export type AuthMethod = 'token' | 'password' | 'certificate';

export interface AuthConfig {
  method: AuthMethod;
  token?: string;
  username?: string;
  password?: string;
  certificate?: string;
  privateKey?: string;
}

// System Types
export interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    model: string;
  };
  memory: {
    total: number;
    used: number;
    available: number;
    percentage: number;
  };
  disk: {
    total: number;
    used: number;
    available: number;
    percentage: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
  };
  uptime: number;
  loadAverage: number[];
}

export interface Process {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  status: string;
  user: string;
  command: string;
}

export interface Service {
  name: string;
  status: 'active' | 'inactive' | 'failed' | 'unknown';
  enabled: boolean;
  description: string;
}

// File System Types
export interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink';
  size: number;
  permissions: string;
  owner: string;
  group: string;
  modified: string;
  isHidden: boolean;
}

export interface FileOperation {
  type: 'copy' | 'cut';
  files: FileItem[];
  source: string;
}

// Terminal Types
export interface TerminalSession {
  id: string;
  name: string;
  isActive: boolean;
  currentDirectory: string;
  lastActivity: string;
}

export interface CommandHistory {
  id: string;
  command: string;
  timestamp: string;
  output: string;
  exitCode: number;
  sessionId: string;
}

// Ecosystem Types
export interface AIInsight {
  id: string;
  type: 'performance' | 'security' | 'optimization' | 'warning';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: string;
  actionable: boolean;
}

export interface Recommendation {
  id: string;
  category: string;
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  commands?: string[];
}

export interface SystemPattern {
  id: string;
  pattern: string;
  frequency: number;
  impact: string;
  discovered: string;
}

export interface Prediction {
  id: string;
  metric: string;
  prediction: number;
  confidence: number;
  timeframe: string;
  reasoning: string;
}

// Redux State Types
export interface RootState {
  connection: {
    status: ConnectionStatus;
    config: ConnectionConfig | null;
    error: string | null;
    lastConnected: string | null;
    profiles: ConnectionConfig[];
  };
  auth: {
    method: AuthMethod;
    token?: string;
    credentials?: object;
    isAuthenticated: boolean;
    error: string | null;
  };
  system: {
    metrics: SystemMetrics | null;
    processes: Process[];
    services: Service[];
    lastUpdate: string | null;
    loading: boolean;
  };
  files: {
    currentPath: string;
    files: FileItem[];
    selectedFiles: string[];
    clipboard: FileOperation | null;
    loading: boolean;
    error: string | null;
  };
  terminal: {
    sessions: TerminalSession[];
    activeSession: string | null;
    history: CommandHistory[];
    output: string;
    loading: boolean;
  };
  ecosystem: {
    insights: AIInsight[];
    recommendations: Recommendation[];
    patterns: SystemPattern[];
    predictions: Prediction[];
    loading: boolean;
  };
}
