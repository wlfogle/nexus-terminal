// Core Types
export interface AppConfig {
  ai: AIConfig
  terminal: TerminalConfig
  appearance: AppearanceConfig
  shortcuts: ShortcutsConfig
}

export interface AIConfig {
  ollama_url: string
  default_model: string
  timeout_seconds: number
  temperature: number
  max_tokens: number
  models: string[]
}

export interface TerminalConfig {
  default_shell?: string
  font_family: string
  font_size: number
  cursor_blink: boolean
  cursor_style: 'block' | 'underline' | 'bar'
  scroll_back: number
  enable_ligatures: boolean
}

export interface AppearanceConfig {
  theme: 'dark' | 'light' | 'auto'
  opacity: number
  blur_background: boolean
  show_tabs: boolean
  show_title_bar: boolean
  custom_css?: string
}

export interface ShortcutsConfig {
  new_terminal: string
  close_terminal: string
  copy: string
  paste: string
  find: string
  ai_chat: string
  command_palette: string
  toggle_ai: string
}

// Terminal Types
export interface TerminalInstance {
  id: string
  name: string
  shell: string
  cwd: string
  created_at: Date
  is_active: boolean
  size: { cols: number; rows: number }
}

export interface CommandBlock {
  id: string
  command: string
  output: string
  exit_code: number
  timestamp: Date
  duration?: number
  is_running: boolean
  ai_suggestions: AISuggestion[]
  tags?: string[]
}

export interface AISuggestion {
  id: string
  type: 'explanation' | 'improvement' | 'alternative' | 'fix'
  content: string
  confidence: number
  action?: string
}

// AI Types
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  mode: AIMode
  attachments?: FileAttachment[]
  metadata?: Record<string, any>
  is_error?: boolean
  tokens_used?: number
}

export interface FileAttachment {
  name: string
  type: string
  content: string
  size?: number
}

export type AIMode = 'chat' | 'crush' | 'pair' | 'wizard' | 'docs' | 'repo' | 'agents'

export interface AIContext {
  type: string
  summary: string
  data: Record<string, any>
  timestamp: Date
}

export interface QuickAction {
  id: string
  emoji: string
  label: string
  description: string
  shortcut?: string
}

// Enhanced AI Types (from starred repos)
export interface Agent {
  id: string
  type: AgentType
  status: AgentStatus
  capabilities: string[]
  context: string
  created_at: Date
  last_activity: Date
}

export type AgentType = 
  | 'code_reviewer'
  | 'code_generator' 
  | 'pair_programmer'
  | 'git_assistant'
  | 'system_analyzer'
  | 'document_writer'
  | 'test_writer'
  | 'debugger'

export type AgentStatus = 'idle' | 'working' | 'waiting_approval' | 'error'

export interface RepositoryContext {
  path: string
  name: string
  file_tree: string
  readme_content?: string
  package_files: Record<string, string>
  git_info: GitInfo
  technology_stack: string[]
  analysis: RepositoryAnalysis
}

export interface GitInfo {
  branch: string
  status: string
  recent_commits: GitCommit[]
  remote_url?: string
  is_clean: boolean
}

export interface GitCommit {
  hash: string
  message: string
  author: string
  date: Date
}

export interface RepositoryAnalysis {
  summary: string
  complexity: 'low' | 'medium' | 'high'
  maintainability: number
  test_coverage?: number
  dependencies: Dependency[]
  issues: CodeIssue[]
  suggestions: string[]
}

export interface Dependency {
  name: string
  version: string
  type: 'runtime' | 'dev' | 'peer'
  security_issues?: SecurityIssue[]
}

export interface SecurityIssue {
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  fix?: string
}

export interface CodeIssue {
  file: string
  line: number
  type: 'error' | 'warning' | 'info'
  message: string
  suggestion?: string
}

// AI Error Analysis
export interface AIError {
  command: string
  output: string
  explanation?: string
  suggestions: string[]
  fixes?: CodeFix[]
}

export interface CodeFix {
  description: string
  code: string
  safe: boolean
  requires_review: boolean
}

// Command Completion
export interface CommandCompletion {
  text: string
  description: string
  type: 'command' | 'flag' | 'file' | 'directory'
  confidence: number
}

// Search Types
export interface SearchResult {
  type: 'file' | 'command' | 'content' | 'documentation'
  title: string
  content: string
  path?: string
  score: number
  context?: string
}

export interface SearchQuery {
  query: string
  type?: 'semantic' | 'fuzzy' | 'exact'
  scope?: 'current_repo' | 'all_repos' | 'history'
  filters?: SearchFilter[]
}

export interface SearchFilter {
  field: string
  operator: 'equals' | 'contains' | 'startsWith' | 'regex'
  value: string
}

// Theme Types
export interface Theme {
  name: string
  type: 'dark' | 'light'
  colors: ThemeColors
  terminal: TerminalTheme
  syntax: SyntaxTheme
}

export interface ThemeColors {
  background: string
  foreground: string
  primary: string
  secondary: string
  accent: string
  error: string
  warning: string
  success: string
  info: string
}

export interface TerminalTheme {
  background: string
  foreground: string
  cursor: string
  selection: string
  black: string
  red: string
  green: string
  yellow: string
  blue: string
  magenta: string
  cyan: string
  white: string
  brightBlack: string
  brightRed: string
  brightGreen: string
  brightYellow: string
  brightBlue: string
  brightMagenta: string
  brightCyan: string
  brightWhite: string
}

export interface SyntaxTheme {
  keyword: string
  string: string
  number: string
  comment: string
  operator: string
  function: string
  variable: string
  type: string
}

// Plugin Types
export interface Plugin {
  id: string
  name: string
  version: string
  description: string
  author: string
  main: string
  permissions: string[]
  config?: Record<string, any>
}

export interface PluginAPI {
  registerCommand(name: string, handler: CommandHandler): void
  registerAIMode(mode: string, handler: AIModeHandler): void
  showNotification(message: string, type?: 'info' | 'warning' | 'error'): void
  getTerminalOutput(terminalId: string): Promise<string>
  executeCommand(command: string): Promise<string>
}

export type CommandHandler = (args: string[]) => Promise<void | string>
export type AIModeHandler = (message: string, context: AIContext) => Promise<string>

// Event Types
export interface TerminalEvent {
  type: 'output' | 'input' | 'resize' | 'exit' | 'error'
  terminal_id: string
  data: any
  timestamp: Date
}

export interface AIEvent {
  type: 'message' | 'mode_change' | 'context_update' | 'error'
  data: any
  timestamp: Date
}

// System Types
export interface SystemInfo {
  os: string
  arch: string
  hostname: string
  user: string
  shell: string
  cwd: string
  memory: MemoryInfo
  cpu: CpuInfo
  disk: DiskInfo[]
}

export interface MemoryInfo {
  total: number
  used: number
  free: number
  available: number
}

export interface CpuInfo {
  model: string
  cores: number
  usage: number
  temperature?: number
}

export interface DiskInfo {
  device: string
  mount: string
  size: number
  used: number
  available: number
  filesystem: string
}

// Utility Types
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error'
export type LoadingState = 'idle' | 'loading' | 'success' | 'error'

export interface APIResponse<T> {
  success: boolean
  data?: T
  error?: string
  timestamp: Date
}

export interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  duration?: number
  actions?: NotificationAction[]
}

export interface NotificationAction {
  label: string
  action: () => void
  style?: 'primary' | 'secondary'
}

// Keyboard Shortcuts
export interface KeyboardShortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
  description: string
  action: () => void
}

// Export all types as default
export default {
  // Configuration
  AppConfig,
  AIConfig,
  TerminalConfig,
  AppearanceConfig,
  ShortcutsConfig,
  
  // Terminal
  TerminalInstance,
  CommandBlock,
  AISuggestion,
  
  // AI
  ChatMessage,
  FileAttachment,
  AIContext,
  QuickAction,
  Agent,
  RepositoryContext,
  GitInfo,
  GitCommit,
  RepositoryAnalysis,
  AIError,
  CodeFix,
  CommandCompletion,
  
  // Search
  SearchResult,
  SearchQuery,
  SearchFilter,
  
  // Theme
  Theme,
  ThemeColors,
  TerminalTheme,
  SyntaxTheme,
  
  // System
  SystemInfo,
  MemoryInfo,
  CpuInfo,
  DiskInfo,
  
  // Events
  TerminalEvent,
  AIEvent,
  
  // Utils
  Notification,
  NotificationAction,
  KeyboardShortcut
}
