import * as Keychain from 'react-native-keychain';
import CryptoJS from 'crypto-js';
import { AuthConfig } from '@/types';
import { connectionService } from './connectionService';

class AuthService {
  private static readonly TOKEN_KEY = 'nexus_terminal_token';
  private static readonly CREDENTIALS_KEY = 'nexus_terminal_credentials';

  async authenticate(config: AuthConfig): Promise<{ token: string; credentials?: object }> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    let response;
    
    switch (config.method) {
      case 'token':
        response = await httpClient.post('/api/auth/token', {
          token: config.token,
        });
        break;
        
      case 'password':
        response = await httpClient.post('/api/auth/login', {
          username: config.username,
          password: config.password,
        });
        break;
        
      case 'certificate':
        response = await httpClient.post('/api/auth/certificate', {
          certificate: config.certificate,
          privateKey: config.privateKey,
        });
        break;
        
      default:
        throw new Error('Unsupported authentication method');
    }

    const { token, user } = response.data;
    
    // Store token securely
    await this.storeToken(token);
    
    // Store credentials if provided
    if (config.method === 'password' && config.username && config.password) {
      await this.storeCredentials({
        username: config.username,
        password: config.password,
      });
    }

    return { token, credentials: user };
  }

  async refreshToken(): Promise<{ token: string }> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    const currentToken = await this.getToken();
    if (!currentToken) {
      throw new Error('No token to refresh');
    }

    const response = await httpClient.post('/api/auth/refresh', {
      token: currentToken,
    });

    const { token } = response.data;
    await this.storeToken(token);
    
    return { token };
  }

  async logout(): Promise<void> {
    const httpClient = connectionService.getHttpClient();
    const token = await this.getToken();

    if (httpClient && token) {
      try {
        await httpClient.post('/api/auth/logout', { token });
      } catch (error) {
        console.warn('Logout request failed, clearing local data anyway');
      }
    }

    await this.clearStoredData();
  }

  async storeToken(token: string): Promise<void> {
    await Keychain.setInternetCredentials(
      AuthService.TOKEN_KEY,
      'token',
      token
    );
  }

  async getToken(): Promise<string | null> {
    try {
      const credentials = await Keychain.getInternetCredentials(AuthService.TOKEN_KEY);
      return credentials ? credentials.password : null;
    } catch (error) {
      return null;
    }
  }

  async storeCredentials(credentials: object): Promise<void> {
    const encrypted = CryptoJS.AES.encrypt(
      JSON.stringify(credentials),
      AuthService.CREDENTIALS_KEY
    ).toString();
    
    await Keychain.setInternetCredentials(
      AuthService.CREDENTIALS_KEY,
      'credentials',
      encrypted
    );
  }

  async getCredentials(): Promise<object | null> {
    try {
      const stored = await Keychain.getInternetCredentials(AuthService.CREDENTIALS_KEY);
      if (!stored) return null;

      const decrypted = CryptoJS.AES.decrypt(stored.password, AuthService.CREDENTIALS_KEY);
      return JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
    } catch (error) {
      return null;
    }
  }

  async clearStoredData(): Promise<void> {
    try {
      await Keychain.resetInternetCredentials(AuthService.TOKEN_KEY);
      await Keychain.resetInternetCredentials(AuthService.CREDENTIALS_KEY);
    } catch (error) {
      console.warn('Failed to clear stored auth data:', error);
    }
  }

  generateSecureToken(length: number = 32): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return result;
  }
}

export const authService = new AuthService();
