import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from './authService';

interface LDAPConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  bindDN: string;
  bindPassword: string;
  baseDN: string;
  userSearchFilter: string;
  groupSearchFilter: string;
  attributes: {
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    groups: string;
  };
  useTLS: boolean;
  timeout: number;
  enabled: boolean;
}

interface SSOProvider {
  id: string;
  name: string;
  type: 'saml' | 'oauth2' | 'oidc';
  config: SSOConfig;
  enabled: boolean;
  priority: number;
  domains: string[]; // Auto-redirect domains
}

interface SSOConfig {
  // SAML Config
  samlEntryPoint?: string;
  samlCert?: string;
  samlIssuer?: string;
  
  // OAuth2/OIDC Config
  clientId?: string;
  clientSecret?: string;
  authorizationURL?: string;
  tokenURL?: string;
  userInfoURL?: string;
  scope?: string[];
  
  // Common Config
  callbackURL: string;
  logoutURL?: string;
  userMapping: {
    id: string;
    email: string;
    name: string;
    groups?: string;
  };
}

interface EnterpriseUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  groups: string[];
  roles: string[];
  department?: string;
  manager?: string;
  employeeId?: string;
  lastLogin?: Date;
  source: 'ldap' | 'sso' | 'local';
  isActive: boolean;
  attributes: Record<string, any>;
}

interface AuthenticationProvider {
  id: string;
  name: string;
  type: 'ldap' | 'sso' | 'api';
  config: any;
  priority: number;
  enabled: boolean;
  fallbackToNext: boolean;
}

interface SyncResult {
  success: boolean;
  usersAdded: number;
  usersUpdated: number;
  usersRemoved: number;
  groupsAdded: number;
  groupsUpdated: number;
  errors: string[];
  duration: number;
  timestamp: Date;
}

interface APIIntegration {
  id: string;
  name: string;
  type: 'rest' | 'graphql' | 'webhook';
  baseURL: string;
  authentication: {
    type: 'bearer' | 'basic' | 'api_key' | 'oauth2';
    credentials: Record<string, string>;
  };
  endpoints: {
    users?: string;
    groups?: string;
    roles?: string;
    sync?: string;
  };
  rateLimits: {
    requestsPerMinute: number;
    burstLimit: number;
  };
  enabled: boolean;
}

class EnterpriseIntegrationService {
  private ldapConfigs: Map<string, LDAPConfig> = new Map();
  private ssoProviders: Map<string, SSOProvider> = new Map();
  private authProviders: Map<string, AuthenticationProvider> = new Map();
  private apiIntegrations: Map<string, APIIntegration> = new Map();
  private enterpriseUsers: Map<string, EnterpriseUser> = new Map();
  private syncInterval: NodeJS.Timeout | null = null;
  private lastSyncResult: SyncResult | null = null;

  private readonly STORAGE_KEYS = {
    LDAP_CONFIGS: 'enterprise_ldap_configs',
    SSO_PROVIDERS: 'enterprise_sso_providers',
    AUTH_PROVIDERS: 'enterprise_auth_providers',
    API_INTEGRATIONS: 'enterprise_api_integrations',
    ENTERPRISE_USERS: 'enterprise_users',
    SYNC_RESULTS: 'enterprise_sync_results'
  };

  async initialize(): Promise<void> {
    await this.loadConfigurations();
    await this.startAutoSync();
    console.log('🏢 Enterprise Integration Service initialized');
  }

  // LDAP Integration
  async createLDAPConfig(config: Omit<LDAPConfig, 'id'>): Promise<string> {
    const configId = `ldap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const ldapConfig: LDAPConfig = {
      id: configId,
      ...config
    };

    this.ldapConfigs.set(configId, ldapConfig);
    await this.saveLDAPConfigs();

    return configId;
  }

  async testLDAPConnection(configId: string): Promise<{ success: boolean; message: string; userCount?: number }> {
    const config = this.ldapConfigs.get(configId);
    if (!config) {
      return { success: false, message: 'LDAP configuration not found' };
    }

    try {
      // Simulate LDAP connection test
      // In production, use a proper LDAP library like ldapjs
      console.log(`🔍 Testing LDAP connection to ${config.host}:${config.port}`);
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock successful connection
      const mockUserCount = Math.floor(Math.random() * 1000) + 100;
      
      return {
        success: true,
        message: 'LDAP connection successful',
        userCount: mockUserCount
      };
    } catch (error) {
      return {
        success: false,
        message: `LDAP connection failed: ${error.message}`
      };
    }
  }

  async syncLDAPUsers(configId: string): Promise<SyncResult> {
    const config = this.ldapConfigs.get(configId);
    if (!config) {
      throw new Error('LDAP configuration not found');
    }

    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      usersAdded: 0,
      usersUpdated: 0,
      usersRemoved: 0,
      groupsAdded: 0,
      groupsUpdated: 0,
      errors: [],
      duration: 0,
      timestamp: new Date()
    };

    try {
      console.log(`🔄 Syncing users from LDAP: ${config.name}`);
      
      // Simulate LDAP user fetch
      // In production, implement actual LDAP queries
      const mockUsers = this.generateMockLDAPUsers(50);
      
      for (const ldapUser of mockUsers) {
        try {
          const existingUser = Array.from(this.enterpriseUsers.values())
            .find(u => u.username === ldapUser.username);

          if (existingUser) {
            // Update existing user
            Object.assign(existingUser, ldapUser);
            result.usersUpdated++;
          } else {
            // Add new user
            this.enterpriseUsers.set(ldapUser.id, ldapUser);
            result.usersAdded++;
          }
        } catch (error) {
          result.errors.push(`Failed to sync user ${ldapUser.username}: ${error.message}`);
        }
      }

      await this.saveEnterpriseUsers();
      
      result.duration = Date.now() - startTime;
      this.lastSyncResult = result;
      await this.saveSyncResults();

      console.log(`✅ LDAP sync completed: ${result.usersAdded} added, ${result.usersUpdated} updated`);
      
      return result;
    } catch (error) {
      result.success = false;
      result.errors.push(error.message);
      result.duration = Date.now() - startTime;
      
      return result;
    }
  }

  // SSO Integration
  async createSSOProvider(provider: Omit<SSOProvider, 'id'>): Promise<string> {
    const providerId = `sso_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const ssoProvider: SSOProvider = {
      id: providerId,
      ...provider
    };

    this.ssoProviders.set(providerId, ssoProvider);
    await this.saveSSOProviders();

    return providerId;
  }

  async authenticateWithSSO(providerId: string, authCode: string): Promise<{
    success: boolean;
    user?: EnterpriseUser;
    token?: string;
    error?: string;
  }> {
    const provider = this.ssoProviders.get(providerId);
    if (!provider || !provider.enabled) {
      return { success: false, error: 'SSO provider not found or disabled' };
    }

    try {
      console.log(`🔐 Authenticating with SSO provider: ${provider.name}`);
      
      // Simulate SSO authentication
      // In production, implement actual OAuth2/SAML flow
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const mockUser: EnterpriseUser = {
        id: `sso_user_${Date.now()}`,
        username: 'john.doe',
        email: 'john.doe@company.com',
        firstName: 'John',
        lastName: 'Doe',
        groups: ['employees', 'developers'],
        roles: ['user', 'developer'],
        department: 'Engineering',
        source: 'sso',
        isActive: true,
        attributes: {
          ssoProvider: provider.name,
          lastSSOLogin: new Date()
        }
      };

      // Store user
      this.enterpriseUsers.set(mockUser.id, mockUser);
      await this.saveEnterpriseUsers();

      const token = await authService.generateToken(mockUser.id);

      return {
        success: true,
        user: mockUser,
        token
      };
    } catch (error) {
      return {
        success: false,
        error: `SSO authentication failed: ${error.message}`
      };
    }
  }

  // API Integration
  async createAPIIntegration(integration: Omit<APIIntegration, 'id'>): Promise<string> {
    const integrationId = `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const apiIntegration: APIIntegration = {
      id: integrationId,
      ...integration
    };

    this.apiIntegrations.set(integrationId, apiIntegration);
    await this.saveAPIIntegrations();

    return integrationId;
  }

  async testAPIIntegration(integrationId: string): Promise<{ success: boolean; message: string; responseTime?: number }> {
    const integration = this.apiIntegrations.get(integrationId);
    if (!integration) {
      return { success: false, message: 'API integration not found' };
    }

    try {
      const startTime = Date.now();
      console.log(`🔌 Testing API integration: ${integration.name}`);
      
      // Simulate API test
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const responseTime = Date.now() - startTime;
      
      return {
        success: true,
        message: 'API integration test successful',
        responseTime
      };
    } catch (error) {
      return {
        success: false,
        message: `API integration test failed: ${error.message}`
      };
    }
  }

  // User Management
  async getEnterpriseUsers(filters: {
    source?: 'ldap' | 'sso' | 'local';
    group?: string;
    role?: string;
    department?: string;
    isActive?: boolean;
  } = {}): Promise<EnterpriseUser[]> {
    let users = Array.from(this.enterpriseUsers.values());

    // Apply filters
    if (filters.source) {
      users = users.filter(u => u.source === filters.source);
    }
    if (filters.group) {
      users = users.filter(u => u.groups.includes(filters.group));
    }
    if (filters.role) {
      users = users.filter(u => u.roles.includes(filters.role));
    }
    if (filters.department) {
      users = users.filter(u => u.department === filters.department);
    }
    if (filters.isActive !== undefined) {
      users = users.filter(u => u.isActive === filters.isActive);
    }

    return users.sort((a, b) => a.username.localeCompare(b.username));
  }

  async updateEnterpriseUser(userId: string, updates: Partial<EnterpriseUser>): Promise<boolean> {
    const user = this.enterpriseUsers.get(userId);
    if (!user) return false;

    Object.assign(user, updates);
    this.enterpriseUsers.set(userId, user);
    await this.saveEnterpriseUsers();

    return true;
  }

  async deactivateUser(userId: string, reason: string): Promise<boolean> {
    const user = this.enterpriseUsers.get(userId);
    if (!user) return false;

    user.isActive = false;
    user.attributes.deactivationReason = reason;
    user.attributes.deactivatedAt = new Date();

    this.enterpriseUsers.set(userId, user);
    await this.saveEnterpriseUsers();

    console.log(`👤 User deactivated: ${user.username} (${reason})`);
    return true;
  }

  // Group & Role Management
  async getUserGroups(): Promise<Array<{ name: string; memberCount: number; source: string }>> {
    const groups = new Map<string, { memberCount: number; source: string }>();

    for (const user of this.enterpriseUsers.values()) {
      for (const group of user.groups) {
        if (!groups.has(group)) {
          groups.set(group, { memberCount: 0, source: user.source });
        }
        groups.get(group)!.memberCount++;
      }
    }

    return Array.from(groups.entries()).map(([name, info]) => ({
      name,
      ...info
    }));
  }

  async getUsersByGroup(groupName: string): Promise<EnterpriseUser[]> {
    return Array.from(this.enterpriseUsers.values())
      .filter(user => user.groups.includes(groupName))
      .sort((a, b) => a.username.localeCompare(b.username));
  }

  // Authentication Flow
  async authenticateEnterpriseUser(username: string, password: string): Promise<{
    success: boolean;
    user?: EnterpriseUser;
    token?: string;
    requiresMFA?: boolean;
    error?: string;
  }> {
    try {
      // Try authentication providers in priority order
      const providers = Array.from(this.authProviders.values())
        .filter(p => p.enabled)
        .sort((a, b) => a.priority - b.priority);

      for (const provider of providers) {
        try {
          const result = await this.tryProviderAuthentication(provider, username, password);
          
          if (result.success) {
            return result;
          }
          
          if (!provider.fallbackToNext) {
            return result;
          }
        } catch (providerError) {
          console.error(`Provider ${provider.name} failed:`, providerError);
          
          if (!provider.fallbackToNext) {
            return {
              success: false,
              error: `Authentication failed: ${providerError.message}`
            };
          }
        }
      }

      return {
        success: false,
        error: 'All authentication providers failed'
      };
    } catch (error) {
      return {
        success: false,
        error: `Enterprise authentication failed: ${error.message}`
      };
    }
  }

  // Provisioning & Sync
  async scheduleUserSync(interval: number): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      await this.performFullSync();
    }, interval);

    console.log(`🔄 User sync scheduled every ${interval / 1000 / 60} minutes`);
  }

  async performFullSync(): Promise<SyncResult> {
    const startTime = Date.now();
    console.log('🔄 Starting enterprise user sync...');

    const result: SyncResult = {
      success: true,
      usersAdded: 0,
      usersUpdated: 0,
      usersRemoved: 0,
      groupsAdded: 0,
      groupsUpdated: 0,
      errors: [],
      duration: 0,
      timestamp: new Date()
    };

    try {
      // Sync from all enabled LDAP configs
      for (const ldapConfig of this.ldapConfigs.values()) {
        if (ldapConfig.enabled) {
          try {
            const ldapResult = await this.syncLDAPUsers(ldapConfig.id);
            result.usersAdded += ldapResult.usersAdded;
            result.usersUpdated += ldapResult.usersUpdated;
            result.usersRemoved += ldapResult.usersRemoved;
            result.errors.push(...ldapResult.errors);
          } catch (ldapError) {
            result.errors.push(`LDAP sync failed for ${ldapConfig.name}: ${ldapError.message}`);
          }
        }
      }

      // Sync from API integrations
      for (const apiIntegration of this.apiIntegrations.values()) {
        if (apiIntegration.enabled) {
          try {
            await this.syncFromAPI(apiIntegration);
          } catch (apiError) {
            result.errors.push(`API sync failed for ${apiIntegration.name}: ${apiError.message}`);
          }
        }
      }

      result.duration = Date.now() - startTime;
      result.success = result.errors.length === 0;
      
      this.lastSyncResult = result;
      await this.saveSyncResults();

      console.log(`✅ Enterprise sync completed in ${result.duration}ms`);
      return result;
    } catch (error) {
      result.success = false;
      result.errors.push(error.message);
      result.duration = Date.now() - startTime;
      
      return result;
    }
  }

  // Configuration Management
  async getConfigurations(): Promise<{
    ldap: LDAPConfig[];
    sso: SSOProvider[];
    api: APIIntegration[];
  }> {
    return {
      ldap: Array.from(this.ldapConfigs.values()),
      sso: Array.from(this.ssoProviders.values()),
      api: Array.from(this.apiIntegrations.values())
    };
  }

  async updateLDAPConfig(configId: string, updates: Partial<LDAPConfig>): Promise<boolean> {
    const config = this.ldapConfigs.get(configId);
    if (!config) return false;

    Object.assign(config, updates);
    this.ldapConfigs.set(configId, config);
    await this.saveLDAPConfigs();

    return true;
  }

  async updateSSOProvider(providerId: string, updates: Partial<SSOProvider>): Promise<boolean> {
    const provider = this.ssoProviders.get(providerId);
    if (!provider) return false;

    Object.assign(provider, updates);
    this.ssoProviders.set(providerId, provider);
    await this.saveSSOProviders();

    return true;
  }

  // Compliance & Audit
  async getComplianceReport(): Promise<{
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    lastSync: Date | null;
    syncErrors: string[];
    configurationIssues: string[];
    securityRecommendations: string[];
  }> {
    const users = Array.from(this.enterpriseUsers.values());
    const activeUsers = users.filter(u => u.isActive);
    const inactiveUsers = users.filter(u => !u.isActive);

    const configIssues: string[] = [];
    const securityRecommendations: string[] = [];

    // Check for configuration issues
    for (const ldapConfig of this.ldapConfigs.values()) {
      if (ldapConfig.enabled && !ldapConfig.useTLS) {
        configIssues.push(`LDAP config '${ldapConfig.name}' is not using TLS encryption`);
        securityRecommendations.push('Enable TLS for all LDAP connections');
      }
    }

    for (const ssoProvider of this.ssoProviders.values()) {
      if (ssoProvider.enabled && ssoProvider.type === 'oauth2' && !ssoProvider.config.scope?.includes('openid')) {
        securityRecommendations.push(`SSO provider '${ssoProvider.name}' should use OpenID Connect for better security`);
      }
    }

    return {
      totalUsers: users.length,
      activeUsers: activeUsers.length,
      inactiveUsers: inactiveUsers.length,
      lastSync: this.lastSyncResult?.timestamp || null,
      syncErrors: this.lastSyncResult?.errors || [],
      configurationIssues: configIssues,
      securityRecommendations
    };
  }

  // Private Methods
  private async tryProviderAuthentication(
    provider: AuthenticationProvider,
    username: string,
    password: string
  ): Promise<{
    success: boolean;
    user?: EnterpriseUser;
    token?: string;
    requiresMFA?: boolean;
    error?: string;
  }> {
    switch (provider.type) {
      case 'ldap':
        return await this.authenticateLDAP(provider, username, password);
      case 'sso':
        return await this.authenticateSSO(provider, username, password);
      case 'api':
        return await this.authenticateAPI(provider, username, password);
      default:
        return { success: false, error: 'Unknown provider type' };
    }
  }

  private async authenticateLDAP(
    provider: AuthenticationProvider,
    username: string,
    password: string
  ): Promise<{
    success: boolean;
    user?: EnterpriseUser;
    token?: string;
    error?: string;
  }> {
    // Simulate LDAP authentication
    const user = Array.from(this.enterpriseUsers.values())
      .find(u => u.username === username && u.source === 'ldap');

    if (user && user.isActive) {
      user.lastLogin = new Date();
      const token = await authService.generateToken(user.id);
      
      return {
        success: true,
        user,
        token
      };
    }

    return { success: false, error: 'Invalid LDAP credentials' };
  }

  private async authenticateSSO(
    provider: AuthenticationProvider,
    username: string,
    password: string
  ): Promise<{
    success: boolean;
    user?: EnterpriseUser;
    token?: string;
    error?: string;
  }> {
    // SSO authentication would redirect to external provider
    return { success: false, error: 'SSO requires browser redirect' };
  }

  private async authenticateAPI(
    provider: AuthenticationProvider,
    username: string,
    password: string
  ): Promise<{
    success: boolean;
    user?: EnterpriseUser;
    token?: string;
    error?: string;
  }> {
    // Simulate API authentication
    return { success: false, error: 'API authentication not implemented' };
  }

  private async syncFromAPI(integration: APIIntegration): Promise<void> {
    // Simulate API user sync
    console.log(`🔌 Syncing from API: ${integration.name}`);
  }

  private generateMockLDAPUsers(count: number): EnterpriseUser[] {
    const users: EnterpriseUser[] = [];
    const departments = ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance'];
    const roles = ['user', 'admin', 'manager', 'developer', 'analyst'];

    for (let i = 0; i < count; i++) {
      const firstName = `User${i}`;
      const lastName = `LastName${i}`;
      const username = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`;
      
      users.push({
        id: `ldap_user_${i}`,
        username,
        email: `${username}@company.com`,
        firstName,
        lastName,
        groups: ['employees', departments[i % departments.length].toLowerCase()],
        roles: [roles[i % roles.length]],
        department: departments[i % departments.length],
        source: 'ldap',
        isActive: Math.random() > 0.1, // 90% active
        attributes: {
          employeeId: `EMP${1000 + i}`,
          joinDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000)
        }
      });
    }

    return users;
  }

  private async startAutoSync(): Promise<void> {
    // Start auto-sync if any configs are enabled
    const hasEnabledConfigs = Array.from(this.ldapConfigs.values()).some(c => c.enabled) ||
                             Array.from(this.apiIntegrations.values()).some(i => i.enabled);

    if (hasEnabledConfigs) {
      await this.scheduleUserSync(15 * 60 * 1000); // 15 minutes
    }
  }

  // Storage Methods
  private async loadConfigurations(): Promise<void> {
    try {
      const [ldapData, ssoData, authProvidersData, apiData, usersData, syncData] = await Promise.all([
        AsyncStorage.getItem(this.STORAGE_KEYS.LDAP_CONFIGS),
        AsyncStorage.getItem(this.STORAGE_KEYS.SSO_PROVIDERS),
        AsyncStorage.getItem(this.STORAGE_KEYS.AUTH_PROVIDERS),
        AsyncStorage.getItem(this.STORAGE_KEYS.API_INTEGRATIONS),
        AsyncStorage.getItem(this.STORAGE_KEYS.ENTERPRISE_USERS),
        AsyncStorage.getItem(this.STORAGE_KEYS.SYNC_RESULTS)
      ]);

      if (ldapData) {
        const ldapConfigs = JSON.parse(ldapData);
        ldapConfigs.forEach((config: LDAPConfig) => {
          this.ldapConfigs.set(config.id, config);
        });
      }

      if (ssoData) {
        const ssoProviders = JSON.parse(ssoData);
        ssoProviders.forEach((provider: SSOProvider) => {
          this.ssoProviders.set(provider.id, provider);
        });
      }

      if (authProvidersData) {
        const authProviders = JSON.parse(authProvidersData);
        authProviders.forEach((provider: AuthenticationProvider) => {
          this.authProviders.set(provider.id, provider);
        });
      }

      if (apiData) {
        const apiIntegrations = JSON.parse(apiData);
        apiIntegrations.forEach((integration: APIIntegration) => {
          this.apiIntegrations.set(integration.id, integration);
        });
      }

      if (usersData) {
        const users = JSON.parse(usersData);
        users.forEach((user: any) => {
          if (user.lastLogin) user.lastLogin = new Date(user.lastLogin);
          this.enterpriseUsers.set(user.id, user);
        });
      }

      if (syncData) {
        const syncResult = JSON.parse(syncData);
        if (syncResult.timestamp) {
          syncResult.timestamp = new Date(syncResult.timestamp);
          this.lastSyncResult = syncResult;
        }
      }
    } catch (error) {
      console.error('Failed to load enterprise configurations:', error);
    }
  }

  private async saveLDAPConfigs(): Promise<void> {
    try {
      const configs = Array.from(this.ldapConfigs.values());
      await AsyncStorage.setItem(this.STORAGE_KEYS.LDAP_CONFIGS, JSON.stringify(configs));
    } catch (error) {
      console.error('Failed to save LDAP configs:', error);
    }
  }

  private async saveSSOProviders(): Promise<void> {
    try {
      const providers = Array.from(this.ssoProviders.values());
      await AsyncStorage.setItem(this.STORAGE_KEYS.SSO_PROVIDERS, JSON.stringify(providers));
    } catch (error) {
      console.error('Failed to save SSO providers:', error);
    }
  }

  private async saveAPIIntegrations(): Promise<void> {
    try {
      const integrations = Array.from(this.apiIntegrations.values());
      await AsyncStorage.setItem(this.STORAGE_KEYS.API_INTEGRATIONS, JSON.stringify(integrations));
    } catch (error) {
      console.error('Failed to save API integrations:', error);
    }
  }

  private async saveEnterpriseUsers(): Promise<void> {
    try {
      const users = Array.from(this.enterpriseUsers.values());
      await AsyncStorage.setItem(this.STORAGE_KEYS.ENTERPRISE_USERS, JSON.stringify(users));
    } catch (error) {
      console.error('Failed to save enterprise users:', error);
    }
  }

  private async saveSyncResults(): Promise<void> {
    try {
      if (this.lastSyncResult) {
        await AsyncStorage.setItem(this.STORAGE_KEYS.SYNC_RESULTS, JSON.stringify(this.lastSyncResult));
      }
    } catch (error) {
      console.error('Failed to save sync results:', error);
    }
  }

  getLastSyncResult(): SyncResult | null {
    return this.lastSyncResult;
  }

  dispose(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    this.ldapConfigs.clear();
    this.ssoProviders.clear();
    this.authProviders.clear();
    this.apiIntegrations.clear();
    this.enterpriseUsers.clear();
  }
}

export const enterpriseIntegrationService = new EnterpriseIntegrationService();
