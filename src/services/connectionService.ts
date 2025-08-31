import axios, { AxiosInstance } from 'axios';
import { io, Socket } from 'socket.io-client';
import { ConnectionConfig } from '@/types';

class ConnectionService {
  private httpClient: AxiosInstance | null = null;
  private wsClient: Socket | null = null;
  private currentConfig: ConnectionConfig | null = null;

  async connect(config: ConnectionConfig): Promise<void> {
    this.currentConfig = config;
    
    // Set up HTTP client
    const baseURL = `${config.secure ? 'https' : 'http'}://${config.host}:${config.port}`;
    this.httpClient = axios.create({
      baseURL,
      timeout: config.timeout * 1000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Test HTTP connection
    await this.httpClient.get('/api/health');

    // Set up WebSocket client
    const wsURL = `${config.secure ? 'wss' : 'ws'}://${config.host}:${config.port}`;
    this.wsClient = io(wsURL, {
      transports: ['websocket'],
      timeout: config.timeout * 1000,
    });

    return new Promise((resolve, reject) => {
      if (!this.wsClient) {
        reject(new Error('WebSocket client not initialized'));
        return;
      }

      this.wsClient.on('connect', () => {
        resolve();
      });

      this.wsClient.on('connect_error', (error) => {
        reject(error);
      });

      setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, config.timeout * 1000);
    });
  }

  async disconnect(): Promise<void> {
    if (this.wsClient) {
      this.wsClient.disconnect();
      this.wsClient = null;
    }
    this.httpClient = null;
    this.currentConfig = null;
  }

  async autoDiscover(): Promise<ConnectionConfig[]> {
    // Simulate auto-discovery - in real implementation this would scan the network
    return [
      {
        id: 'discovered-1',
        name: 'Local Server',
        host: '192.168.1.100',
        port: 8080,
        secure: false,
        autoConnect: false,
        timeout: 30,
      },
    ];
  }

  getHttpClient(): AxiosInstance | null {
    return this.httpClient;
  }

  getWsClient(): Socket | null {
    return this.wsClient;
  }

  getCurrentConfig(): ConnectionConfig | null {
    return this.currentConfig;
  }

  isConnected(): boolean {
    return this.httpClient !== null && this.wsClient?.connected === true;
  }
}

export const connectionService = new ConnectionService();
