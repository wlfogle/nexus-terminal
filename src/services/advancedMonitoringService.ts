import AsyncStorage from '@react-native-async-storage/async-storage';
import { systemService } from './systemService';
import { SystemMetrics } from '@/types';

interface MetricPoint {
  timestamp: Date;
  value: number;
  metadata?: Record<string, any>;
}

interface MetricSeries {
  id: string;
  name: string;
  unit: string;
  points: MetricPoint[];
  color: string;
  visible: boolean;
  aggregation: 'avg' | 'sum' | 'min' | 'max' | 'count';
}

interface Dashboard {
  id: string;
  name: string;
  description: string;
  widgets: DashboardWidget[];
  layout: LayoutConfig;
  createdAt: Date;
  updatedAt: Date;
  isDefault: boolean;
}

interface DashboardWidget {
  id: string;
  type: 'chart' | 'gauge' | 'table' | 'text' | 'alert';
  title: string;
  position: { x: number; y: number; width: number; height: number };
  config: WidgetConfig;
  refreshInterval: number; // seconds
  lastUpdated?: Date;
}

interface WidgetConfig {
  chartType?: 'line' | 'area' | 'bar' | 'pie' | 'scatter';
  metrics?: string[];
  timeRange?: TimeRange;
  aggregation?: 'avg' | 'sum' | 'min' | 'max';
  threshold?: AlertThreshold;
  query?: string;
  displayFormat?: 'percentage' | 'bytes' | 'number' | 'duration';
}

interface LayoutConfig {
  columns: number;
  rows: number;
  autoLayout: boolean;
  responsive: boolean;
}

interface TimeRange {
  start: Date | 'now-1h' | 'now-24h' | 'now-7d' | 'now-30d';
  end: Date | 'now';
  groupBy?: '1m' | '5m' | '1h' | '1d';
}

interface AlertThreshold {
  warning: number;
  critical: number;
  comparison: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'neq';
}

interface CustomMetric {
  id: string;
  name: string;
  description: string;
  query: string;
  unit: string;
  category: string;
  enabled: boolean;
  interval: number; // seconds
  retention: number; // days
  alerts: AlertRule[];
}

interface AlertRule {
  id: string;
  metricId: string;
  name: string;
  condition: string;
  threshold: number;
  severity: 'info' | 'warning' | 'error' | 'critical';
  enabled: boolean;
  notificationChannels: string[];
  cooldown: number; // minutes
  lastTriggered?: Date;
}

interface HistoricalData {
  metricId: string;
  period: 'hourly' | 'daily' | 'weekly' | 'monthly';
  aggregatedPoints: MetricPoint[];
  retention: number; // days
}

class AdvancedMonitoringService {
  private metrics: Map<string, MetricSeries> = new Map();
  private dashboards: Map<string, Dashboard> = new Map();
  private customMetrics: Map<string, CustomMetric> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private historicalData: Map<string, HistoricalData[]> = new Map();
  private collectInterval: NodeJS.Timeout | null = null;
  private alertInterval: NodeJS.Timeout | null = null;
  
  private readonly STORAGE_KEYS = {
    METRICS: 'monitoring_metrics',
    DASHBOARDS: 'monitoring_dashboards',
    CUSTOM_METRICS: 'monitoring_custom_metrics',
    ALERT_RULES: 'monitoring_alert_rules',
    HISTORICAL_DATA: 'monitoring_historical_data'
  };

  private readonly DEFAULT_METRICS = [
    { id: 'cpu_usage', name: 'CPU Usage', unit: '%', color: '#FF6B6B' },
    { id: 'memory_usage', name: 'Memory Usage', unit: '%', color: '#4ECDC4' },
    { id: 'disk_usage', name: 'Disk Usage', unit: '%', color: '#45B7D1' },
    { id: 'network_in', name: 'Network In', unit: 'MB/s', color: '#96CEB4' },
    { id: 'network_out', name: 'Network Out', unit: 'MB/s', color: '#FECA57' },
    { id: 'load_average', name: 'Load Average', unit: '', color: '#FF9FF3' },
    { id: 'process_count', name: 'Process Count', unit: '', color: '#54A0FF' }
  ];

  async initialize(): Promise<void> {
    await this.loadData();
    this.initializeDefaultMetrics();
    await this.createDefaultDashboard();
    this.startMetricCollection();
    this.startAlertMonitoring();
    console.log('📊 Advanced Monitoring Service initialized');
  }

  // Metric Collection
  async collectSystemMetrics(): Promise<void> {
    try {
      const metrics = await systemService.getSystemMetrics();
      const timestamp = new Date();

      // CPU Usage
      this.addMetricPoint('cpu_usage', {
        timestamp,
        value: metrics.cpu.usage,
        metadata: { cores: metrics.cpu.cores }
      });

      // Memory Usage
      this.addMetricPoint('memory_usage', {
        timestamp,
        value: (metrics.memory.used / metrics.memory.total) * 100,
        metadata: { 
          used: metrics.memory.used,
          total: metrics.memory.total,
          available: metrics.memory.available
        }
      });

      // Disk Usage (average across all disks)
      if (metrics.disk.length > 0) {
        const avgDiskUsage = metrics.disk.reduce((sum, disk) => sum + disk.usage, 0) / metrics.disk.length;
        this.addMetricPoint('disk_usage', {
          timestamp,
          value: avgDiskUsage,
          metadata: { disks: metrics.disk }
        });
      }

      // Network Usage
      this.addMetricPoint('network_in', {
        timestamp,
        value: metrics.network.bytesReceived / 1024 / 1024, // Convert to MB
        metadata: { bytes: metrics.network.bytesReceived }
      });

      this.addMetricPoint('network_out', {
        timestamp,
        value: metrics.network.bytesSent / 1024 / 1024, // Convert to MB
        metadata: { bytes: metrics.network.bytesSent }
      });

      // Load Average
      this.addMetricPoint('load_average', {
        timestamp,
        value: metrics.loadAverage[0],
        metadata: { 
          load1: metrics.loadAverage[0],
          load5: metrics.loadAverage[1],
          load15: metrics.loadAverage[2]
        }
      });

      // Process Count
      this.addMetricPoint('process_count', {
        timestamp,
        value: metrics.processes.length,
        metadata: { processes: metrics.processes.length }
      });

      // Collect custom metrics
      await this.collectCustomMetrics();
      
      // Save metrics periodically
      await this.saveMetrics();
    } catch (error) {
      console.error('Failed to collect system metrics:', error);
    }
  }

  // Dashboard Management
  async createDashboard(
    name: string,
    description: string,
    widgets: DashboardWidget[] = [],
    layout: LayoutConfig = { columns: 12, rows: 8, autoLayout: true, responsive: true }
  ): Promise<string> {
    const dashboardId = `dashboard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const dashboard: Dashboard = {
      id: dashboardId,
      name,
      description,
      widgets,
      layout,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDefault: false
    };

    this.dashboards.set(dashboardId, dashboard);
    await this.saveDashboards();

    return dashboardId;
  }

  async updateDashboard(dashboardId: string, updates: Partial<Dashboard>): Promise<boolean> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) return false;

    Object.assign(dashboard, {
      ...updates,
      updatedAt: new Date()
    });

    this.dashboards.set(dashboardId, dashboard);
    await this.saveDashboards();
    
    return true;
  }

  getDashboards(): Dashboard[] {
    return Array.from(this.dashboards.values())
      .sort((a, b) => {
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      });
  }

  getDashboard(dashboardId: string): Dashboard | undefined {
    return this.dashboards.get(dashboardId);
  }

  // Custom Metrics
  async createCustomMetric(
    name: string,
    query: string,
    options: {
      description?: string;
      unit?: string;
      category?: string;
      interval?: number;
      retention?: number;
    } = {}
  ): Promise<string> {
    const metricId = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const metric: CustomMetric = {
      id: metricId,
      name,
      description: options.description || '',
      query,
      unit: options.unit || '',
      category: options.category || 'Custom',
      enabled: true,
      interval: options.interval || 60, // 1 minute default
      retention: options.retention || 30, // 30 days default
      alerts: []
    };

    this.customMetrics.set(metricId, metric);
    
    // Initialize metric series
    this.metrics.set(metricId, {
      id: metricId,
      name,
      unit: metric.unit,
      points: [],
      color: this.generateRandomColor(),
      visible: true,
      aggregation: 'avg'
    });

    await this.saveCustomMetrics();
    return metricId;
  }

  // Data Queries
  getMetricData(
    metricId: string,
    timeRange: TimeRange,
    aggregation: 'avg' | 'sum' | 'min' | 'max' = 'avg'
  ): MetricPoint[] {
    const metric = this.metrics.get(metricId);
    if (!metric) return [];

    let points = metric.points;

    // Filter by time range
    const now = new Date();
    let startTime: Date;
    
    if (typeof timeRange.start === 'string') {
      switch (timeRange.start) {
        case 'now-1h':
          startTime = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case 'now-24h':
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'now-7d':
          startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'now-30d':
          startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startTime = new Date(now.getTime() - 60 * 60 * 1000);
      }
    } else {
      startTime = timeRange.start;
    }

    const endTime = timeRange.end === 'now' ? now : timeRange.end;

    points = points.filter(point => 
      point.timestamp >= startTime && point.timestamp <= endTime
    );

    // Group by time if specified
    if (timeRange.groupBy) {
      points = this.aggregatePoints(points, timeRange.groupBy, aggregation);
    }

    return points;
  }

  getAvailableMetrics(): Array<{ id: string; name: string; unit: string; category: string }> {
    const systemMetrics = this.DEFAULT_METRICS.map(m => ({ ...m, category: 'System' }));
    const customMetrics = Array.from(this.customMetrics.values()).map(m => ({
      id: m.id,
      name: m.name,
      unit: m.unit,
      category: m.category
    }));

    return [...systemMetrics, ...customMetrics];
  }

  // Alert Management
  async createAlertRule(
    metricId: string,
    name: string,
    condition: string,
    threshold: number,
    severity: 'info' | 'warning' | 'error' | 'critical',
    notificationChannels: string[] = []
  ): Promise<string> {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const alertRule: AlertRule = {
      id: alertId,
      metricId,
      name,
      condition,
      threshold,
      severity,
      enabled: true,
      notificationChannels,
      cooldown: 5 // 5 minutes default
    };

    this.alertRules.set(alertId, alertRule);
    await this.saveAlertRules();

    return alertId;
  }

  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values())
      .sort((a, b) => (b.lastTriggered?.getTime() || 0) - (a.lastTriggered?.getTime() || 0));
  }

  // Historical Data Management
  async getHistoricalData(
    metricId: string,
    period: 'hourly' | 'daily' | 'weekly' | 'monthly',
    limit: number = 100
  ): Promise<MetricPoint[]> {
    const historical = this.historicalData.get(metricId);
    if (!historical) return [];

    const periodData = historical.find(h => h.period === period);
    if (!periodData) return [];

    return periodData.aggregatedPoints
      .slice(-limit)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async exportMetrics(metricIds: string[], timeRange: TimeRange): Promise<string> {
    const exportData: any = {
      timestamp: new Date(),
      timeRange,
      metrics: {}
    };

    for (const metricId of metricIds) {
      const data = this.getMetricData(metricId, timeRange);
      const metric = this.metrics.get(metricId);
      
      if (metric) {
        exportData.metrics[metricId] = {
          name: metric.name,
          unit: metric.unit,
          data: data
        };
      }
    }

    return JSON.stringify(exportData, null, 2);
  }

  // Performance Analytics
  async getPerformanceInsights(timeRange: TimeRange): Promise<{
    trends: Array<{ metric: string; trend: 'up' | 'down' | 'stable'; change: number }>;
    anomalies: Array<{ metric: string; timestamp: Date; value: number; expected: number }>;
    recommendations: Array<{ type: string; message: string; priority: 'low' | 'medium' | 'high' }>;
  }> {
    const insights = {
      trends: [] as Array<{ metric: string; trend: 'up' | 'down' | 'stable'; change: number }>,
      anomalies: [] as Array<{ metric: string; timestamp: Date; value: number; expected: number }>,
      recommendations: [] as Array<{ type: string; message: string; priority: 'low' | 'medium' | 'high' }>
    };

    // Analyze trends for each metric
    for (const [metricId, metric] of this.metrics) {
      const data = this.getMetricData(metricId, timeRange);
      if (data.length < 2) continue;

      // Calculate trend
      const firstHalf = data.slice(0, Math.floor(data.length / 2));
      const secondHalf = data.slice(Math.floor(data.length / 2));
      
      const firstAvg = firstHalf.reduce((sum, p) => sum + p.value, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, p) => sum + p.value, 0) / secondHalf.length;
      
      const change = ((secondAvg - firstAvg) / firstAvg) * 100;
      
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (Math.abs(change) > 5) {
        trend = change > 0 ? 'up' : 'down';
      }

      insights.trends.push({
        metric: metric.name,
        trend,
        change: Math.round(change * 100) / 100
      });

      // Detect anomalies (simple approach)
      const average = data.reduce((sum, p) => sum + p.value, 0) / data.length;
      const variance = data.reduce((sum, p) => sum + Math.pow(p.value - average, 2), 0) / data.length;
      const stdDev = Math.sqrt(variance);
      
      for (const point of data) {
        if (Math.abs(point.value - average) > stdDev * 2) {
          insights.anomalies.push({
            metric: metric.name,
            timestamp: point.timestamp,
            value: point.value,
            expected: average
          });
        }
      }
    }

    // Generate recommendations
    const cpuTrend = insights.trends.find(t => t.metric === 'CPU Usage');
    const memoryTrend = insights.trends.find(t => t.metric === 'Memory Usage');

    if (cpuTrend && cpuTrend.trend === 'up' && cpuTrend.change > 20) {
      insights.recommendations.push({
        type: 'performance',
        message: 'CPU usage is trending upward. Consider investigating high-CPU processes.',
        priority: 'high'
      });
    }

    if (memoryTrend && memoryTrend.trend === 'up' && memoryTrend.change > 15) {
      insights.recommendations.push({
        type: 'memory',
        message: 'Memory usage is increasing. Check for memory leaks or optimize applications.',
        priority: 'medium'
      });
    }

    return insights;
  }

  // Private Methods
  private initializeDefaultMetrics(): void {
    for (const defaultMetric of this.DEFAULT_METRICS) {
      if (!this.metrics.has(defaultMetric.id)) {
        this.metrics.set(defaultMetric.id, {
          id: defaultMetric.id,
          name: defaultMetric.name,
          unit: defaultMetric.unit,
          points: [],
          color: defaultMetric.color,
          visible: true,
          aggregation: 'avg'
        });
      }
    }
  }

  private async createDefaultDashboard(): Promise<void> {
    const existingDefault = Array.from(this.dashboards.values()).find(d => d.isDefault);
    if (existingDefault) return;

    const defaultWidgets: DashboardWidget[] = [
      {
        id: 'cpu_widget',
        type: 'chart',
        title: 'CPU Usage',
        position: { x: 0, y: 0, width: 6, height: 4 },
        config: {
          chartType: 'line',
          metrics: ['cpu_usage'],
          timeRange: { start: 'now-1h', end: 'now', groupBy: '1m' }
        },
        refreshInterval: 30
      },
      {
        id: 'memory_widget',
        type: 'chart',
        title: 'Memory Usage',
        position: { x: 6, y: 0, width: 6, height: 4 },
        config: {
          chartType: 'area',
          metrics: ['memory_usage'],
          timeRange: { start: 'now-1h', end: 'now', groupBy: '1m' }
        },
        refreshInterval: 30
      },
      {
        id: 'network_widget',
        type: 'chart',
        title: 'Network Traffic',
        position: { x: 0, y: 4, width: 12, height: 4 },
        config: {
          chartType: 'line',
          metrics: ['network_in', 'network_out'],
          timeRange: { start: 'now-1h', end: 'now', groupBy: '1m' }
        },
        refreshInterval: 30
      }
    ];

    await this.createDashboard(
      'System Overview',
      'Default system monitoring dashboard',
      defaultWidgets
    );

    const dashboards = Array.from(this.dashboards.values());
    if (dashboards.length === 1) {
      dashboards[0].isDefault = true;
      await this.saveDashboards();
    }
  }

  private addMetricPoint(metricId: string, point: MetricPoint): void {
    const metric = this.metrics.get(metricId);
    if (!metric) return;

    metric.points.push(point);
    
    // Keep only last 1000 points to manage memory
    if (metric.points.length > 1000) {
      metric.points = metric.points.slice(-1000);
    }

    // Update historical data periodically
    this.updateHistoricalData(metricId, point);
  }

  private updateHistoricalData(metricId: string, point: MetricPoint): void {
    // This is a simplified implementation
    // In production, you'd want more sophisticated aggregation
    const existing = this.historicalData.get(metricId) || [];
    
    // For now, just store raw points
    // In production, aggregate by hour/day/week/month
    this.historicalData.set(metricId, existing);
  }

  private async collectCustomMetrics(): Promise<void> {
    for (const customMetric of this.customMetrics.values()) {
      if (!customMetric.enabled) continue;

      try {
        // Execute custom metric query
        // This is a placeholder - in production, implement query execution
        const value = Math.random() * 100; // Placeholder value
        
        this.addMetricPoint(customMetric.id, {
          timestamp: new Date(),
          value,
          metadata: { custom: true }
        });
      } catch (error) {
        console.error(`Failed to collect custom metric ${customMetric.name}:`, error);
      }
    }
  }

  private aggregatePoints(
    points: MetricPoint[],
    groupBy: string,
    aggregation: 'avg' | 'sum' | 'min' | 'max'
  ): MetricPoint[] {
    const groups = new Map<string, MetricPoint[]>();
    
    // Group points by time bucket
    for (const point of points) {
      const bucket = this.getTimeBucket(point.timestamp, groupBy);
      const key = bucket.toISOString();
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(point);
    }

    // Aggregate each group
    const aggregated: MetricPoint[] = [];
    
    for (const [key, groupPoints] of groups) {
      let value: number;
      
      switch (aggregation) {
        case 'avg':
          value = groupPoints.reduce((sum, p) => sum + p.value, 0) / groupPoints.length;
          break;
        case 'sum':
          value = groupPoints.reduce((sum, p) => sum + p.value, 0);
          break;
        case 'min':
          value = Math.min(...groupPoints.map(p => p.value));
          break;
        case 'max':
          value = Math.max(...groupPoints.map(p => p.value));
          break;
      }

      aggregated.push({
        timestamp: new Date(key),
        value,
        metadata: { aggregated: true, count: groupPoints.length }
      });
    }

    return aggregated.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private getTimeBucket(timestamp: Date, groupBy: string): Date {
    const bucket = new Date(timestamp);
    
    switch (groupBy) {
      case '1m':
        bucket.setSeconds(0, 0);
        break;
      case '5m':
        bucket.setMinutes(Math.floor(bucket.getMinutes() / 5) * 5, 0, 0);
        break;
      case '1h':
        bucket.setMinutes(0, 0, 0);
        break;
      case '1d':
        bucket.setHours(0, 0, 0, 0);
        break;
    }
    
    return bucket;
  }

  private startMetricCollection(): void {
    this.collectInterval = setInterval(async () => {
      await this.collectSystemMetrics();
    }, 30000); // Collect every 30 seconds
  }

  private startAlertMonitoring(): void {
    this.alertInterval = setInterval(async () => {
      await this.checkAlerts();
    }, 60000); // Check alerts every minute
  }

  private async checkAlerts(): Promise<void> {
    const now = new Date();
    
    for (const alert of this.alertRules.values()) {
      if (!alert.enabled) continue;
      
      // Check cooldown
      if (alert.lastTriggered) {
        const cooldownMs = alert.cooldown * 60 * 1000;
        if (now.getTime() - alert.lastTriggered.getTime() < cooldownMs) {
          continue;
        }
      }

      const metric = this.metrics.get(alert.metricId);
      if (!metric || metric.points.length === 0) continue;

      const latestPoint = metric.points[metric.points.length - 1];
      let triggered = false;

      switch (alert.condition) {
        case 'gt':
          triggered = latestPoint.value > alert.threshold;
          break;
        case 'lt':
          triggered = latestPoint.value < alert.threshold;
          break;
        case 'gte':
          triggered = latestPoint.value >= alert.threshold;
          break;
        case 'lte':
          triggered = latestPoint.value <= alert.threshold;
          break;
        case 'eq':
          triggered = latestPoint.value === alert.threshold;
          break;
        case 'neq':
          triggered = latestPoint.value !== alert.threshold;
          break;
      }

      if (triggered) {
        alert.lastTriggered = now;
        console.log(`🚨 Alert triggered: ${alert.name} (${latestPoint.value} ${alert.condition} ${alert.threshold})`);
        
        // Here you would send notifications via the configured channels
        await this.saveAlertRules();
      }
    }
  }

  private generateRandomColor(): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
      '#FECA57', '#FF9FF3', '#54A0FF', '#5F27CD'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // Storage Methods
  private async loadData(): Promise<void> {
    try {
      const [metricsData, dashboardsData, customMetricsData, alertRulesData, historicalData] = await Promise.all([
        AsyncStorage.getItem(this.STORAGE_KEYS.METRICS),
        AsyncStorage.getItem(this.STORAGE_KEYS.DASHBOARDS),
        AsyncStorage.getItem(this.STORAGE_KEYS.CUSTOM_METRICS),
        AsyncStorage.getItem(this.STORAGE_KEYS.ALERT_RULES),
        AsyncStorage.getItem(this.STORAGE_KEYS.HISTORICAL_DATA)
      ]);

      if (metricsData) {
        const metrics = JSON.parse(metricsData);
        for (const [id, metric] of Object.entries(metrics as Record<string, any>)) {
          metric.points = metric.points.map((p: any) => ({
            ...p,
            timestamp: new Date(p.timestamp)
          }));
          this.metrics.set(id, metric);
        }
      }

      if (dashboardsData) {
        const dashboards = JSON.parse(dashboardsData);
        dashboards.forEach((dashboard: any) => {
          dashboard.createdAt = new Date(dashboard.createdAt);
          dashboard.updatedAt = new Date(dashboard.updatedAt);
          this.dashboards.set(dashboard.id, dashboard);
        });
      }

      if (customMetricsData) {
        const customMetrics = JSON.parse(customMetricsData);
        customMetrics.forEach((metric: any) => {
          this.customMetrics.set(metric.id, metric);
        });
      }

      if (alertRulesData) {
        const alertRules = JSON.parse(alertRulesData);
        alertRules.forEach((rule: any) => {
          if (rule.lastTriggered) {
            rule.lastTriggered = new Date(rule.lastTriggered);
          }
          this.alertRules.set(rule.id, rule);
        });
      }

      if (historicalData) {
        const historical = JSON.parse(historicalData);
        for (const [metricId, data] of Object.entries(historical as Record<string, any>)) {
          this.historicalData.set(metricId, data);
        }
      }
    } catch (error) {
      console.error('Failed to load monitoring data:', error);
    }
  }

  private async saveMetrics(): Promise<void> {
    try {
      const metricsObject = Object.fromEntries(this.metrics);
      await AsyncStorage.setItem(this.STORAGE_KEYS.METRICS, JSON.stringify(metricsObject));
    } catch (error) {
      console.error('Failed to save metrics:', error);
    }
  }

  private async saveDashboards(): Promise<void> {
    try {
      const dashboardsArray = Array.from(this.dashboards.values());
      await AsyncStorage.setItem(this.STORAGE_KEYS.DASHBOARDS, JSON.stringify(dashboardsArray));
    } catch (error) {
      console.error('Failed to save dashboards:', error);
    }
  }

  private async saveCustomMetrics(): Promise<void> {
    try {
      const customMetricsArray = Array.from(this.customMetrics.values());
      await AsyncStorage.setItem(this.STORAGE_KEYS.CUSTOM_METRICS, JSON.stringify(customMetricsArray));
    } catch (error) {
      console.error('Failed to save custom metrics:', error);
    }
  }

  private async saveAlertRules(): Promise<void> {
    try {
      const alertRulesArray = Array.from(this.alertRules.values());
      await AsyncStorage.setItem(this.STORAGE_KEYS.ALERT_RULES, JSON.stringify(alertRulesArray));
    } catch (error) {
      console.error('Failed to save alert rules:', error);
    }
  }

  dispose(): void {
    if (this.collectInterval) {
      clearInterval(this.collectInterval);
    }
    if (this.alertInterval) {
      clearInterval(this.alertInterval);
    }
    this.metrics.clear();
    this.dashboards.clear();
    this.customMetrics.clear();
    this.alertRules.clear();
    this.historicalData.clear();
  }
}

export const advancedMonitoringService = new AdvancedMonitoringService();
