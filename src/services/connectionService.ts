import { Connection } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import CryptoJS from 'crypto-js';
import { terminalService } from './terminalService';

interface SSHConnection {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  connected: boolean;
  lastError?: string;
}

class ConnectionService {
  private connections: Map<string, Connection> = new Map();
  private activeConnection: SSHConnection | null = null;
  private connectionCallbacks: ((connection: Connection | null) => void)[] = [];
  private encryptionKey = 'NexusConnectionSecretKey2023';
  private commandQueue: Array<{ command: string; resolve: (result: any) => void; reject: (error: any) => void }> = [];
  private isExecutingCommand = false;

  async initialize(): Promise<void> {
    try {
      await this.loadSavedConnections();
    } catch (error) {
      console.error('Connection service initialization failed:', error);
    }
  }

  async connect(connectionInfo: Omit<Connection, 'id' | 'status' | 'lastConnected' | 'saved'>): Promise<boolean> {
    try {
      // Disconnect existing connection
      if (this.activeConnection?.connected) {
        await this.disconnect();
      }

      // Create SSH connection
      this.activeConnection = {
        host: connectionInfo.host,
        port: connectionInfo.port,
        username: connectionInfo.username,
        password: connectionInfo.password,
        privateKey: connectionInfo.privateKey,
        connected: false
      };

      // Establish connection via WebSocket to SSH bridge
      const connected = await terminalService.connect(connectionInfo.host, connectionInfo.port);
      
      if (connected) {
        this.activeConnection.connected = true;
        
        // Update connection status
        const connection: Connection = {
          id: `${connectionInfo.host}:${connectionInfo.port}`,
          ...connectionInfo,
          status: 'connected',
          lastConnected: new Date().toISOString(),
          saved: false
        };

        this.connections.set(connection.id, connection);
        this.notifyConnectionChange(connection);

        // Test the connection with a simple command
        try {
          await this.executeCommand('echo "Connection established"');
        } catch (testError) {
          console.warn('Connection test failed:', testError);
        }

        return true;
      } else {
        this.activeConnection = null;
        throw new Error('Failed to establish SSH connection');
      }
    } catch (error) {
      console.error('Connection failed:', error);
      
      if (this.activeConnection) {
        this.activeConnection.lastError = error.message;
        this.activeConnection.connected = false;
      }

      const connection: Connection = {
        id: `${connectionInfo.host}:${connectionInfo.port}`,
        ...connectionInfo,
        status: 'error',
        saved: false
      };

      this.connections.set(connection.id, connection);
      this.notifyConnectionChange(connection);

      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.activeConnection?.connected) {
        await terminalService.disconnect();
      }

      if (this.activeConnection) {
        this.activeConnection.connected = false;
        
        // Update connection status
        const connectionId = `${this.activeConnection.host}:${this.activeConnection.port}`;
        const connection = this.connections.get(connectionId);
        
        if (connection) {
          connection.status = 'disconnected';
          this.connections.set(connectionId, connection);
          this.notifyConnectionChange(connection);
        }
      }

      this.activeConnection = null;
      this.notifyConnectionChange(null);
    } catch (error) {
      console.error('Disconnection failed:', error);
    }
  }

  async testConnection(connectionInfo: Omit<Connection, 'id' | 'status' | 'lastConnected' | 'saved'>): Promise<boolean> {
    try {
      // Create temporary connection for testing
      const testConnection = {
        host: connectionInfo.host,
        port: connectionInfo.port,
        username: connectionInfo.username,
        password: connectionInfo.password,
        privateKey: connectionInfo.privateKey,
        connected: false
      };

      // Try to establish connection
      const connected = await terminalService.connect(connectionInfo.host, connectionInfo.port);
      
      if (connected) {
        // Test with a simple command
        try {
          const result = await this.executeCommand('echo "test"', 5000);
          await terminalService.disconnect();
          return result.exitCode === 0;
        } catch (commandError) {
          await terminalService.disconnect();
          return false;
        }
      }

      return false;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  async executeCommand(command: string, timeout: number = 30000): Promise<{
    output: string;
    exitCode: number;
    duration: number;
  }> {
    if (!this.activeConnection?.connected) {
      throw new Error('No active SSH connection');
    }

    return new Promise((resolve, reject) => {
      // Add to command queue
      this.commandQueue.push({ command, resolve, reject });
      
      // Process queue
      this.processCommandQueue(timeout);
    });
  }

  async saveConnection(connection: Connection): Promise<void> {
    try {
      connection.saved = true;
      connection.id = connection.id || `${connection.host}:${connection.port}`;
      
      this.connections.set(connection.id, connection);
      await this.persistConnections();
    } catch (error) {
      console.error('Failed to save connection:', error);
      throw error;
    }
  }

  async deleteConnection(connectionId: string): Promise<void> {
    try {
      this.connections.delete(connectionId);
      await this.persistConnections();
      
      // Clear sensitive data from keychain
      try {
        await Keychain.resetInternetCredentials(`nexus_conn_${connectionId}`);
      } catch (keychainError) {
        console.warn('Failed to clear keychain data:', keychainError);
      }
    } catch (error) {
      console.error('Failed to delete connection:', error);
      throw error;
    }
  }

  getSavedConnections(): Connection[] {
    return Array.from(this.connections.values()).filter(conn => conn.saved);
  }

  getActiveConnection(): Connection | null {
    if (!this.activeConnection?.connected) return null;
    
    const connectionId = `${this.activeConnection.host}:${this.activeConnection.port}`;
    return this.connections.get(connectionId) || null;
  }

  isConnected(): boolean {
    return this.activeConnection?.connected || false;
  }

  onConnectionChange(callback: (connection: Connection | null) => void): void {
    this.connectionCallbacks.push(callback);
  }

  removeConnectionListener(callback: (connection: Connection | null) => void): void {
    const index = this.connectionCallbacks.indexOf(callback);
    if (index !== -1) {
      this.connectionCallbacks.splice(index, 1);
    }
  }

  async generateSSHKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
    // In a real implementation, this would use a proper crypto library
    // For now, we'll simulate key generation
    const timestamp = Date.now().toString();
    const publicKey = `ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC${Buffer.from(timestamp).toString('base64')}== nexus-terminal@mobile`;
    const privateKey = `-----BEGIN OPENSSH PRIVATE KEY-----
${Buffer.from(`mock-private-key-${timestamp}`).toString('base64')}
-----END OPENSSH PRIVATE KEY-----`;

    return { publicKey, privateKey };
  }

  private async processCommandQueue(timeout: number): Promise<void> {
    if (this.isExecutingCommand || this.commandQueue.length === 0) {
      return;
    }

    this.isExecutingCommand = true;

    while (this.commandQueue.length > 0) {
      const { command, resolve, reject } = this.commandQueue.shift()!;

      try {
        const timeoutPromise = new Promise<never>((_, timeoutReject) => {
          setTimeout(() => timeoutReject(new Error('Command execution timeout')), timeout);
        });

        const commandPromise = terminalService.executeCommand(command);
        const result = await Promise.race([commandPromise, timeoutPromise]);

        resolve(result);
      } catch (error) {
        reject(error);
      }
    }

    this.isExecutingCommand = false;
  }

  private async loadSavedConnections(): Promise<void> {
    try {
      const connectionsData = await AsyncStorage.getItem('saved_connections');
      if (!connectionsData) return;

      const connectionList: Connection[] = JSON.parse(connectionsData);

      for (const connection of connectionList) {
        // Load sensitive data from keychain
        try {
          const credentials = await Keychain.getInternetCredentials(`nexus_conn_${connection.id}`);
          if (credentials && credentials.password) {
            const decrypted = CryptoJS.AES.decrypt(credentials.password, this.encryptionKey).toString(CryptoJS.enc.Utf8);
            const sensitiveData = JSON.parse(decrypted);
            
            connection.password = sensitiveData.password;
            connection.privateKey = sensitiveData.privateKey;
          }
        } catch (keychainError) {
          console.warn(`Failed to load credentials for connection ${connection.id}:`, keychainError);
        }

        // Set initial status
        connection.status = 'disconnected';
        this.connections.set(connection.id, connection);
      }
    } catch (error) {
      console.error('Failed to load saved connections:', error);
    }
  }

  private async persistConnections(): Promise<void> {
    try {
      const savedConnections = this.getSavedConnections();
      
      // Separate sensitive and non-sensitive data
      const connectionsForStorage = savedConnections.map(conn => {
        const { password, privateKey, ...safeData } = conn;
        return safeData;
      });

      // Save non-sensitive data to AsyncStorage
      await AsyncStorage.setItem('saved_connections', JSON.stringify(connectionsForStorage));

      // Save sensitive data to Keychain
      for (const connection of savedConnections) {
        if (connection.password || connection.privateKey) {
          const sensitiveData = {
            password: connection.password,
            privateKey: connection.privateKey
          };

          const encrypted = CryptoJS.AES.encrypt(
            JSON.stringify(sensitiveData),
            this.encryptionKey
          ).toString();

          await Keychain.setInternetCredentials(
            `nexus_conn_${connection.id}`,
            connection.username,
            encrypted
          );
        }
      }
    } catch (error) {
      console.error('Failed to persist connections:', error);
    }
  }

  private notifyConnectionChange(connection: Connection | null): void {
    this.connectionCallbacks.forEach(callback => {
      try {
        callback(connection);
      } catch (error) {
        console.error('Connection callback error:', error);
      }
    });
  }

  dispose(): void {
    this.disconnect();
    this.connectionCallbacks = [];
    this.commandQueue = [];
    this.connections.clear();
  }
}

export const connectionService = new ConnectionService();
