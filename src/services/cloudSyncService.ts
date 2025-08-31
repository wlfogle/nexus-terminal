import AsyncStorage from '@react-native-async-storage/async-storage';
import { Connection, Command } from '@/types';
import { AppSettings } from './settingsService';
import CryptoJS from 'crypto-js';

interface SyncData {
  connections: Connection[];
  settings: AppSettings;
  commandHistory: Command[];
  customThemes: any[];
  scripts: any[];
  lastSync: string;
  deviceId: string;
}

interface SyncConflict {
  type: 'connection' | 'setting' | 'command' | 'theme' | 'script';
  local: any;
  remote: any;
  resolution: 'local' | 'remote' | 'merge' | 'manual';
}

class CloudSyncService {
  private deviceId: string = '';
  private syncInProgress = false;
  private autoSyncEnabled = true;
  private syncInterval: NodeJS.Timeout | null = null;
  private encryptionKey = 'NexusCloudSyncKey2023';
  private apiEndpoint = 'https://api.nexusterminal.com';
  private lastSyncTime = 0;

  async initialize(): Promise<void> {
    try {
      this.deviceId = await this.getDeviceId();
      await this.setupAutoSync();
      console.log('☁️ Cloud Sync Service initialized');
    } catch (error) {
      console.error('Cloud sync initialization failed:', error);
    }
  }

  async syncToCloud(force: boolean = false): Promise<boolean> {
    if (this.syncInProgress && !force) {
      return false;
    }

    this.syncInProgress = true;

    try {
      // Gather local data
      const localData = await this.gatherLocalData();
      
      // Encrypt data before upload
      const encryptedData = this.encryptSyncData(localData);
      
      // Upload to cloud
      const response = await this.uploadToCloud(encryptedData);
      
      if (response.success) {
        this.lastSyncTime = Date.now();
        await AsyncStorage.setItem('lastCloudSync', this.lastSyncTime.toString());
        console.log('☁️ Data synced to cloud successfully');
        return true;
      } else {
        throw new Error(response.error || 'Sync failed');
      }
    } catch (error) {
      console.error('Cloud sync failed:', error);
      return false;
    } finally {
      this.syncInProgress = false;
    }
  }

  async syncFromCloud(): Promise<{ success: boolean; conflicts?: SyncConflict[] }> {
    if (this.syncInProgress) {
      return { success: false };
    }

    this.syncInProgress = true;

    try {
      // Download from cloud
      const response = await this.downloadFromCloud();
      
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Download failed');
      }

      // Decrypt data
      const remoteData = this.decryptSyncData(response.data);
      
      // Detect conflicts
      const localData = await this.gatherLocalData();
      const conflicts = this.detectConflicts(localData, remoteData);

      if (conflicts.length > 0) {
        console.log(`☁️ Found ${conflicts.length} sync conflicts`);
        return { success: true, conflicts };
      }

      // Apply remote data
      await this.applyRemoteData(remoteData);
      
      this.lastSyncTime = Date.now();
      await AsyncStorage.setItem('lastCloudSync', this.lastSyncTime.toString());
      
      console.log('☁️ Data synced from cloud successfully');
      return { success: true };
    } catch (error) {
      console.error('Cloud sync download failed:', error);
      return { success: false };
    } finally {
      this.syncInProgress = false;
    }
  }

  async resolveConflicts(conflicts: SyncConflict[], resolutions: Record<string, 'local' | 'remote' | 'merge'>): Promise<boolean> {
    try {
      const remoteData = await this.downloadFromCloud();
      if (!remoteData.success) return false;

      const decryptedRemoteData = this.decryptSyncData(remoteData.data);
      const localData = await this.gatherLocalData();

      // Apply resolutions
      for (const conflict of conflicts) {
        const resolution = resolutions[conflict.type];
        if (!resolution) continue;

        switch (resolution) {
          case 'local':
            // Keep local version - no action needed
            break;
          case 'remote':
            await this.applyConflictResolution(conflict, decryptedRemoteData);
            break;
          case 'merge':
            await this.mergeConflictData(conflict, localData, decryptedRemoteData);
            break;
        }
      }

      // Sync resolved data to cloud
      await this.syncToCloud(true);
      
      return true;
    } catch (error) {
      console.error('Conflict resolution failed:', error);
      return false;
    }
  }

  async enableAutoSync(intervalMinutes: number = 15): Promise<void> {
    this.autoSyncEnabled = true;
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      await this.syncToCloud();
    }, intervalMinutes * 60 * 1000);

    console.log(`☁️ Auto-sync enabled (${intervalMinutes} minutes)`);
  }

  disableAutoSync(): void {
    this.autoSyncEnabled = false;
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    console.log('☁️ Auto-sync disabled');
  }

  async getLastSyncTime(): Promise<Date | null> {
    try {
      const lastSync = await AsyncStorage.getItem('lastCloudSync');
      return lastSync ? new Date(parseInt(lastSync)) : null;
    } catch (error) {
      return null;
    }
  }

  async clearCloudData(): Promise<boolean> {
    try {
      const response = await this.makeApiRequest('/sync/clear', {
        deviceId: this.deviceId
      }, 'DELETE');

      return response.success;
    } catch (error) {
      console.error('Failed to clear cloud data:', error);
      return false;
    }
  }

  private async gatherLocalData(): Promise<SyncData> {
    const connections = await AsyncStorage.getItem('saved_connections');
    const settings = await AsyncStorage.getItem('app_settings');
    const commandHistory = await AsyncStorage.getItem('command_history');
    const customThemes = await AsyncStorage.getItem('custom_themes');
    const scripts = await AsyncStorage.getItem('user_scripts');

    return {
      connections: connections ? JSON.parse(connections) : [],
      settings: settings ? JSON.parse(settings) : {},
      commandHistory: commandHistory ? JSON.parse(commandHistory) : [],
      customThemes: customThemes ? JSON.parse(customThemes) : [],
      scripts: scripts ? JSON.parse(scripts) : [],
      lastSync: new Date().toISOString(),
      deviceId: this.deviceId
    };
  }

  private async applyRemoteData(remoteData: SyncData): Promise<void> {
    // Apply connections (merge with local)
    if (remoteData.connections.length > 0) {
      const localConnections = await AsyncStorage.getItem('saved_connections');
      const local = localConnections ? JSON.parse(localConnections) : [];
      const merged = this.mergeConnections(local, remoteData.connections);
      await AsyncStorage.setItem('saved_connections', JSON.stringify(merged));
    }

    // Apply settings (merge with local)
    if (Object.keys(remoteData.settings).length > 0) {
      const localSettings = await AsyncStorage.getItem('app_settings');
      const local = localSettings ? JSON.parse(localSettings) : {};
      const merged = { ...local, ...remoteData.settings };
      await AsyncStorage.setItem('app_settings', JSON.stringify(merged));
    }

    // Apply command history (merge recent commands)
    if (remoteData.commandHistory.length > 0) {
      const localHistory = await AsyncStorage.getItem('command_history');
      const local = localHistory ? JSON.parse(localHistory) : [];
      const merged = this.mergeCommandHistory(local, remoteData.commandHistory);
      await AsyncStorage.setItem('command_history', JSON.stringify(merged));
    }

    // Apply custom themes
    if (remoteData.customThemes.length > 0) {
      await AsyncStorage.setItem('custom_themes', JSON.stringify(remoteData.customThemes));
    }

    // Apply scripts
    if (remoteData.scripts.length > 0) {
      await AsyncStorage.setItem('user_scripts', JSON.stringify(remoteData.scripts));
    }
  }

  private detectConflicts(localData: SyncData, remoteData: SyncData): SyncConflict[] {
    const conflicts: SyncConflict[] = [];

    // Check for connection conflicts
    localData.connections.forEach(localConn => {
      const remoteConn = remoteData.connections.find(r => r.id === localConn.id);
      if (remoteConn && JSON.stringify(localConn) !== JSON.stringify(remoteConn)) {
        conflicts.push({
          type: 'connection',
          local: localConn,
          remote: remoteConn,
          resolution: 'manual'
        });
      }
    });

    // Check for settings conflicts
    const settingsKeys = Object.keys({ ...localData.settings, ...remoteData.settings });
    settingsKeys.forEach(key => {
      const localValue = (localData.settings as any)[key];
      const remoteValue = (remoteData.settings as any)[key];
      
      if (localValue !== undefined && remoteValue !== undefined && localValue !== remoteValue) {
        conflicts.push({
          type: 'setting',
          local: { key, value: localValue },
          remote: { key, value: remoteValue },
          resolution: 'manual'
        });
      }
    });

    return conflicts;
  }

  private mergeConnections(local: Connection[], remote: Connection[]): Connection[] {
    const merged = [...local];
    
    remote.forEach(remoteConn => {
      const existingIndex = merged.findIndex(l => l.id === remoteConn.id);
      if (existingIndex !== -1) {
        // Update existing connection with newer lastConnected
        if (remoteConn.lastConnected && 
            (!merged[existingIndex].lastConnected || 
             remoteConn.lastConnected > merged[existingIndex].lastConnected!)) {
          merged[existingIndex] = remoteConn;
        }
      } else {
        // Add new connection
        merged.push(remoteConn);
      }
    });

    return merged;
  }

  private mergeCommandHistory(local: Command[], remote: Command[]): Command[] {
    const allCommands = [...local, ...remote];
    const uniqueCommands = allCommands.filter((cmd, index, array) => 
      array.findIndex(c => c.id === cmd.id) === index
    );
    
    return uniqueCommands
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 1000); // Keep last 1000 commands
  }

  private encryptSyncData(data: SyncData): string {
    const jsonString = JSON.stringify(data);
    return CryptoJS.AES.encrypt(jsonString, this.encryptionKey).toString();
  }

  private decryptSyncData(encryptedData: string): SyncData {
    const decrypted = CryptoJS.AES.decrypt(encryptedData, this.encryptionKey);
    const jsonString = decrypted.toString(CryptoJS.enc.Utf8);
    return JSON.parse(jsonString);
  }

  private async uploadToCloud(encryptedData: string): Promise<{ success: boolean; error?: string }> {
    return this.makeApiRequest('/sync/upload', {
      deviceId: this.deviceId,
      data: encryptedData,
      timestamp: Date.now()
    });
  }

  private async downloadFromCloud(): Promise<{ success: boolean; data?: string; error?: string }> {
    return this.makeApiRequest('/sync/download', {
      deviceId: this.deviceId
    }, 'GET');
  }

  private async makeApiRequest(endpoint: string, data?: any, method: 'GET' | 'POST' | 'DELETE' = 'POST'): Promise<any> {
    // Mock API implementation - in production, use real HTTP client
    await new Promise(resolve => setTimeout(resolve, 1000));

    switch (endpoint) {
      case '/sync/upload':
        return { success: true };
      case '/sync/download':
        return { success: true, data: this.encryptSyncData(await this.gatherLocalData()) };
      case '/sync/clear':
        return { success: true };
      default:
        return { success: false, error: 'Unknown endpoint' };
    }
  }

  private async getDeviceId(): Promise<string> {
    try {
      let deviceId = await AsyncStorage.getItem('deviceId');
      if (!deviceId) {
        deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await AsyncStorage.setItem('deviceId', deviceId);
      }
      return deviceId;
    } catch (error) {
      return `device_${Date.now()}`;
    }
  }

  private async setupAutoSync(): Promise<void> {
    const autoSyncSetting = await AsyncStorage.getItem('autoSyncEnabled');
    if (autoSyncSetting !== 'false') {
      await this.enableAutoSync();
    }
  }

  private async applyConflictResolution(conflict: SyncConflict, remoteData: SyncData): Promise<void> {
    switch (conflict.type) {
      case 'connection':
        const connections = await AsyncStorage.getItem('saved_connections');
        const localConnections = connections ? JSON.parse(connections) : [];
        const updatedConnections = localConnections.map((conn: Connection) => 
          conn.id === conflict.remote.id ? conflict.remote : conn
        );
        await AsyncStorage.setItem('saved_connections', JSON.stringify(updatedConnections));
        break;
        
      case 'setting':
        const settings = await AsyncStorage.getItem('app_settings');
        const localSettings = settings ? JSON.parse(settings) : {};
        localSettings[conflict.remote.key] = conflict.remote.value;
        await AsyncStorage.setItem('app_settings', JSON.stringify(localSettings));
        break;
    }
  }

  private async mergeConflictData(conflict: SyncConflict, localData: SyncData, remoteData: SyncData): Promise<void> {
    // Implement intelligent merging based on conflict type
    switch (conflict.type) {
      case 'connection':
        // Merge connection properties, preferring newer data
        const mergedConnection = {
          ...conflict.local,
          ...conflict.remote,
          lastConnected: conflict.remote.lastConnected > conflict.local.lastConnected 
            ? conflict.remote.lastConnected 
            : conflict.local.lastConnected
        };
        
        const connections = await AsyncStorage.getItem('saved_connections');
        const localConnections = connections ? JSON.parse(connections) : [];
        const updatedConnections = localConnections.map((conn: Connection) => 
          conn.id === mergedConnection.id ? mergedConnection : conn
        );
        await AsyncStorage.setItem('saved_connections', JSON.stringify(updatedConnections));
        break;
    }
  }

  dispose(): void {
    this.disableAutoSync();
  }
}

export const cloudSyncService = new CloudSyncService();
