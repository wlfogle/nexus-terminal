import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AppSettings {
  theme: 'light' | 'dark';
  fontSize: number;
  autoConnect: boolean;
  notifications: boolean;
  securityMonitoring: boolean;
  performanceOptimization: boolean;
  terminalSettings: {
    fontFamily: string;
    cursorStyle: 'block' | 'underline' | 'bar';
    scrollback: number;
    bellSound: boolean;
  };
  fileManagerSettings: {
    showHiddenFiles: boolean;
    defaultView: 'list' | 'grid';
    sortBy: 'name' | 'size' | 'modified';
    sortOrder: 'asc' | 'desc';
  };
  systemSettings: {
    refreshInterval: number;
    maxProcesses: number;
    enableMetricsCache: boolean;
  };
  aiSettings: {
    enableNeuralEngine: boolean;
    enableNaturalLanguage: boolean;
    learningMode: boolean;
    predictionConfidenceThreshold: number;
  };
}

const defaultSettings: AppSettings = {
  theme: 'dark',
  fontSize: 14,
  autoConnect: false,
  notifications: true,
  securityMonitoring: true,
  performanceOptimization: true,
  terminalSettings: {
    fontFamily: 'monospace',
    cursorStyle: 'block',
    scrollback: 10000,
    bellSound: false
  },
  fileManagerSettings: {
    showHiddenFiles: false,
    defaultView: 'list',
    sortBy: 'name',
    sortOrder: 'asc'
  },
  systemSettings: {
    refreshInterval: 5000,
    maxProcesses: 100,
    enableMetricsCache: true
  },
  aiSettings: {
    enableNeuralEngine: true,
    enableNaturalLanguage: true,
    learningMode: true,
    predictionConfidenceThreshold: 0.7
  }
};

class SettingsService {
  private settings: AppSettings = { ...defaultSettings };
  private settingsCallbacks: ((settings: AppSettings) => void)[] = [];
  private saveTimer: NodeJS.Timeout | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      await this.loadSettings();
      this.initialized = true;
    } catch (error) {
      console.error('Settings initialization failed:', error);
      // Use default settings if loading fails
      this.settings = { ...defaultSettings };
    }
  }

  async loadSettings(): Promise<AppSettings> {
    try {
      const settingsData = await AsyncStorage.getItem('app_settings');
      
      if (settingsData) {
        const parsed = JSON.parse(settingsData);
        // Merge with defaults to handle new settings added in updates
        this.settings = this.mergeWithDefaults(parsed);
      } else {
        this.settings = { ...defaultSettings };
      }

      this.notifySettingsChange();
      return this.settings;
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.settings = { ...defaultSettings };
      return this.settings;
    }
  }

  async saveSettings(newSettings?: Partial<AppSettings>): Promise<void> {
    try {
      if (newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.notifySettingsChange();
      }

      // Debounce saves to avoid excessive writes
      if (this.saveTimer) {
        clearTimeout(this.saveTimer);
      }

      this.saveTimer = setTimeout(async () => {
        try {
          await AsyncStorage.setItem('app_settings', JSON.stringify(this.settings));
        } catch (error) {
          console.error('Failed to save settings:', error);
        }
      }, 500);
    } catch (error) {
      console.error('Settings save failed:', error);
      throw error;
    }
  }

  getSettings(): AppSettings {
    return { ...this.settings };
  }

  async updateSetting<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ): Promise<void> {
    this.settings[key] = value;
    await this.saveSettings();
  }

  async updateNestedSetting<
    K extends keyof AppSettings,
    SK extends keyof AppSettings[K]
  >(
    key: K,
    subKey: SK,
    value: AppSettings[K][SK]
  ): Promise<void> {
    if (typeof this.settings[key] === 'object' && this.settings[key] !== null) {
      (this.settings[key] as any)[subKey] = value;
      await this.saveSettings();
    }
  }

  async resetSettings(): Promise<void> {
    this.settings = { ...defaultSettings };
    await this.saveSettings();
  }

  async resetSection<K extends keyof AppSettings>(section: K): Promise<void> {
    this.settings[section] = { ...defaultSettings[section] };
    await this.saveSettings();
  }

  async exportSettings(): Promise<string> {
    return JSON.stringify(this.settings, null, 2);
  }

  async importSettings(settingsJson: string): Promise<void> {
    try {
      const parsed = JSON.parse(settingsJson);
      const validated = this.validateSettings(parsed);
      
      this.settings = this.mergeWithDefaults(validated);
      await this.saveSettings();
    } catch (error) {
      console.error('Settings import failed:', error);
      throw new Error('Invalid settings format');
    }
  }

  onSettingsChange(callback: (settings: AppSettings) => void): void {
    this.settingsCallbacks.push(callback);
  }

  removeSettingsListener(callback: (settings: AppSettings) => void): void {
    const index = this.settingsCallbacks.indexOf(callback);
    if (index !== -1) {
      this.settingsCallbacks.splice(index, 1);
    }
  }

  private mergeWithDefaults(userSettings: any): AppSettings {
    const merged = { ...defaultSettings };

    // Deep merge each section
    Object.keys(defaultSettings).forEach(key => {
      if (userSettings[key] !== undefined) {
        if (typeof defaultSettings[key as keyof AppSettings] === 'object' && 
            defaultSettings[key as keyof AppSettings] !== null) {
          merged[key as keyof AppSettings] = {
            ...defaultSettings[key as keyof AppSettings],
            ...userSettings[key]
          } as any;
        } else {
          merged[key as keyof AppSettings] = userSettings[key];
        }
      }
    });

    return merged;
  }

  private validateSettings(settings: any): Partial<AppSettings> {
    const validated: any = {};

    // Validate theme
    if (settings.theme === 'light' || settings.theme === 'dark') {
      validated.theme = settings.theme;
    }

    // Validate fontSize
    if (typeof settings.fontSize === 'number' && settings.fontSize >= 10 && settings.fontSize <= 24) {
      validated.fontSize = settings.fontSize;
    }

    // Validate boolean settings
    ['autoConnect', 'notifications', 'securityMonitoring', 'performanceOptimization'].forEach(key => {
      if (typeof settings[key] === 'boolean') {
        validated[key] = settings[key];
      }
    });

    // Validate terminal settings
    if (settings.terminalSettings && typeof settings.terminalSettings === 'object') {
      validated.terminalSettings = {};
      
      if (typeof settings.terminalSettings.fontFamily === 'string') {
        validated.terminalSettings.fontFamily = settings.terminalSettings.fontFamily;
      }
      
      if (['block', 'underline', 'bar'].includes(settings.terminalSettings.cursorStyle)) {
        validated.terminalSettings.cursorStyle = settings.terminalSettings.cursorStyle;
      }
      
      if (typeof settings.terminalSettings.scrollback === 'number' && 
          settings.terminalSettings.scrollback >= 1000 && 
          settings.terminalSettings.scrollback <= 50000) {
        validated.terminalSettings.scrollback = settings.terminalSettings.scrollback;
      }
      
      if (typeof settings.terminalSettings.bellSound === 'boolean') {
        validated.terminalSettings.bellSound = settings.terminalSettings.bellSound;
      }
    }

    // Validate file manager settings
    if (settings.fileManagerSettings && typeof settings.fileManagerSettings === 'object') {
      validated.fileManagerSettings = {};
      
      if (typeof settings.fileManagerSettings.showHiddenFiles === 'boolean') {
        validated.fileManagerSettings.showHiddenFiles = settings.fileManagerSettings.showHiddenFiles;
      }
      
      if (['list', 'grid'].includes(settings.fileManagerSettings.defaultView)) {
        validated.fileManagerSettings.defaultView = settings.fileManagerSettings.defaultView;
      }
      
      if (['name', 'size', 'modified'].includes(settings.fileManagerSettings.sortBy)) {
        validated.fileManagerSettings.sortBy = settings.fileManagerSettings.sortBy;
      }
      
      if (['asc', 'desc'].includes(settings.fileManagerSettings.sortOrder)) {
        validated.fileManagerSettings.sortOrder = settings.fileManagerSettings.sortOrder;
      }
    }

    // Validate system settings
    if (settings.systemSettings && typeof settings.systemSettings === 'object') {
      validated.systemSettings = {};
      
      if (typeof settings.systemSettings.refreshInterval === 'number' &&
          settings.systemSettings.refreshInterval >= 1000 &&
          settings.systemSettings.refreshInterval <= 60000) {
        validated.systemSettings.refreshInterval = settings.systemSettings.refreshInterval;
      }
      
      if (typeof settings.systemSettings.maxProcesses === 'number' &&
          settings.systemSettings.maxProcesses >= 50 &&
          settings.systemSettings.maxProcesses <= 1000) {
        validated.systemSettings.maxProcesses = settings.systemSettings.maxProcesses;
      }
      
      if (typeof settings.systemSettings.enableMetricsCache === 'boolean') {
        validated.systemSettings.enableMetricsCache = settings.systemSettings.enableMetricsCache;
      }
    }

    // Validate AI settings
    if (settings.aiSettings && typeof settings.aiSettings === 'object') {
      validated.aiSettings = {};
      
      ['enableNeuralEngine', 'enableNaturalLanguage', 'learningMode'].forEach(key => {
        if (typeof settings.aiSettings[key] === 'boolean') {
          validated.aiSettings[key] = settings.aiSettings[key];
        }
      });
      
      if (typeof settings.aiSettings.predictionConfidenceThreshold === 'number' &&
          settings.aiSettings.predictionConfidenceThreshold >= 0 &&
          settings.aiSettings.predictionConfidenceThreshold <= 1) {
        validated.aiSettings.predictionConfidenceThreshold = settings.aiSettings.predictionConfidenceThreshold;
      }
    }

    return validated;
  }

  private notifySettingsChange(): void {
    this.settingsCallbacks.forEach(callback => {
      try {
        callback(this.settings);
      } catch (error) {
        console.error('Settings callback error:', error);
      }
    });
  }

  dispose(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.settingsCallbacks = [];
  }
}

export const settingsService = new SettingsService();
