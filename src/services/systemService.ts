import { SystemMetrics, Process, NetworkInterface } from '@/types';
import { connectionService } from './connectionService';

class SystemService {
  private metricsCache: SystemMetrics | null = null;
  private cacheExpiry = 5000; // 5 seconds
  private lastCacheTime = 0;

  async getSystemMetrics(): Promise<SystemMetrics> {
    try {
      // Return cached data if still fresh
      if (this.metricsCache && Date.now() - this.lastCacheTime < this.cacheExpiry) {
        return this.metricsCache;
      }

      if (!connectionService.isConnected()) {
        throw new Error('Not connected to remote server');
      }

      // Gather all metrics in parallel
      const [
        cpuInfo,
        memoryInfo,
        diskInfo,
        networkInfo,
        loadInfo,
        uptimeInfo
      ] = await Promise.all([
        this.getCpuMetrics(),
        this.getMemoryMetrics(),
        this.getDiskMetrics(),
        this.getNetworkMetrics(),
        this.getLoadMetrics(),
        this.getUptimeMetrics()
      ]);

      const metrics: SystemMetrics = {
        timestamp: new Date().toISOString(),
        cpu: cpuInfo,
        memory: memoryInfo,
        disk: diskInfo,
        network: networkInfo,
        loadAverage: loadInfo,
        uptime: uptimeInfo
      };

      // Cache the results
      this.metricsCache = metrics;
      this.lastCacheTime = Date.now();

      return metrics;
    } catch (error) {
      console.error('Failed to get system metrics:', error);
      throw error;
    }
  }

  async getProcesses(): Promise<Process[]> {
    try {
      if (!connectionService.isConnected()) {
        throw new Error('Not connected to remote server');
      }

      // Use ps command with detailed output
      const command = `ps aux --sort=-%cpu | head -100`;
      const result = await connectionService.executeCommand(command);

      if (result.exitCode !== 0) {
        throw new Error(`Failed to get processes: ${result.output}`);
      }

      return this.parseProcessOutput(result.output);
    } catch (error) {
      console.error('Failed to get processes:', error);
      throw error;
    }
  }

  async getTopProcesses(count: number = 10, sortBy: 'cpu' | 'memory' = 'cpu'): Promise<Process[]> {
    try {
      const processes = await this.getProcesses();
      
      return processes
        .sort((a, b) => {
          if (sortBy === 'cpu') {
            return b.cpu - a.cpu;
          } else {
            return b.memory - a.memory;
          }
        })
        .slice(0, count);
    } catch (error) {
      console.error('Failed to get top processes:', error);
      throw error;
    }
  }

  async killProcess(pid: number, signal: string = 'TERM'): Promise<boolean> {
    try {
      if (!connectionService.isConnected()) {
        throw new Error('Not connected to remote server');
      }

      const command = `kill -${signal} ${pid}`;
      const result = await connectionService.executeCommand(command);

      return result.exitCode === 0;
    } catch (error) {
      console.error('Failed to kill process:', error);
      return false;
    }
  }

  async getSystemInfo(): Promise<{
    hostname: string;
    kernel: string;
    architecture: string;
    os: string;
    shell: string;
  }> {
    try {
      if (!connectionService.isConnected()) {
        throw new Error('Not connected to remote server');
      }

      const command = `echo "HOSTNAME:$(hostname)"; echo "KERNEL:$(uname -r)"; echo "ARCH:$(uname -m)"; echo "OS:$(uname -o)"; echo "SHELL:$SHELL"`;
      const result = await connectionService.executeCommand(command);

      if (result.exitCode !== 0) {
        throw new Error(`Failed to get system info: ${result.output}`);
      }

      const lines = result.output.trim().split('\n');
      const info = {
        hostname: '',
        kernel: '',
        architecture: '',
        os: '',
        shell: ''
      };

      lines.forEach(line => {
        const [key, value] = line.split(':', 2);
        switch (key) {
          case 'HOSTNAME':
            info.hostname = value || '';
            break;
          case 'KERNEL':
            info.kernel = value || '';
            break;
          case 'ARCH':
            info.architecture = value || '';
            break;
          case 'OS':
            info.os = value || '';
            break;
          case 'SHELL':
            info.shell = value || '';
            break;
        }
      });

      return info;
    } catch (error) {
      console.error('Failed to get system info:', error);
      throw error;
    }
  }

  private async getCpuMetrics(): Promise<SystemMetrics['cpu']> {
    // Get CPU information
    const cpuInfoCommand = `nproc && cat /proc/stat | head -1 && cat /proc/cpuinfo | grep "cpu MHz" | head -1`;
    const result = await connectionService.executeCommand(cpuInfoCommand);

    if (result.exitCode !== 0) {
      throw new Error(`Failed to get CPU metrics: ${result.output}`);
    }

    const lines = result.output.trim().split('\n');
    const cores = parseInt(lines[0]) || 1;
    
    // Parse CPU usage from /proc/stat
    let usage = 0;
    if (lines[1]) {
      const statLine = lines[1].split(/\s+/);
      if (statLine.length >= 8) {
        const idle = parseInt(statLine[4]) || 0;
        const iowait = parseInt(statLine[5]) || 0;
        const total = statLine.slice(1, 8).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
        usage = total > 0 ? ((total - idle - iowait) / total) * 100 : 0;
      }
    }

    // Parse frequency
    let frequency = 0;
    if (lines[2]) {
      const freqMatch = lines[2].match(/(\d+\.?\d*)/);
      if (freqMatch) {
        frequency = parseFloat(freqMatch[1]);
      }
    }

    return {
      usage,
      cores,
      frequency,
      temperature: await this.getCpuTemperature()
    };
  }

  private async getCpuTemperature(): Promise<number | undefined> {
    try {
      const command = `sensors 2>/dev/null | grep -E "Core|CPU" | head -1 | grep -oE "[0-9]+\\.[0-9]+°C" | head -1 | grep -oE "[0-9]+\\.[0-9]+"`;
      const result = await connectionService.executeCommand(command);
      
      if (result.exitCode === 0 && result.output.trim()) {
        return parseFloat(result.output.trim());
      }
    } catch (error) {
      // Temperature monitoring might not be available
    }
    return undefined;
  }

  private async getMemoryMetrics(): Promise<SystemMetrics['memory']> {
    const command = `free -b && cat /proc/meminfo | grep -E "(SwapTotal|SwapFree)" | head -2`;
    const result = await connectionService.executeCommand(command);

    if (result.exitCode !== 0) {
      throw new Error(`Failed to get memory metrics: ${result.output}`);
    }

    const lines = result.output.trim().split('\n');
    
    // Parse free output
    const memLine = lines.find(line => line.startsWith('Mem:'));
    if (!memLine) {
      throw new Error('Could not parse memory information');
    }

    const memParts = memLine.split(/\s+/);
    const total = parseInt(memParts[1]) || 0;
    const used = parseInt(memParts[2]) || 0;
    const free = parseInt(memParts[3]) || 0;
    const percentage = total > 0 ? (used / total) * 100 : 0;

    // Parse swap information
    let swapTotal = 0;
    let swapFree = 0;
    
    lines.forEach(line => {
      if (line.includes('SwapTotal:')) {
        const match = line.match(/(\d+)\s*kB/);
        if (match) swapTotal = parseInt(match[1]) * 1024;
      } else if (line.includes('SwapFree:')) {
        const match = line.match(/(\d+)\s*kB/);
        if (match) swapFree = parseInt(match[1]) * 1024;
      }
    });

    const swapUsed = swapTotal - swapFree;

    return {
      total,
      used,
      free,
      percentage,
      swap: swapTotal > 0 ? {
        total: swapTotal,
        used: swapUsed,
        free: swapFree
      } : undefined
    };
  }

  private async getDiskMetrics(): Promise<SystemMetrics['disk']> {
    const command = `df -B1 / | tail -1`;
    const result = await connectionService.executeCommand(command);

    if (result.exitCode !== 0) {
      throw new Error(`Failed to get disk metrics: ${result.output}`);
    }

    const line = result.output.trim();
    const parts = line.split(/\s+/);
    
    if (parts.length < 6) {
      throw new Error('Could not parse disk information');
    }

    const total = parseInt(parts[1]) || 0;
    const used = parseInt(parts[2]) || 0;
    const free = parseInt(parts[3]) || 0;
    const percentage = total > 0 ? (used / total) * 100 : 0;

    // Get disk I/O stats
    const ioStats = await this.getDiskIOStats();

    return {
      total,
      used,
      free,
      percentage,
      reads: ioStats.reads,
      writes: ioStats.writes
    };
  }

  private async getDiskIOStats(): Promise<{ reads: number; writes: number }> {
    try {
      const command = `cat /proc/diskstats | grep -E "sd[a-z]$|nvme[0-9]+n[0-9]+$" | head -1`;
      const result = await connectionService.executeCommand(command);

      if (result.exitCode === 0 && result.output.trim()) {
        const parts = result.output.trim().split(/\s+/);
        if (parts.length >= 14) {
          return {
            reads: parseInt(parts[5]) || 0,
            writes: parseInt(parts[9]) || 0
          };
        }
      }
    } catch (error) {
      // I/O stats might not be available
    }

    return { reads: 0, writes: 0 };
  }

  private async getNetworkMetrics(): Promise<SystemMetrics['network']> {
    // Get network interfaces
    const interfacesCommand = `ip addr show | grep -E "^[0-9]+:" | grep -v "lo:"`;
    const interfacesResult = await connectionService.executeCommand(interfacesCommand);

    const interfaces: NetworkInterface[] = [];
    
    if (interfacesResult.exitCode === 0) {
      const interfaceLines = interfacesResult.output.trim().split('\n');
      
      for (const line of interfaceLines) {
        const match = line.match(/^(\d+):\s+(\w+):/);
        if (match) {
          const interfaceName = match[2];
          const interfaceInfo = await this.getInterfaceInfo(interfaceName);
          if (interfaceInfo) {
            interfaces.push(interfaceInfo);
          }
        }
      }
    }

    // Get overall network stats
    const statsCommand = `cat /proc/net/dev | grep -E "eth|wlan|enp|wlp" | head -1`;
    const statsResult = await connectionService.executeCommand(statsCommand);

    let bytesIn = 0;
    let bytesOut = 0;
    let packetsIn = 0;
    let packetsOut = 0;

    if (statsResult.exitCode === 0 && statsResult.output.trim()) {
      const parts = statsResult.output.trim().split(/\s+/);
      if (parts.length >= 17) {
        bytesIn = parseInt(parts[1]) || 0;
        packetsIn = parseInt(parts[2]) || 0;
        bytesOut = parseInt(parts[9]) || 0;
        packetsOut = parseInt(parts[10]) || 0;
      }
    }

    return {
      bytesIn,
      bytesOut,
      packetsIn,
      packetsOut,
      interfaces
    };
  }

  private async getInterfaceInfo(interfaceName: string): Promise<NetworkInterface | null> {
    try {
      const command = `ip addr show ${interfaceName} | grep -E "(inet |link/ether )" | head -2`;
      const result = await connectionService.executeCommand(command);

      if (result.exitCode !== 0) return null;

      const lines = result.output.trim().split('\n');
      let ip = '';
      let mac = '';

      lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('inet ')) {
          const ipMatch = trimmed.match(/inet ([0-9.]+)/);
          if (ipMatch) ip = ipMatch[1];
        } else if (trimmed.startsWith('link/ether ')) {
          const macMatch = trimmed.match(/link\/ether ([0-9a-f:]+)/);
          if (macMatch) mac = macMatch[1];
        }
      });

      // Get interface status
      const statusCommand = `cat /sys/class/net/${interfaceName}/operstate 2>/dev/null || echo unknown`;
      const statusResult = await connectionService.executeCommand(statusCommand);
      const status = statusResult.output.trim() === 'up' ? 'up' : 'down';

      return {
        name: interfaceName,
        ip: ip || 'N/A',
        mac: mac || 'N/A',
        type: interfaceName.startsWith('wl') ? 'wireless' : 'ethernet',
        status: status as 'up' | 'down'
      };
    } catch (error) {
      return null;
    }
  }

  private async getLoadMetrics(): Promise<number[]> {
    const command = `cat /proc/loadavg`;
    const result = await connectionService.executeCommand(command);

    if (result.exitCode !== 0) {
      throw new Error(`Failed to get load metrics: ${result.output}`);
    }

    const parts = result.output.trim().split(/\s+/);
    return [
      parseFloat(parts[0]) || 0,
      parseFloat(parts[1]) || 0,
      parseFloat(parts[2]) || 0
    ];
  }

  private async getUptimeMetrics(): Promise<number> {
    const command = `cat /proc/uptime`;
    const result = await connectionService.executeCommand(command);

    if (result.exitCode !== 0) {
      throw new Error(`Failed to get uptime: ${result.output}`);
    }

    const uptime = parseFloat(result.output.trim().split(' ')[0]) || 0;
    return Math.floor(uptime);
  }

  private parseProcessOutput(output: string): Process[] {
    const lines = output.trim().split('\n');
    const processes: Process[] = [];

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse ps aux output
      // USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND
      const parts = line.split(/\s+/);
      if (parts.length < 11) continue;

      const user = parts[0];
      const pid = parseInt(parts[1]);
      const cpu = parseFloat(parts[2]) || 0;
      const memory = parseFloat(parts[3]) || 0;
      const stat = parts[7];
      const startTime = parts[8];
      const time = parts[9];
      const command = parts.slice(10).join(' ');

      // Extract process name from command
      const commandParts = command.split(' ');
      const name = commandParts[0].split('/').pop() || commandParts[0];

      if (pid && !isNaN(pid)) {
        processes.push({
          pid,
          name,
          user,
          cpu,
          memory,
          status: stat,
          command,
          startTime,
          threads: undefined // Not available in ps aux output
        });
      }
    }

    return processes;
  }

  clearCache(): void {
    this.metricsCache = null;
    this.lastCacheTime = 0;
  }

  dispose(): void {
    this.clearCache();
  }
}

export const systemService = new SystemService();
