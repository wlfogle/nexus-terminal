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

// User Types
export interface User {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  avatar?: string;
  isActive: boolean;
  lastLogin?: Date;
  permissions: string[];
  preferences: UserPreferences;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  notifications: NotificationSettings;
  terminal: TerminalPreferences;
  security: SecurityPreferences;
}

export interface NotificationSettings {
  push: boolean;
  email: boolean;
  sound: boolean;
  vibration: boolean;
  categories: Record<string, boolean>;
}

export interface TerminalPreferences {
  fontSize: number;
  fontFamily: string;
  cursorStyle: 'block' | 'underline' | 'bar';
  cursorBlink: boolean;
  theme: string;
  scrollback: number;
}

export interface SecurityPreferences {
  biometricAuth: boolean;
  sessionTimeout: number;
  autoLock: boolean;
  requireReauth: boolean;
}

// Connection Types (Extended)
export interface Connection {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol: 'ssh' | 'telnet' | 'rdp';
  authentication: ConnectionAuth;
  settings: ConnectionSettings;
  status: ConnectionStatus;
  lastUsed?: Date;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  favorite: boolean;
}

export interface ConnectionAuth {
  method: 'password' | 'key' | 'certificate' | 'agent';
  username: string;
  password?: string;
  privateKey?: string;
  publicKey?: string;
  passphrase?: string;
  certificate?: string;
}

export interface ConnectionSettings {
  timeout: number;
  keepAlive: boolean;
  compression: boolean;
  jumpHost?: string;
  localPort?: number;
  remotePort?: number;
  encoding: string;
  terminalType: string;
}

// Command Types
export interface Command {
  id: string;
  command: string;
  description?: string;
  category?: string;
  parameters?: CommandParameter[];
  examples?: string[];
  dangerous?: boolean;
  requiresRoot?: boolean;
  platforms: string[];
  tags: string[];
  createdAt: Date;
  usageCount: number;
}

export interface CommandParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'file' | 'directory';
  required: boolean;
  defaultValue?: any;
  description: string;
  validation?: string;
  options?: string[];
}

export interface CommandExecution {
  id: string;
  command: string;
  sessionId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  exitCode?: number;
  output: string;
  error?: string;
  duration?: number;
  workingDirectory: string;
  environment: Record<string, string>;
}

// Notification Types
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  read: boolean;
  timestamp: Date;
  expiresAt?: Date;
  actions?: NotificationAction[];
  data?: Record<string, any>;
}

export interface NotificationAction {
  id: string;
  label: string;
  action: string;
  style: 'default' | 'destructive';
}

// Security Types
export interface SecurityThreat {
  id: string;
  type: 'malware' | 'intrusion' | 'anomaly' | 'vulnerability';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  detectedAt: Date;
  source: string;
  indicators: string[];
  mitigated: boolean;
  mitigationSteps?: string[];
  affectedSystems: string[];
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  details?: Record<string, any>;
  riskScore?: number;
}

// Script Types
export interface Script {
  id: string;
  name: string;
  description?: string;
  content: string;
  language: 'bash' | 'python' | 'javascript' | 'powershell';
  parameters?: ScriptParameter[];
  tags: string[];
  category?: string;
  isTemplate: boolean;
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  version: string;
  runCount: number;
  lastRun?: Date;
}

export interface ScriptParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'file' | 'directory' | 'select';
  required: boolean;
  defaultValue?: any;
  description: string;
  validation?: string;
  options?: string[];
  sensitive?: boolean;
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
