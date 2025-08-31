import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';

interface CrashReport {
  id: string;
  timestamp: Date;
  error: {
    name: string;
    message: string;
    stack: string;
  };
  device: DeviceInfo;
  user?: {
    id: string;
    email: string;
  };
  context: {
    screen: string;
    action: string;
    metadata: Record<string, any>;
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  reported: boolean;
}

interface AnalyticsEvent {
  id: string;
  name: string;
  timestamp: Date;
  properties: Record<string, any>;
  user?: {
    id: string;
    sessionId: string;
  };
  device: {
    platform: string;
    version: string;
    model: string;
  };
  screen: string;
  category: 'user_action' | 'system' | 'performance' | 'error';
}

interface PerformanceMetric {
  id: string;
  name: string;
  timestamp: Date;
  value: number;
  unit: string;
  context: {
    screen?: string;
    action?: string;
    metadata?: Record<string, any>;
  };
}

interface AppStoreMetadata {
  title: string;
  subtitle: string;
  description: string;
  keywords: string[];
  promotionalText: string;
  whatsNew: string;
  category: string;
  screenshots: AppStoreScreenshot[];
  privacyURL: string;
  supportURL: string;
  marketingURL: string;
}

interface AppStoreScreenshot {
  deviceType: 'iPhone' | 'iPad' | 'AppleTV' | 'AndroidPhone' | 'AndroidTablet';
  orientation: 'portrait' | 'landscape';
  filePath: string;
  title: string;
  order: number;
}

interface DeploymentConfig {
  environment: 'development' | 'staging' | 'production';
  buildNumber: string;
  version: string;
  releaseNotes: string;
  features: {
    crashReporting: boolean;
    analytics: boolean;
    performance: boolean;
    pushNotifications: boolean;
    inAppPurchases: boolean;
  };
  integrations: {
    firebase: boolean;
    sentry: boolean;
    mixpanel: boolean;
    amplitude: boolean;
  };
}

interface BuildArtifact {
  id: string;
  platform: 'ios' | 'android';
  type: 'debug' | 'release' | 'adhoc' | 'appstore';
  buildNumber: string;
  version: string;
  filePath: string;
  fileSize: number;
  createdAt: Date;
  uploaded: boolean;
  downloadURL?: string;
}

class ProductionDeploymentService {
  private crashReports: Map<string, CrashReport> = new Map();
  private analyticsEvents: Map<string, AnalyticsEvent> = new Map();
  private performanceMetrics: Map<string, PerformanceMetric> = new Map();
  private deploymentConfig: DeploymentConfig | null = null;
  private appStoreMetadata: AppStoreMetadata | null = null;
  private buildArtifacts: Map<string, BuildArtifact> = new Map();
  private sessionId: string = '';
  private reportingEnabled: boolean = true;

  private readonly STORAGE_KEYS = {
    CRASH_REPORTS: 'deployment_crash_reports',
    ANALYTICS_EVENTS: 'deployment_analytics_events',
    PERFORMANCE_METRICS: 'deployment_performance_metrics',
    DEPLOYMENT_CONFIG: 'deployment_config',
    APP_STORE_METADATA: 'deployment_app_store_metadata',
    BUILD_ARTIFACTS: 'deployment_build_artifacts'
  };

  async initialize(environment: 'development' | 'staging' | 'production'): Promise<void> {
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await this.loadData();
    
    if (environment === 'production') {
      this.setupProductionErrorHandling();
      this.startAnalyticsCollection();
      this.startPerformanceMonitoring();
    }

    console.log(`🚀 Production Deployment Service initialized (${environment})`);
  }

  // Crash Reporting
  async reportCrash(
    error: Error,
    context: {
      screen: string;
      action: string;
      metadata?: Record<string, any>;
    },
    severity: 'low' | 'medium' | 'high' | 'critical' = 'high'
  ): Promise<string> {
    const crashId = `crash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const deviceInfo = {
      platform: await DeviceInfo.getPlatform(),
      version: await DeviceInfo.getSystemVersion(),
      model: await DeviceInfo.getModel(),
      brand: await DeviceInfo.getBrand(),
      appVersion: await DeviceInfo.getVersion(),
      buildNumber: await DeviceInfo.getBuildNumber()
    };

    const crashReport: CrashReport = {
      id: crashId,
      timestamp: new Date(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack || ''
      },
      device: deviceInfo,
      context,
      severity,
      reported: false
    };

    this.crashReports.set(crashId, crashReport);
    await this.saveCrashReports();

    // Auto-report critical crashes
    if (severity === 'critical' && this.reportingEnabled) {
      await this.uploadCrashReport(crashId);
    }

    console.error(`💥 Crash reported: ${error.message} (${severity})`);
    return crashId;
  }

  async uploadCrashReport(crashId: string): Promise<boolean> {
    const crashReport = this.crashReports.get(crashId);
    if (!crashReport) return false;

    try {
      // Simulate crash report upload
      console.log(`📤 Uploading crash report: ${crashId}`);
      
      // In production, send to crash reporting service (Sentry, Crashlytics, etc.)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      crashReport.reported = true;
      this.crashReports.set(crashId, crashReport);
      await this.saveCrashReports();
      
      console.log(`✅ Crash report uploaded: ${crashId}`);
      return true;
    } catch (error) {
      console.error('Failed to upload crash report:', error);
      return false;
    }
  }

  getCrashReports(limit: number = 50): CrashReport[] {
    return Array.from(this.crashReports.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  // Analytics
  async trackEvent(
    name: string,
    properties: Record<string, any> = {},
    category: 'user_action' | 'system' | 'performance' | 'error' = 'user_action'
  ): Promise<void> {
    if (!this.reportingEnabled) return;

    const eventId = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const deviceInfo = {
      platform: await DeviceInfo.getPlatform(),
      version: await DeviceInfo.getSystemVersion(),
      model: await DeviceInfo.getModel()
    };

    const analyticsEvent: AnalyticsEvent = {
      id: eventId,
      name,
      timestamp: new Date(),
      properties,
      user: {
        id: 'current_user', // Would get from auth service
        sessionId: this.sessionId
      },
      device: deviceInfo,
      screen: properties.screen || 'unknown',
      category
    };

    this.analyticsEvents.set(eventId, analyticsEvent);
    await this.saveAnalyticsEvents();

    // Batch upload events periodically
    this.scheduleEventUpload();
  }

  async trackScreenView(screenName: string, properties: Record<string, any> = {}): Promise<void> {
    await this.trackEvent('screen_view', {
      screen: screenName,
      ...properties
    }, 'user_action');
  }

  async trackUserAction(action: string, properties: Record<string, any> = {}): Promise<void> {
    await this.trackEvent(action, properties, 'user_action');
  }

  // Performance Monitoring
  async trackPerformance(
    name: string,
    value: number,
    unit: string,
    context: {
      screen?: string;
      action?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<void> {
    if (!this.reportingEnabled) return;

    const metricId = `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const performanceMetric: PerformanceMetric = {
      id: metricId,
      name,
      timestamp: new Date(),
      value,
      unit,
      context
    };

    this.performanceMetrics.set(metricId, performanceMetric);
    await this.savePerformanceMetrics();
  }

  async measureExecutionTime<T>(
    name: string,
    operation: () => Promise<T>,
    context: Record<string, any> = {}
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      
      await this.trackPerformance(name, duration, 'ms', {
        ...context,
        status: 'success'
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      await this.trackPerformance(name, duration, 'ms', {
        ...context,
        status: 'error',
        error: error.message
      });
      
      throw error;
    }
  }

  // App Store Optimization
  async setAppStoreMetadata(metadata: AppStoreMetadata): Promise<void> {
    this.appStoreMetadata = metadata;
    await this.saveAppStoreMetadata();
    console.log('📱 App Store metadata updated');
  }

  async generateAppStoreDescription(): Promise<string> {
    if (!this.appStoreMetadata) {
      throw new Error('App Store metadata not configured');
    }

    const template = `
${this.appStoreMetadata.title}

${this.appStoreMetadata.description}

KEY FEATURES:
🔐 Secure SSH Terminal Access
📁 Advanced File Management
📊 Real-time System Monitoring
🤖 AI-Powered Assistance
🔒 Enterprise Security
☁️ Multi-Device Sync

${this.appStoreMetadata.promotionalText}

Keywords: ${this.appStoreMetadata.keywords.join(', ')}
    `.trim();

    return template;
  }

  // Build Management
  async createBuildArtifact(
    platform: 'ios' | 'android',
    type: 'debug' | 'release' | 'adhoc' | 'appstore',
    filePath: string,
    version: string,
    buildNumber: string
  ): Promise<string> {
    const artifactId = `build_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Get file size (simulated)
    const fileSize = Math.floor(Math.random() * 50 * 1024 * 1024) + 10 * 1024 * 1024; // 10-60 MB
    
    const buildArtifact: BuildArtifact = {
      id: artifactId,
      platform,
      type,
      buildNumber,
      version,
      filePath,
      fileSize,
      createdAt: new Date(),
      uploaded: false
    };

    this.buildArtifacts.set(artifactId, buildArtifact);
    await this.saveBuildArtifacts();

    console.log(`🔨 Build artifact created: ${platform} ${type} v${version}`);
    return artifactId;
  }

  async uploadBuildArtifact(artifactId: string): Promise<boolean> {
    const artifact = this.buildArtifacts.get(artifactId);
    if (!artifact) return false;

    try {
      console.log(`📤 Uploading build artifact: ${artifact.platform} v${artifact.version}`);
      
      // Simulate upload process
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      artifact.uploaded = true;
      artifact.downloadURL = `https://builds.nexusterminal.com/${artifactId}`;
      
      this.buildArtifacts.set(artifactId, artifact);
      await this.saveBuildArtifacts();
      
      console.log(`✅ Build artifact uploaded: ${artifact.downloadURL}`);
      return true;
    } catch (error) {
      console.error('Failed to upload build artifact:', error);
      return false;
    }
  }

  getBuildArtifacts(): BuildArtifact[] {
    return Array.from(this.buildArtifacts.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Deployment Automation
  async configureDeployment(config: DeploymentConfig): Promise<void> {
    this.deploymentConfig = config;
    await this.saveDeploymentConfig();
    console.log(`⚙️ Deployment configured for ${config.environment}`);
  }

  async automatedDeploy(
    platform: 'ios' | 'android' | 'both',
    environment: 'staging' | 'production'
  ): Promise<{
    success: boolean;
    buildId?: string;
    deploymentURL?: string;
    error?: string;
  }> {
    try {
      if (!this.deploymentConfig) {
        throw new Error('Deployment configuration not set');
      }

      console.log(`🚀 Starting automated deployment: ${platform} to ${environment}`);
      
      // Simulate build process
      console.log('📦 Building application...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Create build artifact
      const buildId = await this.createBuildArtifact(
        platform === 'both' ? 'ios' : platform,
        environment === 'production' ? 'appstore' : 'adhoc',
        `/builds/${platform}_${environment}_${Date.now()}.ipa`,
        this.deploymentConfig.version,
        this.deploymentConfig.buildNumber
      );

      // Upload to app store/distribution
      console.log('📤 Uploading to distribution platform...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const success = await this.uploadBuildArtifact(buildId);
      
      if (success) {
        const deploymentURL = `https://testflight.apple.com/v1/app/${buildId}`;
        
        await this.trackEvent('deployment_success', {
          platform,
          environment,
          buildId,
          version: this.deploymentConfig.version
        }, 'system');

        return {
          success: true,
          buildId,
          deploymentURL
        };
      } else {
        throw new Error('Failed to upload build artifact');
      }
    } catch (error) {
      await this.trackEvent('deployment_failed', {
        platform,
        environment,
        error: error.message
      }, 'error');

      return {
        success: false,
        error: error.message
      };
    }
  }

  // Analytics Insights
  async getAnalyticsInsights(timeRange: { start: Date; end: Date }): Promise<{
    totalEvents: number;
    uniqueUsers: number;
    topScreens: Array<{ screen: string; views: number }>;
    topActions: Array<{ action: string; count: number }>;
    crashRate: number;
    performanceMetrics: {
      avgAppLaunchTime: number;
      avgScreenLoadTime: number;
      avgAPIResponseTime: number;
    };
  }> {
    const events = Array.from(this.analyticsEvents.values())
      .filter(e => e.timestamp >= timeRange.start && e.timestamp <= timeRange.end);

    const crashes = Array.from(this.crashReports.values())
      .filter(c => c.timestamp >= timeRange.start && c.timestamp <= timeRange.end);

    const performance = Array.from(this.performanceMetrics.values())
      .filter(m => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end);

    // Calculate insights
    const uniqueUsers = new Set(events.map(e => e.user?.id).filter(Boolean)).size;
    
    const screenViews = new Map<string, number>();
    const actionCounts = new Map<string, number>();
    
    events.forEach(event => {
      if (event.name === 'screen_view') {
        const screen = event.screen;
        screenViews.set(screen, (screenViews.get(screen) || 0) + 1);
      } else {
        actionCounts.set(event.name, (actionCounts.get(event.name) || 0) + 1);
      }
    });

    const topScreens = Array.from(screenViews.entries())
      .map(([screen, views]) => ({ screen, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    const topActions = Array.from(actionCounts.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const crashRate = events.length > 0 ? (crashes.length / events.length) * 100 : 0;

    const launchTimes = performance.filter(p => p.name === 'app_launch');
    const screenLoadTimes = performance.filter(p => p.name === 'screen_load');
    const apiTimes = performance.filter(p => p.name.includes('api_'));

    const avgAppLaunchTime = launchTimes.length > 0 
      ? launchTimes.reduce((sum, p) => sum + p.value, 0) / launchTimes.length 
      : 0;

    const avgScreenLoadTime = screenLoadTimes.length > 0
      ? screenLoadTimes.reduce((sum, p) => sum + p.value, 0) / screenLoadTimes.length
      : 0;

    const avgAPIResponseTime = apiTimes.length > 0
      ? apiTimes.reduce((sum, p) => sum + p.value, 0) / apiTimes.length
      : 0;

    return {
      totalEvents: events.length,
      uniqueUsers,
      topScreens,
      topActions,
      crashRate: Math.round(crashRate * 100) / 100,
      performanceMetrics: {
        avgAppLaunchTime: Math.round(avgAppLaunchTime),
        avgScreenLoadTime: Math.round(avgScreenLoadTime),
        avgAPIResponseTime: Math.round(avgAPIResponseTime)
      }
    };
  }

  // Feature Flags & A/B Testing
  async getFeatureFlag(flagName: string): Promise<boolean> {
    // Simulate feature flag lookup
    const flags: Record<string, boolean> = {
      'new_ui_design': Math.random() > 0.5,
      'advanced_search': true,
      'beta_features': false,
      'premium_features': true
    };

    const enabled = flags[flagName] || false;
    
    await this.trackEvent('feature_flag_checked', {
      flag: flagName,
      enabled
    }, 'system');

    return enabled;
  }

  async trackABTest(testName: string, variant: string, outcome?: string): Promise<void> {
    await this.trackEvent('ab_test', {
      test: testName,
      variant,
      outcome
    }, 'system');
  }

  // Release Management
  async createRelease(
    version: string,
    releaseNotes: string,
    features: string[]
  ): Promise<{
    success: boolean;
    releaseId?: string;
    error?: string;
  }> {
    try {
      const releaseId = `release_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log(`📋 Creating release: v${version}`);
      
      // Update deployment config
      if (this.deploymentConfig) {
        this.deploymentConfig.version = version;
        this.deploymentConfig.releaseNotes = releaseNotes;
        await this.saveDeploymentConfig();
      }

      await this.trackEvent('release_created', {
        version,
        releaseId,
        featuresCount: features.length
      }, 'system');

      return {
        success: true,
        releaseId
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Privacy & Compliance
  async generatePrivacyReport(): Promise<{
    dataCollected: string[];
    retentionPeriods: Record<string, string>;
    sharingPolicies: string[];
    userRights: string[];
  }> {
    return {
      dataCollected: [
        'Device information (model, OS version)',
        'App usage analytics',
        'Crash reports and performance metrics',
        'User preferences and settings',
        'SSH connection metadata (no credentials)'
      ],
      retentionPeriods: {
        'Analytics Events': '90 days',
        'Crash Reports': '1 year',
        'Performance Metrics': '30 days',
        'User Settings': 'Until account deletion'
      },
      sharingPolicies: [
        'No personal data is shared with third parties',
        'Anonymous analytics shared with service providers',
        'Crash reports processed by error tracking services'
      ],
      userRights: [
        'Right to access personal data',
        'Right to delete personal data',
        'Right to opt-out of analytics',
        'Right to data portability'
      ]
    };
  }

  // Configuration
  async updateReportingSettings(settings: {
    crashReporting: boolean;
    analytics: boolean;
    performance: boolean;
  }): Promise<void> {
    this.reportingEnabled = settings.crashReporting || settings.analytics || settings.performance;
    
    if (this.deploymentConfig) {
      this.deploymentConfig.features.crashReporting = settings.crashReporting;
      this.deploymentConfig.features.analytics = settings.analytics;
      this.deploymentConfig.features.performance = settings.performance;
      
      await this.saveDeploymentConfig();
    }

    await this.trackEvent('reporting_settings_updated', settings, 'system');
  }

  getDeploymentConfig(): DeploymentConfig | null {
    return this.deploymentConfig;
  }

  // Private Methods
  private setupProductionErrorHandling(): void {
    // Global error handler for unhandled promise rejections
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', (event) => {
        this.reportCrash(new Error(event.reason), {
          screen: 'unknown',
          action: 'unhandled_promise_rejection'
        }, 'critical');
      });
    }

    // React Native specific error handling would go here
    console.log('🛡️ Production error handling configured');
  }

  private startAnalyticsCollection(): void {
    console.log('📈 Analytics collection started');
  }

  private startPerformanceMonitoring(): void {
    // Monitor app performance
    const startTime = Date.now();
    
    setInterval(async () => {
      await this.trackPerformance('memory_usage', Math.random() * 100, 'MB');
    }, 30000); // Every 30 seconds

    console.log('⚡ Performance monitoring started');
  }

  private scheduleEventUpload(): void {
    // Batch upload analytics events every 5 minutes
    setTimeout(async () => {
      await this.uploadPendingEvents();
    }, 5 * 60 * 1000);
  }

  private async uploadPendingEvents(): Promise<void> {
    try {
      const events = Array.from(this.analyticsEvents.values());
      if (events.length === 0) return;

      console.log(`📤 Uploading ${events.length} analytics events`);
      
      // Simulate upload
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Clear uploaded events
      this.analyticsEvents.clear();
      await this.saveAnalyticsEvents();
      
      console.log('✅ Analytics events uploaded');
    } catch (error) {
      console.error('Failed to upload analytics events:', error);
    }
  }

  // Storage Methods
  private async loadData(): Promise<void> {
    try {
      const [crashData, analyticsData, performanceData, configData, metadataData, artifactsData] = await Promise.all([
        AsyncStorage.getItem(this.STORAGE_KEYS.CRASH_REPORTS),
        AsyncStorage.getItem(this.STORAGE_KEYS.ANALYTICS_EVENTS),
        AsyncStorage.getItem(this.STORAGE_KEYS.PERFORMANCE_METRICS),
        AsyncStorage.getItem(this.STORAGE_KEYS.DEPLOYMENT_CONFIG),
        AsyncStorage.getItem(this.STORAGE_KEYS.APP_STORE_METADATA),
        AsyncStorage.getItem(this.STORAGE_KEYS.BUILD_ARTIFACTS)
      ]);

      if (crashData) {
        const crashes = JSON.parse(crashData);
        crashes.forEach((crash: any) => {
          crash.timestamp = new Date(crash.timestamp);
          this.crashReports.set(crash.id, crash);
        });
      }

      if (analyticsData) {
        const events = JSON.parse(analyticsData);
        events.forEach((event: any) => {
          event.timestamp = new Date(event.timestamp);
          this.analyticsEvents.set(event.id, event);
        });
      }

      if (performanceData) {
        const metrics = JSON.parse(performanceData);
        metrics.forEach((metric: any) => {
          metric.timestamp = new Date(metric.timestamp);
          this.performanceMetrics.set(metric.id, metric);
        });
      }

      if (configData) {
        this.deploymentConfig = JSON.parse(configData);
      }

      if (metadataData) {
        this.appStoreMetadata = JSON.parse(metadataData);
      }

      if (artifactsData) {
        const artifacts = JSON.parse(artifactsData);
        artifacts.forEach((artifact: any) => {
          artifact.createdAt = new Date(artifact.createdAt);
          this.buildArtifacts.set(artifact.id, artifact);
        });
      }
    } catch (error) {
      console.error('Failed to load deployment data:', error);
    }
  }

  private async saveCrashReports(): Promise<void> {
    try {
      const reports = Array.from(this.crashReports.values());
      await AsyncStorage.setItem(this.STORAGE_KEYS.CRASH_REPORTS, JSON.stringify(reports));
    } catch (error) {
      console.error('Failed to save crash reports:', error);
    }
  }

  private async saveAnalyticsEvents(): Promise<void> {
    try {
      const events = Array.from(this.analyticsEvents.values());
      await AsyncStorage.setItem(this.STORAGE_KEYS.ANALYTICS_EVENTS, JSON.stringify(events));
    } catch (error) {
      console.error('Failed to save analytics events:', error);
    }
  }

  private async savePerformanceMetrics(): Promise<void> {
    try {
      const metrics = Array.from(this.performanceMetrics.values());
      await AsyncStorage.setItem(this.STORAGE_KEYS.PERFORMANCE_METRICS, JSON.stringify(metrics));
    } catch (error) {
      console.error('Failed to save performance metrics:', error);
    }
  }

  private async saveDeploymentConfig(): Promise<void> {
    try {
      if (this.deploymentConfig) {
        await AsyncStorage.setItem(this.STORAGE_KEYS.DEPLOYMENT_CONFIG, JSON.stringify(this.deploymentConfig));
      }
    } catch (error) {
      console.error('Failed to save deployment config:', error);
    }
  }

  private async saveAppStoreMetadata(): Promise<void> {
    try {
      if (this.appStoreMetadata) {
        await AsyncStorage.setItem(this.STORAGE_KEYS.APP_STORE_METADATA, JSON.stringify(this.appStoreMetadata));
      }
    } catch (error) {
      console.error('Failed to save app store metadata:', error);
    }
  }

  private async saveBuildArtifacts(): Promise<void> {
    try {
      const artifacts = Array.from(this.buildArtifacts.values());
      await AsyncStorage.setItem(this.STORAGE_KEYS.BUILD_ARTIFACTS, JSON.stringify(artifacts));
    } catch (error) {
      console.error('Failed to save build artifacts:', error);
    }
  }

  dispose(): void {
    this.crashReports.clear();
    this.analyticsEvents.clear();
    this.performanceMetrics.clear();
    this.buildArtifacts.clear();
  }
}

export const productionDeploymentService = new ProductionDeploymentService();
