import { io, Socket } from 'socket.io-client';
import { TerminalSession, Command } from '@/types';

class TerminalService {
  private socket: Socket | null = null;
  private sessions: Map<string, TerminalSession> = new Map();
  private activeSessionId: string | null = null;
  private commandHistory: Command[] = [];
  private outputCallbacks: ((output: string, sessionId: string) => void)[] = [];
  private sessionCallbacks: ((sessions: TerminalSession[]) => void)[] = [];
  private connectionInfo: { host: string; port: number } | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  async connect(host: string, port: number): Promise<boolean> {
    try {
      this.connectionInfo = { host, port };
      
      this.socket = io(`ws://${host}:${port}`, {
        transports: ['websocket'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000
      });

      return new Promise((resolve) => {
        this.socket!.on('connect', () => {
          console.log('Terminal WebSocket connected');
          this.reconnectAttempts = 0;
          this.setupEventHandlers();
          resolve(true);
        });

        this.socket!.on('connect_error', (error) => {
          console.error('Terminal connection failed:', error);
          resolve(false);
        });
      });
    } catch (error) {
      console.error('Terminal connection failed:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.sessions.clear();
    this.activeSessionId = null;
    this.connectionInfo = null;
  }

  async executeCommand(command: string, sessionId?: string): Promise<{
    output: string;
    exitCode: number;
    duration: number;
  }> {
    try {
      if (!this.socket || !this.socket.connected) {
        throw new Error('Not connected to terminal server');
      }

      const targetSessionId = sessionId || this.activeSessionId;
      if (!targetSessionId) {
        throw new Error('No active session');
      }

      const startTime = Date.now();
      const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Command execution timeout'));
        }, 30000);

        this.socket!.emit('execute_command', {
          commandId,
          sessionId: targetSessionId,
          command
        });

        this.socket!.once(`command_result_${commandId}`, (result) => {
          clearTimeout(timeout);
          const duration = Date.now() - startTime;
          
          const commandRecord: Command = {
            id: commandId,
            command,
            timestamp: new Date().toISOString(),
            output: result.output || '',
            exitCode: result.exitCode || 0,
            duration,
            sessionId: targetSessionId
          };

          this.commandHistory.push(commandRecord);
          if (this.commandHistory.length > 1000) {
            this.commandHistory = this.commandHistory.slice(-1000);
          }

          resolve({
            output: result.output || '',
            exitCode: result.exitCode || 0,
            duration
          });
        });
      });
    } catch (error) {
      console.error('Command execution failed:', error);
      throw error;
    }
  }

  async createSession(name: string): Promise<string> {
    if (!this.socket || !this.socket.connected) {
      throw new Error('Not connected to terminal server');
    }

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      this.socket!.emit('create_session', { sessionId, name });
      
      this.socket!.once(`session_created_${sessionId}`, (data) => {
        const session: TerminalSession = {
          id: sessionId,
          name,
          active: false,
          output: '',
          history: [],
          workingDirectory: data.workingDirectory || '/home',
          environment: data.environment || {}
        };

        this.sessions.set(sessionId, session);
        this.notifySessionChange();
        resolve(sessionId);
      });

      setTimeout(() => reject(new Error('Session creation timeout')), 10000);
    });
  }

  async switchSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // Deactivate current session
    if (this.activeSessionId) {
      const currentSession = this.sessions.get(this.activeSessionId);
      if (currentSession) {
        currentSession.active = false;
      }
    }

    // Activate new session
    session.active = true;
    this.activeSessionId = sessionId;

    if (this.socket) {
      this.socket.emit('switch_session', { sessionId });
    }

    this.notifySessionChange();
    return true;
  }

  async terminateSession(sessionId: string): Promise<boolean> {
    if (!this.socket || !this.socket.connected) {
      return false;
    }

    const session = this.sessions.get(sessionId);
    if (!session) return false;

    return new Promise((resolve) => {
      this.socket!.emit('terminate_session', { sessionId });
      
      this.socket!.once(`session_terminated_${sessionId}`, () => {
        this.sessions.delete(sessionId);
        
        if (this.activeSessionId === sessionId) {
          this.activeSessionId = null;
          // Switch to another session if available
          const remainingSessions = Array.from(this.sessions.keys());
          if (remainingSessions.length > 0) {
            this.switchSession(remainingSessions[0]);
          }
        }
        
        this.notifySessionChange();
        resolve(true);
      });

      setTimeout(() => resolve(false), 5000);
    });
  }

  getActiveSessions(): TerminalSession[] {
    return Array.from(this.sessions.values());
  }

  getActiveSession(): TerminalSession | null {
    if (!this.activeSessionId) return null;
    return this.sessions.get(this.activeSessionId) || null;
  }

  getCommandHistory(sessionId?: string): Command[] {
    if (sessionId) {
      return this.commandHistory.filter(cmd => cmd.sessionId === sessionId);
    }
    return this.commandHistory;
  }

  onOutput(callback: (output: string, sessionId: string) => void): void {
    this.outputCallbacks.push(callback);
  }

  onSessionChange(callback: (sessions: TerminalSession[]) => void): void {
    this.sessionCallbacks.push(callback);
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('output', (data) => {
      const { sessionId, output } = data;
      const session = this.sessions.get(sessionId);
      
      if (session) {
        session.output += output;
        // Keep output history reasonable
        if (session.output.length > 100000) {
          session.output = session.output.slice(-80000);
        }
      }

      this.outputCallbacks.forEach(callback => {
        try {
          callback(output, sessionId);
        } catch (error) {
          console.error('Output callback error:', error);
        }
      });
    });

    this.socket.on('session_update', (data) => {
      const { sessionId, workingDirectory, environment } = data;
      const session = this.sessions.get(sessionId);
      
      if (session) {
        if (workingDirectory) session.workingDirectory = workingDirectory;
        if (environment) session.environment = { ...session.environment, ...environment };
        this.notifySessionChange();
      }
    });

    this.socket.on('disconnect', () => {
      console.log('Terminal WebSocket disconnected');
      this.handleDisconnection();
    });

    this.socket.on('reconnect', () => {
      console.log('Terminal WebSocket reconnected');
      this.handleReconnection();
    });
  }

  private handleDisconnection(): void {
    // Mark all sessions as inactive
    this.sessions.forEach(session => {
      session.active = false;
    });
    this.notifySessionChange();
  }

  private async handleReconnection(): Promise<void> {
    // Restore sessions after reconnection
    const sessionIds = Array.from(this.sessions.keys());
    
    for (const sessionId of sessionIds) {
      try {
        this.socket!.emit('restore_session', { sessionId });
      } catch (error) {
        console.error(`Failed to restore session ${sessionId}:`, error);
      }
    }
  }

  private notifySessionChange(): void {
    const sessions = this.getActiveSessions();
    this.sessionCallbacks.forEach(callback => {
      try {
        callback(sessions);
      } catch (error) {
        console.error('Session callback error:', error);
      }
    });
  }

  dispose(): void {
    this.disconnect();
    this.outputCallbacks = [];
    this.sessionCallbacks = [];
    this.commandHistory = [];
  }
}

export const terminalService = new TerminalService();
