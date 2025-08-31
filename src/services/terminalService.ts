import { TerminalSession, CommandHistory } from '@/types';
import { connectionService } from './connectionService';
import { authService } from './authService';

class TerminalService {
  private async getAuthHeaders() {
    const token = await authService.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async createSession(name: string): Promise<TerminalSession> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    const headers = await this.getAuthHeaders();
    const response = await httpClient.post('/api/terminal/create', {
      name,
    }, { headers });
    
    return response.data;
  }

  async executeCommand(sessionId: string, command: string): Promise<CommandHistory> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    const headers = await this.getAuthHeaders();
    const response = await httpClient.post('/api/terminal/execute', {
      sessionId,
      command,
    }, { headers });

    return response.data;
  }

  async terminateSession(sessionId: string): Promise<void> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    const headers = await this.getAuthHeaders();
    await httpClient.delete(`/api/terminal/session/${sessionId}`, { headers });
  }

  async getHistory(sessionId: string): Promise<CommandHistory[]> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    const headers = await this.getAuthHeaders();
    const response = await httpClient.get(`/api/terminal/history/${sessionId}`, { headers });
    return response.data;
  }

  async getAllSessions(): Promise<TerminalSession[]> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    const headers = await this.getAuthHeaders();
    const response = await httpClient.get('/api/terminal/sessions', { headers });
    return response.data;
  }

  async clearHistory(sessionId: string): Promise<void> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    const headers = await this.getAuthHeaders();
    await httpClient.delete(`/api/terminal/history/${sessionId}`, { headers });
  }

  async changeDirectory(sessionId: string, path: string): Promise<void> {
    await this.executeCommand(sessionId, `cd ${path}`);
  }

  async getCurrentDirectory(sessionId: string): Promise<string> {
    const result = await this.executeCommand(sessionId, 'pwd');
    return result.output.trim();
  }

  // WebSocket event handlers for real-time terminal updates
  subscribeToTerminalOutput(callback: (data: any) => void): void {
    const wsClient = connectionService.getWsClient();
    if (!wsClient) {
      throw new Error('No active WebSocket connection');
    }

    wsClient.on('terminal_output', callback);
  }

  subscribeToCommandExecution(callback: (data: CommandHistory) => void): void {
    const wsClient = connectionService.getWsClient();
    if (!wsClient) {
      throw new Error('No active WebSocket connection');
    }

    wsClient.on('command_executed', callback);
  }

  subscribeToSessionEvents(callback: (data: any) => void): void {
    const wsClient = connectionService.getWsClient();
    if (!wsClient) {
      throw new Error('No active WebSocket connection');
    }

    wsClient.on('session_created', callback);
    wsClient.on('session_terminated', callback);
  }

  // Send command via WebSocket for real-time execution
  sendCommand(sessionId: string, command: string): void {
    const wsClient = connectionService.getWsClient();
    if (!wsClient) {
      throw new Error('No active WebSocket connection');
    }

    wsClient.emit('execute_command', {
      sessionId,
      command,
    });
  }

  // Send interrupt signal (Ctrl+C)
  sendInterrupt(sessionId: string): void {
    const wsClient = connectionService.getWsClient();
    if (!wsClient) {
      throw new Error('No active WebSocket connection');
    }

    wsClient.emit('interrupt_command', { sessionId });
  }

  unsubscribeFromTerminalEvents(): void {
    const wsClient = connectionService.getWsClient();
    if (!wsClient) return;

    wsClient.off('terminal_output');
    wsClient.off('command_executed');
    wsClient.off('session_created');
    wsClient.off('session_terminated');
  }

  // Utility methods
  formatCommandForHistory(command: string, output: string, exitCode: number): CommandHistory {
    return {
      id: Date.now().toString(),
      command,
      timestamp: new Date().toISOString(),
      output,
      exitCode,
      sessionId: '',
    };
  }

  isCommandRunning(sessionId: string): boolean {
    const wsClient = connectionService.getWsClient();
    if (!wsClient) return false;
    
    // Check if there's an active command execution for this session
    // This could be tracked via session state or WebSocket events
    return wsClient.connected && sessionId !== null;
  }
}

export const terminalService = new TerminalService();
