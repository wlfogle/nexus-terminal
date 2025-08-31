import { FileItem } from '@/types';
import { fileService } from './fileService';
import { connectionService } from './connectionService';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface BatchOperation {
  id: string;
  type: 'copy' | 'move' | 'delete' | 'compress' | 'extract';
  files: string[];
  destination?: string;
  progress: number;
  status: 'pending' | 'running' | 'completed' | 'error';
  error?: string;
}

interface SearchOptions {
  pattern: string;
  caseSensitive: boolean;
  includeContent: boolean;
  fileTypes: string[];
  maxDepth: number;
  maxResults: number;
}

interface SearchResult {
  file: FileItem;
  matches: Array<{
    line: number;
    content: string;
    position: number;
  }>;
}

interface FileArchive {
  name: string;
  type: 'tar' | 'tar.gz' | 'tar.bz2' | 'zip';
  files: string[];
  size: number;
  compressed: boolean;
}

class AdvancedFileService {
  private batchOperations: Map<string, BatchOperation> = new Map();
  private searchCache: Map<string, SearchResult[]> = new Map();
  private compressionFormats = ['tar', 'tar.gz', 'tar.bz2', 'zip'];
  private batchCallbacks: ((operations: BatchOperation[]) => void)[] = [];

  async initialize(): Promise<void> {
    console.log('📁 Advanced File Service initialized');
  }

  // Batch Operations
  async startBatchOperation(
    type: 'copy' | 'move' | 'delete' | 'compress' | 'extract',
    files: string[],
    destination?: string
  ): Promise<string> {
    const operationId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const operation: BatchOperation = {
      id: operationId,
      type,
      files,
      destination,
      progress: 0,
      status: 'pending'
    };

    this.batchOperations.set(operationId, operation);
    this.notifyBatchChange();

    // Start operation asynchronously
    this.executeBatchOperation(operationId);

    return operationId;
  }

  async cancelBatchOperation(operationId: string): Promise<boolean> {
    const operation = this.batchOperations.get(operationId);
    if (!operation) return false;

    if (operation.status === 'running') {
      operation.status = 'error';
      operation.error = 'Cancelled by user';
      this.notifyBatchChange();
    }

    return true;
  }

  getBatchOperations(): BatchOperation[] {
    return Array.from(this.batchOperations.values())
      .sort((a, b) => b.id.localeCompare(a.id));
  }

  // File Search
  async searchFiles(directory: string, options: SearchOptions): Promise<SearchResult[]> {
    try {
      const cacheKey = `${directory}_${JSON.stringify(options)}`;
      const cached = this.searchCache.get(cacheKey);
      if (cached) return cached;

      if (!connectionService.isConnected()) {
        throw new Error('Not connected to remote server');
      }

      const results: SearchResult[] = [];
      
      // Build find command
      let findCommand = `find "${directory}"`;
      
      if (options.maxDepth > 0) {
        findCommand += ` -maxdepth ${options.maxDepth}`;
      }

      // Add file type filters
      if (options.fileTypes.length > 0) {
        const typeConditions = options.fileTypes.map(type => `-name "*.${type}"`).join(' -o ');
        findCommand += ` \\( ${typeConditions} \\)`;
      }

      findCommand += ' -type f';

      const findResult = await connectionService.executeCommand(findCommand);
      
      if (findResult.exitCode !== 0) {
        throw new Error(`Find command failed: ${findResult.output}`);
      }

      const foundFiles = findResult.output.trim().split('\n').filter(line => line.trim());

      // Search within files if content search is enabled
      for (const filePath of foundFiles.slice(0, options.maxResults)) {
        try {
          const fileInfo = await fileService.getFileInfo(filePath);
          if (!fileInfo) continue;

          const searchResult: SearchResult = {
            file: fileInfo,
            matches: []
          };

          // Check filename match
          const filenameMatch = options.caseSensitive 
            ? fileInfo.name.includes(options.pattern)
            : fileInfo.name.toLowerCase().includes(options.pattern.toLowerCase());

          if (filenameMatch) {
            searchResult.matches.push({
              line: 0,
              content: fileInfo.name,
              position: fileInfo.name.indexOf(options.pattern)
            });
          }

          // Search file content if enabled and it's a text file
          if (options.includeContent && fileInfo.type === 'file' && fileInfo.size < 1024 * 1024) {
            try {
              const grepCommand = options.caseSensitive
                ? `grep -n "${options.pattern}" "${filePath}"`
                : `grep -ni "${options.pattern}" "${filePath}"`;

              const grepResult = await connectionService.executeCommand(grepCommand);
              
              if (grepResult.exitCode === 0) {
                const lines = grepResult.output.trim().split('\n');
                lines.forEach(line => {
                  const match = line.match(/^(\d+):(.*)$/);
                  if (match) {
                    const lineNumber = parseInt(match[1]);
                    const content = match[2];
                    const position = content.indexOf(options.pattern);
                    
                    searchResult.matches.push({
                      line: lineNumber,
                      content,
                      position
                    });
                  }
                });
              }
            } catch (contentError) {
              // Content search failed, skip
            }
          }

          if (searchResult.matches.length > 0) {
            results.push(searchResult);
          }
        } catch (fileError) {
          // Skip files that can't be processed
        }
      }

      // Cache results for 5 minutes
      this.searchCache.set(cacheKey, results);
      setTimeout(() => this.searchCache.delete(cacheKey), 300000);

      return results;
    } catch (error) {
      console.error('File search failed:', error);
      throw error;
    }
  }

  // File Compression
  async compressFiles(files: string[], archiveName: string, format: 'tar' | 'tar.gz' | 'tar.bz2' | 'zip'): Promise<boolean> {
    try {
      if (!connectionService.isConnected()) {
        throw new Error('Not connected to remote server');
      }

      const fileList = files.map(f => `"${f}"`).join(' ');
      let command: string;

      switch (format) {
        case 'tar':
          command = `tar -cf "${archiveName}" ${fileList}`;
          break;
        case 'tar.gz':
          command = `tar -czf "${archiveName}" ${fileList}`;
          break;
        case 'tar.bz2':
          command = `tar -cjf "${archiveName}" ${fileList}`;
          break;
        case 'zip':
          command = `zip -r "${archiveName}" ${fileList}`;
          break;
        default:
          throw new Error('Unsupported compression format');
      }

      const result = await connectionService.executeCommand(command);
      
      if (result.exitCode !== 0) {
        throw new Error(`Compression failed: ${result.output}`);
      }

      return true;
    } catch (error) {
      console.error('File compression failed:', error);
      throw error;
    }
  }

  async extractArchive(archivePath: string, extractPath: string): Promise<boolean> {
    try {
      if (!connectionService.isConnected()) {
        throw new Error('Not connected to remote server');
      }

      const format = this.detectArchiveFormat(archivePath);
      let command: string;

      switch (format) {
        case 'tar':
          command = `tar -xf "${archivePath}" -C "${extractPath}"`;
          break;
        case 'tar.gz':
          command = `tar -xzf "${archivePath}" -C "${extractPath}"`;
          break;
        case 'tar.bz2':
          command = `tar -xjf "${archivePath}" -C "${extractPath}"`;
          break;
        case 'zip':
          command = `unzip "${archivePath}" -d "${extractPath}"`;
          break;
        default:
          throw new Error('Unsupported archive format');
      }

      const result = await connectionService.executeCommand(command);
      
      if (result.exitCode !== 0) {
        throw new Error(`Extraction failed: ${result.output}`);
      }

      return true;
    } catch (error) {
      console.error('Archive extraction failed:', error);
      throw error;
    }
  }

  async listArchiveContents(archivePath: string): Promise<FileArchive> {
    try {
      if (!connectionService.isConnected()) {
        throw new Error('Not connected to remote server');
      }

      const format = this.detectArchiveFormat(archivePath);
      let command: string;

      switch (format) {
        case 'tar':
        case 'tar.gz':
        case 'tar.bz2':
          command = `tar -tf "${archivePath}"`;
          break;
        case 'zip':
          command = `unzip -l "${archivePath}"`;
          break;
        default:
          throw new Error('Unsupported archive format');
      }

      const result = await connectionService.executeCommand(command);
      
      if (result.exitCode !== 0) {
        throw new Error(`Failed to list archive: ${result.output}`);
      }

      const files = this.parseArchiveList(result.output, format);
      
      // Get archive size
      const sizeResult = await connectionService.executeCommand(`stat -c %s "${archivePath}"`);
      const size = parseInt(sizeResult.output.trim()) || 0;

      return {
        name: archivePath.split('/').pop() || archivePath,
        type: format,
        files,
        size,
        compressed: format !== 'tar'
      };
    } catch (error) {
      console.error('Archive listing failed:', error);
      throw error;
    }
  }

  // Advanced Permissions
  async setAdvancedPermissions(path: string, permissions: {
    user: { read: boolean; write: boolean; execute: boolean };
    group: { read: boolean; write: boolean; execute: boolean };
    other: { read: boolean; write: boolean; execute: boolean };
  }): Promise<boolean> {
    try {
      const octal = this.permissionsToOctal(permissions);
      return await fileService.changePermissions(path, octal);
    } catch (error) {
      console.error('Advanced permissions change failed:', error);
      throw error;
    }
  }

  async setOwnership(path: string, owner: string, group?: string): Promise<boolean> {
    try {
      if (!connectionService.isConnected()) {
        throw new Error('Not connected to remote server');
      }

      const ownerGroup = group ? `${owner}:${group}` : owner;
      const command = `chown ${ownerGroup} "${path}"`;
      
      const result = await connectionService.executeCommand(command);
      
      return result.exitCode === 0;
    } catch (error) {
      console.error('Ownership change failed:', error);
      throw error;
    }
  }

  // File Monitoring
  async watchFile(path: string, callback: (event: string, filename: string) => void): Promise<string> {
    try {
      if (!connectionService.isConnected()) {
        throw new Error('Not connected to remote server');
      }

      const watchId = `watch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Use inotifywait for file monitoring
      const command = `inotifywait -m -e create,delete,modify,move "${path}"`;
      
      // This would need special WebSocket handling for streaming output
      console.log(`👁️ Watching file: ${path}`);
      
      return watchId;
    } catch (error) {
      console.error('File watching failed:', error);
      throw error;
    }
  }

  async stopWatching(watchId: string): Promise<void> {
    console.log(`👁️ Stopped watching: ${watchId}`);
  }

  onBatchOperationChange(callback: (operations: BatchOperation[]) => void): void {
    this.batchCallbacks.push(callback);
  }

  // Private Methods
  private async executeBatchOperation(operationId: string): Promise<void> {
    const operation = this.batchOperations.get(operationId);
    if (!operation) return;

    try {
      operation.status = 'running';
      this.notifyBatchChange();

      const totalFiles = operation.files.length;
      let processedFiles = 0;

      for (const filePath of operation.files) {
        try {
          switch (operation.type) {
            case 'copy':
              if (operation.destination) {
                await fileService.copyFile(filePath, operation.destination);
              }
              break;
            case 'move':
              if (operation.destination) {
                await fileService.moveFile(filePath, operation.destination);
              }
              break;
            case 'delete':
              await fileService.deleteFile(filePath);
              break;
            case 'compress':
              // Handle in compressFiles method
              break;
            case 'extract':
              // Handle in extractArchive method
              break;
          }

          processedFiles++;
          operation.progress = (processedFiles / totalFiles) * 100;
          this.notifyBatchChange();
        } catch (fileError) {
          console.error(`Batch operation failed for ${filePath}:`, fileError);
        }
      }

      operation.status = 'completed';
      operation.progress = 100;
    } catch (error) {
      operation.status = 'error';
      operation.error = error.message;
    }

    this.notifyBatchChange();
  }

  private detectArchiveFormat(filename: string): 'tar' | 'tar.gz' | 'tar.bz2' | 'zip' {
    if (filename.endsWith('.tar.gz') || filename.endsWith('.tgz')) return 'tar.gz';
    if (filename.endsWith('.tar.bz2') || filename.endsWith('.tbz2')) return 'tar.bz2';
    if (filename.endsWith('.tar')) return 'tar';
    if (filename.endsWith('.zip')) return 'zip';
    throw new Error('Unknown archive format');
  }

  private parseArchiveList(output: string, format: string): string[] {
    const lines = output.trim().split('\n');
    
    if (format === 'zip') {
      // Parse zip listing
      return lines
        .filter(line => !line.includes('Archive:') && !line.includes('Length') && line.trim())
        .map(line => {
          const parts = line.trim().split(/\s+/);
          return parts[parts.length - 1];
        })
        .filter(name => name && name !== 'Name');
    } else {
      // Parse tar listing
      return lines.filter(line => line.trim());
    }
  }

  private permissionsToOctal(permissions: {
    user: { read: boolean; write: boolean; execute: boolean };
    group: { read: boolean; write: boolean; execute: boolean };
    other: { read: boolean; write: boolean; execute: boolean };
  }): string {
    const calculateOctal = (perms: { read: boolean; write: boolean; execute: boolean }): number => {
      let value = 0;
      if (perms.read) value += 4;
      if (perms.write) value += 2;
      if (perms.execute) value += 1;
      return value;
    };

    const user = calculateOctal(permissions.user);
    const group = calculateOctal(permissions.group);
    const other = calculateOctal(permissions.other);

    return `${user}${group}${other}`;
  }

  private notifyBatchChange(): void {
    const operations = this.getBatchOperations();
    this.batchCallbacks.forEach(callback => {
      try {
        callback(operations);
      } catch (error) {
        console.error('Batch callback error:', error);
      }
    });
  }

  dispose(): void {
    this.batchOperations.clear();
    this.searchCache.clear();
    this.batchCallbacks = [];
  }
}

export const advancedFileService = new AdvancedFileService();
