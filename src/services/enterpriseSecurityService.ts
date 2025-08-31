import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';
import * as Keychain from 'react-native-keychain';

interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  action: string;
  resource: string;
  outcome: 'success' | 'failure' | 'blocked';
  ipAddress?: string;
  userAgent?: string;
  details: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface TwoFactorConfig {
  enabled: boolean;
  method: 'totp' | 'sms' | 'email';
  secret?: string;
  backupCodes: string[];
  lastUsed?: string;
}

interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  rules: SecurityRule[];
  enabled: boolean;
  priority: number;
}

interface SecurityRule {
  id: string;
  type: 'authentication' | 'authorization' | 'audit' | 'encryption';
  condition: string;
  action: 'allow' | 'deny' | 'log' | 'require_2fa';
  parameters: Record<string, any>;
}

interface Role {
  id: string;
  name: string;
  permissions: Permission[];
  description: string;
}

interface Permission {
  resource: string;
  actions: string[];
  conditions?: string[];
}

class EnterpriseSecurityService {
  private auditLogs: AuditLog[] = [];
  private twoFactorConfig: TwoFactorConfig | null = null;
  private securityPolicies: Map<string, SecurityPolicy> = new Map();
  private roles: Map<string, Role> = new Map();
  private userRoles: Map<string, string[]> = new Map();
  private sessionTokens: Map<string, { token: string; expiry: number }> = new Map();
  private failedAttempts: Map<string, { count: number; lastAttempt: number }> = new Map();

  async initialize(): Promise<void> {
    try {
      await this.loadAuditLogs();
      await this.load2FAConfig();
      await this.loadSecurityPolicies();
      await this.loadRoles();
      this.setupDefaultSecurity();
      console.log('🔐 Enterprise Security Service initialized');
    } catch (error) {
      console.error('Enterprise security initialization failed:', error);
    }
  }

  // Two-Factor Authentication
  async enable2FA(method: 'totp' | 'sms' | 'email'): Promise<{ secret?: string; qrCode?: string; backupCodes: string[] }> {
    try {
      const secret = this.generateTOTPSecret();
      const backupCodes = this.generateBackupCodes();
      
      this.twoFactorConfig = {
        enabled: true,
        method,
        secret,
        backupCodes,
        lastUsed: undefined
      };

      await this.save2FAConfig();
      
      await this.logAuditEvent({
        action: 'enable_2fa',
        resource: 'authentication',
        outcome: 'success',
        details: { method },
        severity: 'medium'
      });

      const qrCode = method === 'totp' ? this.generateQRCodeData(secret) : undefined;

      return {
        secret: method === 'totp' ? secret : undefined,
        qrCode,
        backupCodes
      };
    } catch (error) {
      await this.logAuditEvent({
        action: 'enable_2fa',
        resource: 'authentication',
        outcome: 'failure',
        details: { error: error.message },
        severity: 'high'
      });
      throw error;
    }
  }

  async disable2FA(): Promise<void> {
    try {
      this.twoFactorConfig = null;
      await Keychain.resetInternetCredentials('nexus_2fa');
      
      await this.logAuditEvent({
        action: 'disable_2fa',
        resource: 'authentication',
        outcome: 'success',
        details: {},
        severity: 'medium'
      });
    } catch (error) {
      await this.logAuditEvent({
        action: 'disable_2fa',
        resource: 'authentication',
        outcome: 'failure',
        details: { error: error.message },
        severity: 'high'
      });
      throw error;
    }
  }

  async verify2FA(code: string): Promise<boolean> {
    try {
      if (!this.twoFactorConfig?.enabled) {
        return false;
      }

      let isValid = false;

      switch (this.twoFactorConfig.method) {
        case 'totp':
          isValid = this.verifyTOTP(code, this.twoFactorConfig.secret!);
          break;
        case 'sms':
        case 'email':
          // In real implementation, verify with backend
          isValid = true;
          break;
      }

      // Check backup codes
      if (!isValid && this.twoFactorConfig.backupCodes.includes(code)) {
        isValid = true;
        // Remove used backup code
        this.twoFactorConfig.backupCodes = this.twoFactorConfig.backupCodes.filter(c => c !== code);
        await this.save2FAConfig();
      }

      await this.logAuditEvent({
        action: 'verify_2fa',
        resource: 'authentication',
        outcome: isValid ? 'success' : 'failure',
        details: { method: this.twoFactorConfig.method },
        severity: isValid ? 'low' : 'medium'
      });

      if (isValid) {
        this.twoFactorConfig.lastUsed = new Date().toISOString();
        await this.save2FAConfig();
      }

      return isValid;
    } catch (error) {
      await this.logAuditEvent({
        action: 'verify_2fa',
        resource: 'authentication',
        outcome: 'failure',
        details: { error: error.message },
        severity: 'high'
      });
      return false;
    }
  }

  // Role-Based Access Control
  async createRole(name: string, permissions: Permission[], description: string): Promise<string> {
    const roleId = `role_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const role: Role = {
      id: roleId,
      name,
      permissions,
      description
    };

    this.roles.set(roleId, role);
    await this.saveRoles();

    await this.logAuditEvent({
      action: 'create_role',
      resource: 'rbac',
      outcome: 'success',
      details: { roleId, name },
      severity: 'medium'
    });

    return roleId;
  }

  async assignRole(userId: string, roleId: string): Promise<boolean> {
    try {
      const role = this.roles.get(roleId);
      if (!role) return false;

      const userRoles = this.userRoles.get(userId) || [];
      if (!userRoles.includes(roleId)) {
        userRoles.push(roleId);
        this.userRoles.set(userId, userRoles);
        await this.saveUserRoles();

        await this.logAuditEvent({
          action: 'assign_role',
          resource: 'rbac',
          outcome: 'success',
          details: { userId, roleId, roleName: role.name },
          severity: 'medium'
        });
      }

      return true;
    } catch (error) {
      await this.logAuditEvent({
        action: 'assign_role',
        resource: 'rbac',
        outcome: 'failure',
        details: { userId, roleId, error: error.message },
        severity: 'high'
      });
      return false;
    }
  }

  async checkPermission(userId: string, resource: string, action: string): Promise<boolean> {
    try {
      const userRoles = this.userRoles.get(userId) || [];
      
      for (const roleId of userRoles) {
        const role = this.roles.get(roleId);
        if (!role) continue;

        for (const permission of role.permissions) {
          if (permission.resource === resource && permission.actions.includes(action)) {
            return true;
          }
        }
      }

      await this.logAuditEvent({
        action: 'permission_check',
        resource,
        outcome: 'failure',
        details: { userId, requestedAction: action },
        severity: 'low'
      });

      return false;
    } catch (error) {
      console.error('Permission check failed:', error);
      return false;
    }
  }

  // Audit Logging
  async logAuditEvent(event: Omit<AuditLog, 'id' | 'timestamp' | 'userId'>): Promise<void> {
    const auditLog: AuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      userId: 'current_user', // In real implementation, get from auth service
      ...event
    };

    this.auditLogs.push(auditLog);
    
    // Keep only last 10000 audit logs
    if (this.auditLogs.length > 10000) {
      this.auditLogs = this.auditLogs.slice(-10000);
    }

    await this.saveAuditLogs();

    // Alert on critical events
    if (event.severity === 'critical') {
      console.warn(`🚨 Critical security event: ${event.action}`);
    }
  }

  async getAuditLogs(filters?: {
    startDate?: string;
    endDate?: string;
    userId?: string;
    action?: string;
    severity?: string;
    limit?: number;
  }): Promise<AuditLog[]> {
    let logs = [...this.auditLogs];

    if (filters) {
      if (filters.startDate) {
        logs = logs.filter(log => log.timestamp >= filters.startDate!);
      }
      if (filters.endDate) {
        logs = logs.filter(log => log.timestamp <= filters.endDate!);
      }
      if (filters.userId) {
        logs = logs.filter(log => log.userId === filters.userId);
      }
      if (filters.action) {
        logs = logs.filter(log => log.action.includes(filters.action!));
      }
      if (filters.severity) {
        logs = logs.filter(log => log.severity === filters.severity);
      }
      if (filters.limit) {
        logs = logs.slice(0, filters.limit);
      }
    }

    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  // Session Management
  async createSecureSession(userId: string): Promise<string> {
    const sessionToken = CryptoJS.lib.WordArray.random(32).toString();
    const hashedToken = CryptoJS.SHA256(sessionToken).toString();
    const expiry = Date.now() + (8 * 60 * 60 * 1000); // 8 hours

    this.sessionTokens.set(hashedToken, {
      token: sessionToken,
      expiry
    });

    await this.logAuditEvent({
      action: 'create_session',
      resource: 'session',
      outcome: 'success',
      details: { sessionId: hashedToken },
      severity: 'low'
    });

    return sessionToken;
  }

  async validateSession(sessionToken: string): Promise<boolean> {
    const hashedToken = CryptoJS.SHA256(sessionToken).toString();
    const session = this.sessionTokens.get(hashedToken);

    if (!session || Date.now() > session.expiry) {
      this.sessionTokens.delete(hashedToken);
      return false;
    }

    return true;
  }

  async revokeSession(sessionToken: string): Promise<void> {
    const hashedToken = CryptoJS.SHA256(sessionToken).toString();
    this.sessionTokens.delete(hashedToken);

    await this.logAuditEvent({
      action: 'revoke_session',
      resource: 'session',
      outcome: 'success',
      details: { sessionId: hashedToken },
      severity: 'low'
    });
  }

  // Brute Force Protection
  async recordFailedAttempt(identifier: string): Promise<boolean> {
    const attempt = this.failedAttempts.get(identifier) || { count: 0, lastAttempt: 0 };
    
    // Reset count if last attempt was more than 1 hour ago
    if (Date.now() - attempt.lastAttempt > 3600000) {
      attempt.count = 0;
    }

    attempt.count++;
    attempt.lastAttempt = Date.now();
    this.failedAttempts.set(identifier, attempt);

    // Block after 5 failed attempts
    const isBlocked = attempt.count >= 5;

    await this.logAuditEvent({
      action: 'failed_login_attempt',
      resource: 'authentication',
      outcome: isBlocked ? 'blocked' : 'failure',
      details: { identifier, attemptCount: attempt.count },
      severity: isBlocked ? 'high' : 'medium'
    });

    return isBlocked;
  }

  async clearFailedAttempts(identifier: string): Promise<void> {
    this.failedAttempts.delete(identifier);
  }

  isBlocked(identifier: string): boolean {
    const attempt = this.failedAttempts.get(identifier);
    if (!attempt) return false;

    // Check if still blocked (5 attempts in last hour)
    if (attempt.count >= 5 && Date.now() - attempt.lastAttempt < 3600000) {
      return true;
    }

    return false;
  }

  // Security Analytics
  async getSecurityMetrics(): Promise<{
    totalAuditEvents: number;
    criticalEvents: number;
    failedLogins: number;
    activeBlocks: number;
    topThreats: Array<{ action: string; count: number }>;
  }> {
    const last24Hours = Date.now() - (24 * 60 * 60 * 1000);
    const recentLogs = this.auditLogs.filter(log => 
      new Date(log.timestamp).getTime() > last24Hours
    );

    const criticalEvents = recentLogs.filter(log => log.severity === 'critical').length;
    const failedLogins = recentLogs.filter(log => 
      log.action === 'failed_login_attempt' && log.outcome === 'failure'
    ).length;

    const activeBlocks = Array.from(this.failedAttempts.values())
      .filter(attempt => attempt.count >= 5 && Date.now() - attempt.lastAttempt < 3600000)
      .length;

    // Calculate top threats
    const actionCounts: Record<string, number> = {};
    recentLogs.forEach(log => {
      if (log.outcome === 'failure' || log.outcome === 'blocked') {
        actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
      }
    });

    const topThreats = Object.entries(actionCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([action, count]) => ({ action, count }));

    return {
      totalAuditEvents: recentLogs.length,
      criticalEvents,
      failedLogins,
      activeBlocks,
      topThreats
    };
  }

  // Private Methods
  private generateTOTPSecret(): string {
    return CryptoJS.lib.WordArray.random(20).toString().toUpperCase();
  }

  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      codes.push(CryptoJS.lib.WordArray.random(4).toString().toUpperCase());
    }
    return codes;
  }

  private generateQRCodeData(secret: string): string {
    const issuer = 'Nexus Terminal';
    const accountName = 'user@nexusterminal.com';
    return `otpauth://totp/${issuer}:${accountName}?secret=${secret}&issuer=${issuer}`;
  }

  private verifyTOTP(code: string, secret: string): boolean {
    // Simple TOTP verification - in production use proper TOTP library
    const timeStep = Math.floor(Date.now() / 1000 / 30);
    const expectedCode = CryptoJS.HmacSHA1(timeStep.toString(), secret).toString().slice(-6);
    return code === expectedCode;
  }

  private async load2FAConfig(): Promise<void> {
    try {
      const credentials = await Keychain.getInternetCredentials('nexus_2fa');
      if (credentials && credentials.password) {
        this.twoFactorConfig = JSON.parse(credentials.password);
      }
    } catch (error) {
      console.error('Failed to load 2FA config:', error);
    }
  }

  private async save2FAConfig(): Promise<void> {
    try {
      if (this.twoFactorConfig) {
        await Keychain.setInternetCredentials(
          'nexus_2fa',
          'config',
          JSON.stringify(this.twoFactorConfig)
        );
      }
    } catch (error) {
      console.error('Failed to save 2FA config:', error);
    }
  }

  private async loadAuditLogs(): Promise<void> {
    try {
      const logsData = await AsyncStorage.getItem('audit_logs');
      if (logsData) {
        this.auditLogs = JSON.parse(logsData);
      }
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    }
  }

  private async saveAuditLogs(): Promise<void> {
    try {
      await AsyncStorage.setItem('audit_logs', JSON.stringify(this.auditLogs));
    } catch (error) {
      console.error('Failed to save audit logs:', error);
    }
  }

  private async loadSecurityPolicies(): Promise<void> {
    try {
      const policiesData = await AsyncStorage.getItem('security_policies');
      if (policiesData) {
        const policies = JSON.parse(policiesData);
        this.securityPolicies = new Map(policies);
      }
    } catch (error) {
      console.error('Failed to load security policies:', error);
    }
  }

  private async loadRoles(): Promise<void> {
    try {
      const rolesData = await AsyncStorage.getItem('security_roles');
      const userRolesData = await AsyncStorage.getItem('user_roles');
      
      if (rolesData) {
        const roles = JSON.parse(rolesData);
        this.roles = new Map(roles);
      }
      
      if (userRolesData) {
        const userRoles = JSON.parse(userRolesData);
        this.userRoles = new Map(userRoles);
      }
    } catch (error) {
      console.error('Failed to load roles:', error);
    }
  }

  private async saveRoles(): Promise<void> {
    try {
      await AsyncStorage.setItem('security_roles', JSON.stringify(Array.from(this.roles.entries())));
    } catch (error) {
      console.error('Failed to save roles:', error);
    }
  }

  private async saveUserRoles(): Promise<void> {
    try {
      await AsyncStorage.setItem('user_roles', JSON.stringify(Array.from(this.userRoles.entries())));
    } catch (error) {
      console.error('Failed to save user roles:', error);
    }
  }

  private setupDefaultSecurity(): void {
    // Create default roles
    this.roles.set('admin', {
      id: 'admin',
      name: 'Administrator',
      permissions: [
        { resource: '*', actions: ['*'] }
      ],
      description: 'Full system access'
    });

    this.roles.set('user', {
      id: 'user',
      name: 'User',
      permissions: [
        { resource: 'terminal', actions: ['read', 'execute'] },
        { resource: 'files', actions: ['read', 'write', 'delete'] },
        { resource: 'system', actions: ['read'] }
      ],
      description: 'Standard user access'
    });

    this.roles.set('readonly', {
      id: 'readonly',
      name: 'Read Only',
      permissions: [
        { resource: 'terminal', actions: ['read'] },
        { resource: 'files', actions: ['read'] },
        { resource: 'system', actions: ['read'] }
      ],
      description: 'Read-only access'
    });
  }

  dispose(): void {
    this.auditLogs = [];
    this.twoFactorConfig = null;
    this.securityPolicies.clear();
    this.roles.clear();
    this.userRoles.clear();
    this.sessionTokens.clear();
    this.failedAttempts.clear();
  }
}

export const enterpriseSecurityService = new EnterpriseSecurityService();
