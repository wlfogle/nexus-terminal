import RNFS from 'react-native-fs';
import { FileItem } from '@/types';
import { connectionService } from './connectionService';
import { authService } from './authService';

class FileService {
  private async getAuthHeaders() {
    const token = await authService.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async browseDirectory(path: string): Promise<FileItem[]> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    const headers = await this.getAuthHeaders();
    const response = await httpClient.get('/api/files/browse', {
      headers,
      params: { path },
    });
    return response.data;
  }

  async createFile(path: string, type: 'file' | 'directory'): Promise<FileItem> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    const headers = await this.getAuthHeaders();
    const response = await httpClient.post('/api/files/create', {
      path,
      type,
    }, { headers });
    return response.data;
  }

  async deleteFiles(paths: string[]): Promise<void> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    const headers = await this.getAuthHeaders();
    await httpClient.delete('/api/files/delete', {
      headers,
      data: { paths },
    });
  }

  async renameFile(oldPath: string, newPath: string): Promise<FileItem> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    const headers = await this.getAuthHeaders();
    const response = await httpClient.put('/api/files/rename', {
      oldPath,
      newPath,
    }, { headers });
    return response.data;
  }

  async copyFiles(sourcePaths: string[], destinationPath: string): Promise<void> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    const headers = await this.getAuthHeaders();
    await httpClient.post('/api/files/copy', {
      sourcePaths,
      destinationPath,
    }, { headers });
  }

  async moveFiles(sourcePaths: string[], destinationPath: string): Promise<void> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    const headers = await this.getAuthHeaders();
    await httpClient.post('/api/files/move', {
      sourcePaths,
      destinationPath,
    }, { headers });
  }

  async readFileContent(path: string): Promise<string> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    const headers = await this.getAuthHeaders();
    const response = await httpClient.get('/api/files/content', {
      headers,
      params: { path },
    });
    return response.data.content;
  }

  async writeFileContent(path: string, content: string): Promise<void> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    const headers = await this.getAuthHeaders();
    await httpClient.put('/api/files/content', {
      path,
      content,
    }, { headers });
  }

  async uploadFile(localPath: string, remotePath: string): Promise<FileItem> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    // Read local file
    const fileContent = await RNFS.readFile(localPath, 'base64');
    const fileStats = await RNFS.stat(localPath);

    const headers = await this.getAuthHeaders();
    const response = await httpClient.post('/api/files/upload', {
      remotePath,
      content: fileContent,
      encoding: 'base64',
      size: fileStats.size,
    }, { headers });

    return response.data;
  }

  async downloadFile(remotePath: string, localPath: string): Promise<void> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    const headers = await this.getAuthHeaders();
    const response = await httpClient.get('/api/files/download', {
      headers,
      params: { path: remotePath },
      responseType: 'arraybuffer',
    });

    // Convert ArrayBuffer to base64
    const base64 = Buffer.from(response.data, 'binary').toString('base64');
    
    // Write to local file
    await RNFS.writeFile(localPath, base64, 'base64');
  }

  async searchFiles(query: string, path: string): Promise<FileItem[]> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    const headers = await this.getAuthHeaders();
    const response = await httpClient.get('/api/files/search', {
      headers,
      params: { query, path },
    });
    return response.data;
  }

  async getFilePermissions(path: string): Promise<string> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    const headers = await this.getAuthHeaders();
    const response = await httpClient.get('/api/files/permissions', {
      headers,
      params: { path },
    });
    return response.data.permissions;
  }

  async setFilePermissions(path: string, permissions: string): Promise<void> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    const headers = await this.getAuthHeaders();
    await httpClient.put('/api/files/permissions', {
      path,
      permissions,
    }, { headers });
  }

  // WebSocket event handlers for real-time file updates
  subscribeToFileChanges(callback: (event: any) => void): void {
    const wsClient = connectionService.getWsClient();
    if (!wsClient) {
      throw new Error('No active WebSocket connection');
    }

    wsClient.on('file_changed', callback);
    wsClient.on('directory_created', callback);
    wsClient.on('file_uploaded', callback);
    wsClient.on('file_downloaded', callback);
  }

  unsubscribeFromFileChanges(): void {
    const wsClient = connectionService.getWsClient();
    if (!wsClient) return;

    wsClient.off('file_changed');
    wsClient.off('directory_created');
    wsClient.off('file_uploaded');
    wsClient.off('file_downloaded');
  }
}

export const fileService = new FileService();
