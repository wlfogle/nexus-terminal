import { SystemMetrics, Process, Service } from '@/types';
import { connectionService } from './connectionService';
import { authService } from './authService';

class SystemService {
  private async getAuthHeaders() {
    const token = await authService.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async getMetrics(): Promise<SystemMetrics> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    const headers = await this.getAuthHeaders();
    const response = await httpClient.get('/api/system/metrics', { headers });
    return response.data;
  }

  async getSystemInfo(): Promise<object> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    const headers = await this.getAuthHeaders();
    const response = await httpClient.get('/api/system/info', { headers });
    return response.data;
  }

  async getProcesses(): Promise<Process[]> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    const headers = await this.getAuthHeaders();
    const response = await httpClient.get('/api/system/processes', { headers });
    return response.data;
  }

  async getServices(): Promise<Service[]> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    const headers = await this.getAuthHeaders();
    const response = await httpClient.get('/api/system/services', { headers });
    return response.data;
  }

  async killProcess(pid: number): Promise<void> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    const headers = await this.getAuthHeaders();
    await httpClient.delete(`/api/system/processes/${pid}`, { headers });
  }

  async controlService(name: string, action: 'start' | 'stop' | 'restart'): Promise<void> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    const headers = await this.getAuthHeaders();
    await httpClient.post(`/api/system/services/${name}/${action}`, {}, { headers });
  }

  async getLogs(service?: string, lines: number = 100): Promise<string[]> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    const headers = await this.getAuthHeaders();
    const params = { lines, service };
    const response = await httpClient.get('/api/system/logs', { headers, params });
    return response.data;
  }

  // WebSocket event handlers for real-time updates
  subscribeToMetrics(callback: (metrics: SystemMetrics) => void): void {
    const wsClient = connectionService.getWsClient();
    if (!wsClient) {
      throw new Error('No active WebSocket connection');
    }

    wsClient.on('system_metrics_update', callback);
  }

  subscribeToProcesses(callback: (processes: Process[]) => void): void {
    const wsClient = connectionService.getWsClient();
    if (!wsClient) {
      throw new Error('No active WebSocket connection');
    }

    wsClient.on('process_update', callback);
  }

  subscribeToServices(callback: (services: Service[]) => void): void {
    const wsClient = connectionService.getWsClient();
    if (!wsClient) {
      throw new Error('No active WebSocket connection');
    }

    wsClient.on('service_status_changed', callback);
  }

  unsubscribeFromEvents(): void {
    const wsClient = connectionService.getWsClient();
    if (!wsClient) return;

    wsClient.off('system_metrics_update');
    wsClient.off('process_update');
    wsClient.off('service_status_changed');
  }
}

export const systemService = new SystemService();
