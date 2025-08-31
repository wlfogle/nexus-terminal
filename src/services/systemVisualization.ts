import { SystemMetrics, Process } from '@/types';

interface Node3D {
  id: string;
  position: [number, number, number];
  size: number;
  color: string;
  type: 'cpu' | 'memory' | 'disk' | 'network' | 'process' | 'service';
  data: any;
  connections: string[];
}

interface Connection3D {
  from: string;
  to: string;
  strength: number;
  type: 'data' | 'control' | 'dependency';
  animated: boolean;
}

class SystemVisualization {
  private nodes: Map<string, Node3D> = new Map();
  private connections: Connection3D[] = [];
  private animationFrame: number | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    console.log('🌐 3D System Visualization initialized');
  }

  generateSystemMap(metrics: SystemMetrics, processes: Process[]): {
    nodes: Node3D[];
    connections: Connection3D[];
    centerPoint: [number, number, number];
  } {
    this.nodes.clear();
    this.connections = [];

    // Central system node
    this.nodes.set('system', {
      id: 'system',
      position: [0, 0, 0],
      size: 2.0,
      color: '#4CAF50',
      type: 'cpu',
      data: { name: 'System Core', usage: metrics.cpu.usage },
      connections: ['cpu', 'memory', 'disk', 'network']
    });

    // Resource nodes
    this.nodes.set('cpu', {
      id: 'cpu',
      position: [3, 0, 0],
      size: 1.5 + (metrics.cpu.usage / 100),
      color: this.getUsageColor(metrics.cpu.usage),
      type: 'cpu',
      data: { name: 'CPU', usage: metrics.cpu.usage, cores: metrics.cpu.cores },
      connections: []
    });

    this.nodes.set('memory', {
      id: 'memory',
      position: [-3, 0, 0],
      size: 1.5 + (metrics.memory.percentage / 100),
      color: this.getUsageColor(metrics.memory.percentage),
      type: 'memory',
      data: { name: 'Memory', usage: metrics.memory.percentage, total: metrics.memory.total },
      connections: []
    });

    this.nodes.set('disk', {
      id: 'disk',
      position: [0, 3, 0],
      size: 1.5 + (metrics.disk.percentage / 100),
      color: this.getUsageColor(metrics.disk.percentage),
      type: 'disk',
      data: { name: 'Disk', usage: metrics.disk.percentage, total: metrics.disk.total },
      connections: []
    });

    // Process nodes
    const topProcesses = processes
      .sort((a, b) => (b.cpu + b.memory) - (a.cpu + a.memory))
      .slice(0, 20);

    topProcesses.forEach((process, index) => {
      const angle = (index / topProcesses.length) * Math.PI * 2;
      const radius = 5;
      const height = (process.cpu / 100) * 3;

      this.nodes.set(`process_${process.pid}`, {
        id: `process_${process.pid}`,
        position: [
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
          height
        ],
        size: 0.5 + (process.memory / 100),
        color: this.getProcessColor(process),
        type: 'process',
        data: process,
        connections: ['system']
      });

      this.connections.push({
        from: 'system',
        to: `process_${process.pid}`,
        strength: (process.cpu + process.memory) / 200,
        type: 'control',
        animated: process.cpu > 10
      });
    });

    return {
      nodes: Array.from(this.nodes.values()),
      connections: this.connections,
      centerPoint: [0, 0, 0]
    };
  }

  generateNetworkTopology(connections: any[]): {
    nodes: Node3D[];
    connections: Connection3D[];
  } {
    const networkNodes: Node3D[] = [];
    const networkConnections: Connection3D[] = [];

    connections.forEach((conn, index) => {
      const angle = (index / connections.length) * Math.PI * 2;
      const radius = 4;

      networkNodes.push({
        id: `conn_${index}`,
        position: [Math.cos(angle) * radius, Math.sin(angle) * radius, 0],
        size: 0.8,
        color: conn.state === 'ESTABLISHED' ? '#4CAF50' : '#FF9800',
        type: 'network',
        data: conn,
        connections: []
      });
    });

    return { nodes: networkNodes, connections: networkConnections };
  }

  private getUsageColor(usage: number): string {
    if (usage < 50) return '#4CAF50';
    if (usage < 80) return '#FF9800';
    return '#F44336';
  }

  private getProcessColor(process: Process): string {
    if (process.user === 'root') return '#9C27B0';
    if (process.cpu > 50) return '#F44336';
    if (process.memory > 50) return '#FF9800';
    return '#2196F3';
  }
}

export const systemVisualization = new SystemVisualization();
