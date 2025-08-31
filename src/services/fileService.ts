import { FileItem } from '@/types';
import { connectionService } from './connectionService';
import RNFS from 'react-native-fs';

class FileService {
  private currentPath = '/';
  private fileCache = new Map<string, FileItem[]>();
  private cacheExpiry = 30000; // 30 seconds

  async listFiles(path?: string): Promise<FileItem[]> {
    try {
      const targetPath = path || this.currentPath;
      
      // Check cache first
      const cacheKey = targetPath;
      const cached = this.fileCache.get(cacheKey);
      if (cached && Date.now() - (cached as any)._cacheTime < this.cacheExpiry) {
        return cached;
      }

      if (!connectionService.isConnected()) {
        throw new Error('Not connected to remote server');
      }

      // Execute ls command via SSH
      const command = `ls -la "${targetPath}" --time-style=+%Y-%m-%d\\ %H:%M:%S`;
      const result = await connectionService.executeCommand(command);
      
      if (result.exitCode !== 0) {
        throw new Error(`Failed to list directory: ${result.output}`);
      }

      const files = this.parseLsOutput(result.output, targetPath);
      
      // Cache results
      (files as any)._cacheTime = Date.now();
      this.fileCache.set(cacheKey, files);
      
      return files;
    } catch (error) {
      console.error('File listing failed:', error);
      throw error;
    }
  }

  async createFile(path: string, content?: string): Promise<boolean> {
    try {
      if (!connectionService.isConnected()) {
        throw new Error('Not connected to remote server');
      }

      const escapedPath = this.escapePath(path);
      const command = content 
        ? `echo '${content.replace(/'/g, "'\\''")}' > "${escapedPath}"`
        : `touch "${escapedPath}"`;
      
      const result = await connectionService.executeCommand(command);
      
      if (result.exitCode !== 0) {
        throw new Error(`Failed to create file: ${result.output}`);
      }

      // Invalidate cache for parent directory
      const parentDir = this.getParentDirectory(path);
      this.fileCache.delete(parentDir);

      return true;
    } catch (error) {
      console.error('File creation failed:', error);
      throw error;
    }
  }

  async createDirectory(path: string): Promise<boolean> {
    try {
      if (!connectionService.isConnected()) {
        throw new Error('Not connected to remote server');
      }

      const escapedPath = this.escapePath(path);
      const command = `mkdir -p "${escapedPath}"`;
      
      const result = await connectionService.executeCommand(command);
      
      if (result.exitCode !== 0) {
        throw new Error(`Failed to create directory: ${result.output}`);
      }

      // Invalidate cache for parent directory
      const parentDir = this.getParentDirectory(path);
      this.fileCache.delete(parentDir);

      return true;
    } catch (error) {
      console.error('Directory creation failed:', error);
      throw error;
    }
  }

  async deleteFile(path: string): Promise<boolean> {
    try {
      if (!connectionService.isConnected()) {
        throw new Error('Not connected to remote server');
      }

      const escapedPath = this.escapePath(path);
      const command = `rm -rf "${escapedPath}"`;
      
      const result = await connectionService.executeCommand(command);
      
      if (result.exitCode !== 0) {
        throw new Error(`Failed to delete file: ${result.output}`);
      }

      // Invalidate cache for parent directory
      const parentDir = this.getParentDirectory(path);
      this.fileCache.delete(parentDir);

      return true;
    } catch (error) {
      console.error('File deletion failed:', error);
      throw error;
    }
  }

  async renameFile(oldPath: string, newPath: string): Promise<boolean> {
    try {
      if (!connectionService.isConnected()) {
        throw new Error('Not connected to remote server');
      }

      const escapedOldPath = this.escapePath(oldPath);
      const escapedNewPath = this.escapePath(newPath);
      const command = `mv "${escapedOldPath}" "${escapedNewPath}"`;
      
      const result = await connectionService.executeCommand(command);
      
      if (result.exitCode !== 0) {
        throw new Error(`Failed to rename file: ${result.output}`);
      }

      // Invalidate cache for both directories
      const oldParent = this.getParentDirectory(oldPath);
      const newParent = this.getParentDirectory(newPath);
      this.fileCache.delete(oldParent);
      this.fileCache.delete(newParent);

      return true;
    } catch (error) {
      console.error('File rename failed:', error);
      throw error;
    }
  }

  async copyFile(sourcePath: string, destPath: string): Promise<boolean> {
    try {
      if (!connectionService.isConnected()) {
        throw new Error('Not connected to remote server');
      }

      const escapedSourcePath = this.escapePath(sourcePath);
      const escapedDestPath = this.escapePath(destPath);
      const command = `cp -r "${escapedSourcePath}" "${escapedDestPath}"`;
      
      const result = await connectionService.executeCommand(command);
      
      if (result.exitCode !== 0) {
        throw new Error(`Failed to copy file: ${result.output}`);
      }

      // Invalidate cache for destination directory
      const destParent = this.getParentDirectory(destPath);
      this.fileCache.delete(destParent);

      return true;
    } catch (error) {
      console.error('File copy failed:', error);
      throw error;
    }
  }

  async moveFile(sourcePath: string, destPath: string): Promise<boolean> {
    try {
      if (!connectionService.isConnected()) {
        throw new Error('Not connected to remote server');
      }

      const escapedSourcePath = this.escapePath(sourcePath);
      const escapedDestPath = this.escapePath(destPath);
      const command = `mv "${escapedSourcePath}" "${escapedDestPath}"`;
      
      const result = await connectionService.executeCommand(command);
      
      if (result.exitCode !== 0) {
        throw new Error(`Failed to move file: ${result.output}`);
      }

      // Invalidate cache for both directories
      const sourceParent = this.getParentDirectory(sourcePath);
      const destParent = this.getParentDirectory(destPath);
      this.fileCache.delete(sourceParent);
      this.fileCache.delete(destParent);

      return true;
    } catch (error) {
      console.error('File move failed:', error);
      throw error;
    }
  }

  async readFile(path: string, encoding: 'utf8' | 'base64' = 'utf8'): Promise<string> {
    try {
      if (!connectionService.isConnected()) {
        throw new Error('Not connected to remote server');
      }

      const escapedPath = this.escapePath(path);
      let command: string;
      
      if (encoding === 'base64') {
        command = `base64 "${escapedPath}"`;
      } else {
        command = `cat "${escapedPath}"`;
      }
      
      const result = await connectionService.executeCommand(command);
      
      if (result.exitCode !== 0) {
        throw new Error(`Failed to read file: ${result.output}`);
      }

      return result.output;
    } catch (error) {
      console.error('File read failed:', error);
      throw error;
    }
  }

  async writeFile(path: string, content: string, encoding: 'utf8' | 'base64' = 'utf8'): Promise<boolean> {
    try {
      if (!connectionService.isConnected()) {
        throw new Error('Not connected to remote server');
      }

      const escapedPath = this.escapePath(path);
      let command: string;
      
      if (encoding === 'base64') {
        command = `echo '${content}' | base64 -d > "${escapedPath}"`;
      } else {
        const escapedContent = content.replace(/'/g, "'\\''");
        command = `cat > "${escapedPath}" << 'EOF'\n${escapedContent}\nEOF`;
      }
      
      const result = await connectionService.executeCommand(command);
      
      if (result.exitCode !== 0) {
        throw new Error(`Failed to write file: ${result.output}`);
      }

      // Invalidate cache for parent directory
      const parentDir = this.getParentDirectory(path);
      this.fileCache.delete(parentDir);

      return true;
    } catch (error) {
      console.error('File write failed:', error);
      throw error;
    }
  }

  async uploadFile(localPath: string, remotePath: string, onProgress?: (progress: number) => void): Promise<boolean> {
    try {
      if (!connectionService.isConnected()) {
        throw new Error('Not connected to remote server');
      }

      // Read local file
      const fileContent = await RNFS.readFile(localPath, 'base64');
      const fileSize = (await RNFS.stat(localPath)).size;
      
      if (onProgress) onProgress(0);

      // Upload via base64 encoding (for simplicity)
      const escapedRemotePath = this.escapePath(remotePath);
      const command = `echo '${fileContent}' | base64 -d > "${escapedRemotePath}"`;
      
      const result = await connectionService.executeCommand(command);
      
      if (result.exitCode !== 0) {
        throw new Error(`Failed to upload file: ${result.output}`);
      }

      if (onProgress) onProgress(100);

      // Invalidate cache for remote parent directory
      const remoteParent = this.getParentDirectory(remotePath);
      this.fileCache.delete(remoteParent);

      return true;
    } catch (error) {
      console.error('File upload failed:', error);
      throw error;
    }
  }

  async downloadFile(remotePath: string, localPath: string, onProgress?: (progress: number) => void): Promise<boolean> {
    try {
      if (!connectionService.isConnected()) {
        throw new Error('Not connected to remote server');
      }

      if (onProgress) onProgress(0);

      // Download via base64 encoding
      const escapedRemotePath = this.escapePath(remotePath);
      const command = `base64 "${escapedRemotePath}"`;
      
      const result = await connectionService.executeCommand(command);
      
      if (result.exitCode !== 0) {
        throw new Error(`Failed to download file: ${result.output}`);
      }

      // Write to local file
      await RNFS.writeFile(localPath, result.output, 'base64');

      if (onProgress) onProgress(100);

      return true;
    } catch (error) {
      console.error('File download failed:', error);
      throw error;
    }
  }

  async getFileInfo(path: string): Promise<FileItem | null> {
    try {
      if (!connectionService.isConnected()) {
        throw new Error('Not connected to remote server');
      }

      const escapedPath = this.escapePath(path);
      const command = `stat -c "%n|%s|%Y|%a|%U|%G" "${escapedPath}" 2>/dev/null || ls -ld "${escapedPath}"`;
      
      const result = await connectionService.executeCommand(command);
      
      if (result.exitCode !== 0) {
        return null;
      }

      const lines = result.output.trim().split('\n');
      const line = lines[0];

      if (line.includes('|')) {
        // stat output
        const [name, size, mtime, mode, owner, group] = line.split('|');
        return {
          name: name.split('/').pop() || name,
          path,
          type: this.getFileTypeFromMode(mode),
          size: parseInt(size),
          permissions: mode,
          owner,
          group,
          modified: new Date(parseInt(mtime) * 1000).toISOString(),
          hidden: name.startsWith('.')
        };
      } else {
        // ls output - parse similar to listFiles
        return this.parseLsLine(line, this.getParentDirectory(path));
      }
    } catch (error) {
      console.error('File info failed:', error);
      return null;
    }
  }

  async changePermissions(path: string, permissions: string): Promise<boolean> {
    try {
      if (!connectionService.isConnected()) {
        throw new Error('Not connected to remote server');
      }

      const escapedPath = this.escapePath(path);
      const command = `chmod ${permissions} "${escapedPath}"`;
      
      const result = await connectionService.executeCommand(command);
      
      if (result.exitCode !== 0) {
        throw new Error(`Failed to change permissions: ${result.output}`);
      }

      // Invalidate cache for parent directory
      const parentDir = this.getParentDirectory(path);
      this.fileCache.delete(parentDir);

      return true;
    } catch (error) {
      console.error('Permission change failed:', error);
      throw error;
    }
  }

  getCurrentPath(): string {
    return this.currentPath;
  }

  setCurrentPath(path: string): void {
    this.currentPath = path;
  }

  private parseLsOutput(output: string, basePath: string): FileItem[] {
    const lines = output.trim().split('\n').filter(line => line.trim() !== '');
    const files: FileItem[] = [];
    
    // Skip first line if it's "total ..."
    let startIndex = 0;
    if (lines[0] && lines[0].startsWith('total ')) {
      startIndex = 1;
    }

    for (let i = startIndex; i < lines.length; i++) {
      const file = this.parseLsLine(lines[i], basePath);
      if (file) {
        files.push(file);
      }
    }

    return files;
  }

  private parseLsLine(line: string, basePath: string): FileItem | null {
    // Parse ls -la output
    // Example: drwxr-xr-x 2 user group 4096 2023-12-01 10:30:45 dirname
    const parts = line.trim().split(/\s+/);
    if (parts.length < 9) return null;

    const permissions = parts[0];
    const owner = parts[2];
    const group = parts[3];
    const size = parseInt(parts[4]);
    const date = parts[5];
    const time = parts[6];
    const name = parts.slice(8).join(' ');

    // Skip . and .. entries
    if (name === '.' || name === '..') return null;

    const type: 'file' | 'directory' | 'symlink' = 
      permissions.startsWith('d') ? 'directory' :
      permissions.startsWith('l') ? 'symlink' : 'file';

    const path = basePath.endsWith('/') ? basePath + name : basePath + '/' + name;

    return {
      name,
      path,
      type,
      size: isNaN(size) ? 0 : size,
      permissions,
      owner,
      group,
      modified: `${date} ${time}`,
      hidden: name.startsWith('.')
    };
  }

  private getFileTypeFromMode(mode: string): 'file' | 'directory' | 'symlink' {
    const firstChar = mode.charAt(0);
    switch (firstChar) {
      case '4': return 'directory';
      case '1': return 'symlink';
      default: return 'file';
    }
  }

  private escapePath(path: string): string {
    return path.replace(/'/g, "'\\''");
  }

  private getParentDirectory(path: string): string {
    if (path === '/') return '/';
    const parts = path.split('/');
    parts.pop();
    return parts.join('/') || '/';
  }

  clearCache(): void {
    this.fileCache.clear();
  }

  dispose(): void {
    this.fileCache.clear();
  }
}

export const fileService = new FileService();
