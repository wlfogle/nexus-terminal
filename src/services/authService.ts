import { User } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';
import * as Keychain from 'react-native-keychain';

interface LoginCredentials {
  username: string;
  password: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

class AuthService {
  private user: User | null = null;
  private tokens: AuthTokens | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private authCallbacks: ((user: User | null) => void)[] = [];
  private encryptionKey = 'NexusTerminalSecretKey2023';

  async initialize(): Promise<void> {
    try {
      // Try to restore authentication state
      await this.restoreAuthState();
    } catch (error) {
      console.error('Auth initialization failed:', error);
    }
  }

  async login(credentials: LoginCredentials): Promise<User> {
    try {
      // Hash password for secure transmission
      const hashedPassword = CryptoJS.SHA256(credentials.password).toString();
      
      // Simulate API call - in real implementation, this would be an HTTP request
      const response = await this.makeAuthRequest('/auth/login', {
        username: credentials.username,
        password: hashedPassword
      });

      if (!response.success) {
        throw new Error(response.error || 'Login failed');
      }

      // Store tokens
      this.tokens = {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        expiresAt: Date.now() + (response.expiresIn * 1000)
      };

      // Store user
      this.user = response.user;

      // Persist authentication state
      await this.persistAuthState();

      // Setup token refresh
      this.setupTokenRefresh();

      // Notify listeners
      this.notifyAuthChange();

      return this.user;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      if (this.tokens?.accessToken) {
        // Notify server about logout
        await this.makeAuthRequest('/auth/logout', {
          token: this.tokens.accessToken
        });
      }
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      // Clear local state
      await this.clearAuthState();
    }
  }

  async refreshAccessToken(): Promise<boolean> {
    try {
      if (!this.tokens?.refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await this.makeAuthRequest('/auth/refresh', {
        refreshToken: this.tokens.refreshToken
      });

      if (!response.success) {
        // Refresh token is invalid, user needs to login again
        await this.clearAuthState();
        return false;
      }

      // Update tokens
      this.tokens = {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken || this.tokens.refreshToken,
        expiresAt: Date.now() + (response.expiresIn * 1000)
      };

      // Persist updated tokens
      await this.persistAuthState();

      // Setup next refresh
      this.setupTokenRefresh();

      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      await this.clearAuthState();
      return false;
    }
  }

  async register(userData: {
    username: string;
    email: string;
    password: string;
  }): Promise<User> {
    try {
      // Hash password
      const hashedPassword = CryptoJS.SHA256(userData.password).toString();

      const response = await this.makeAuthRequest('/auth/register', {
        username: userData.username,
        email: userData.email,
        password: hashedPassword
      });

      if (!response.success) {
        throw new Error(response.error || 'Registration failed');
      }

      // Auto-login after registration
      return await this.login({
        username: userData.username,
        password: userData.password
      });
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<boolean> {
    try {
      if (!this.tokens?.accessToken) {
        throw new Error('Not authenticated');
      }

      const hashedCurrentPassword = CryptoJS.SHA256(currentPassword).toString();
      const hashedNewPassword = CryptoJS.SHA256(newPassword).toString();

      const response = await this.makeAuthRequest('/auth/change-password', {
        currentPassword: hashedCurrentPassword,
        newPassword: hashedNewPassword
      });

      return response.success;
    } catch (error) {
      console.error('Password change failed:', error);
      throw error;
    }
  }

  async updateProfile(updates: Partial<User>): Promise<User> {
    try {
      if (!this.tokens?.accessToken || !this.user) {
        throw new Error('Not authenticated');
      }

      const response = await this.makeAuthRequest('/auth/profile', updates);

      if (!response.success) {
        throw new Error(response.error || 'Profile update failed');
      }

      // Update local user data
      this.user = { ...this.user, ...response.user };
      await this.persistAuthState();
      this.notifyAuthChange();

      return this.user;
    } catch (error) {
      console.error('Profile update failed:', error);
      throw error;
    }
  }

  getUser(): User | null {
    return this.user;
  }

  getAccessToken(): string | null {
    return this.tokens?.accessToken || null;
  }

  isAuthenticated(): boolean {
    return this.user !== null && this.tokens !== null && this.isTokenValid();
  }

  onAuthChange(callback: (user: User | null) => void): void {
    this.authCallbacks.push(callback);
  }

  removeAuthListener(callback: (user: User | null) => void): void {
    const index = this.authCallbacks.indexOf(callback);
    if (index !== -1) {
      this.authCallbacks.splice(index, 1);
    }
  }

  private async makeAuthRequest(endpoint: string, data: any): Promise<any> {
    // Simulate API request - in real implementation use fetch/axios
    // This is a mock implementation for demonstration
    
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay

    switch (endpoint) {
      case '/auth/login':
        return this.mockLogin(data);
      case '/auth/register':
        return this.mockRegister(data);
      case '/auth/refresh':
        return this.mockRefresh(data);
      case '/auth/logout':
        return { success: true };
      case '/auth/change-password':
        return this.mockChangePassword(data);
      case '/auth/profile':
        return this.mockUpdateProfile(data);
      default:
        throw new Error('Unknown endpoint');
    }
  }

  private mockLogin(data: any): any {
    // Mock successful login
    if (data.username === 'demo' && data.password === CryptoJS.SHA256('password').toString()) {
      return {
        success: true,
        accessToken: this.generateMockJWT(),
        refreshToken: this.generateMockJWT('refresh'),
        expiresIn: 3600, // 1 hour
        user: {
          id: '1',
          username: 'demo',
          email: 'demo@example.com',
          role: 'user' as const,
          lastLogin: new Date().toISOString(),
          preferences: {
            theme: 'dark' as const,
            notifications: true,
            autoConnect: true
          }
        }
      };
    }

    return {
      success: false,
      error: 'Invalid username or password'
    };
  }

  private mockRegister(data: any): any {
    // Mock successful registration
    return {
      success: true,
      user: {
        id: Date.now().toString(),
        username: data.username,
        email: data.email,
        role: 'user' as const,
        preferences: {
          theme: 'dark' as const,
          notifications: true,
          autoConnect: false
        }
      }
    };
  }

  private mockRefresh(data: any): any {
    // Mock successful token refresh
    return {
      success: true,
      accessToken: this.generateMockJWT(),
      expiresIn: 3600
    };
  }

  private mockChangePassword(data: any): any {
    return { success: true };
  }

  private mockUpdateProfile(data: any): any {
    return {
      success: true,
      user: data
    };
  }

  private generateMockJWT(type: 'access' | 'refresh' = 'access'): string {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({
      sub: this.user?.id || '1',
      type,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (type === 'access' ? 3600 : 86400)
    }));
    const signature = btoa('mock-signature');
    
    return `${header}.${payload}.${signature}`;
  }

  private isTokenValid(): boolean {
    if (!this.tokens) return false;
    return Date.now() < this.tokens.expiresAt - 300000; // 5 minute buffer
  }

  private setupTokenRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    if (!this.tokens) return;

    // Schedule refresh 5 minutes before expiration
    const refreshTime = this.tokens.expiresAt - Date.now() - 300000;
    
    if (refreshTime > 0) {
      this.refreshTimer = setTimeout(async () => {
        await this.refreshAccessToken();
      }, refreshTime);
    }
  }

  private async persistAuthState(): Promise<void> {
    try {
      if (!this.user || !this.tokens) return;

      // Encrypt sensitive data
      const encryptedTokens = CryptoJS.AES.encrypt(
        JSON.stringify(this.tokens),
        this.encryptionKey
      ).toString();

      // Store user data in AsyncStorage
      await AsyncStorage.setItem('user', JSON.stringify(this.user));

      // Store encrypted tokens in Keychain (more secure)
      await Keychain.setInternetCredentials(
        'nexus_terminal_auth',
        'tokens',
        encryptedTokens
      );

    } catch (error) {
      console.error('Failed to persist auth state:', error);
    }
  }

  private async restoreAuthState(): Promise<void> {
    try {
      // Restore user data
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        this.user = JSON.parse(userData);
      }

      // Restore tokens from Keychain
      const credentials = await Keychain.getInternetCredentials('nexus_terminal_auth');
      if (credentials && credentials.password) {
        try {
          const decryptedTokens = CryptoJS.AES.decrypt(
            credentials.password,
            this.encryptionKey
          ).toString(CryptoJS.enc.Utf8);
          
          this.tokens = JSON.parse(decryptedTokens);

          // Check if tokens are still valid
          if (!this.isTokenValid()) {
            // Try to refresh
            const refreshed = await this.refreshAccessToken();
            if (!refreshed) {
              await this.clearAuthState();
              return;
            }
          } else {
            // Setup refresh for valid tokens
            this.setupTokenRefresh();
          }

          // Notify listeners
          this.notifyAuthChange();
        } catch (decryptionError) {
          console.error('Token decryption failed:', decryptionError);
          await this.clearAuthState();
        }
      }
    } catch (error) {
      console.error('Failed to restore auth state:', error);
    }
  }

  private async clearAuthState(): Promise<void> {
    // Clear timers
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    // Clear memory
    this.user = null;
    this.tokens = null;

    // Clear storage
    try {
      await AsyncStorage.removeItem('user');
      await Keychain.resetInternetCredentials('nexus_terminal_auth');
    } catch (error) {
      console.error('Failed to clear auth state:', error);
    }

    // Notify listeners
    this.notifyAuthChange();
  }

  private notifyAuthChange(): void {
    this.authCallbacks.forEach(callback => {
      try {
        callback(this.user);
      } catch (error) {
        console.error('Auth callback error:', error);
      }
    });
  }

  dispose(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.authCallbacks = [];
  }
}

export const authService = new AuthService();
