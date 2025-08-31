import { AIInsight, Recommendation, SystemPattern, Prediction } from '@/types';
import { connectionService } from './connectionService';
import { authService } from './authService';

class EcosystemService {
  private async getAuthHeaders() {
    const token = await authService.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async getInsights(): Promise<AIInsight[]> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    const headers = await this.getAuthHeaders();
    const response = await httpClient.get('/api/ecosystem/insights', { headers });
    return response.data;
  }

  async getRecommendations(): Promise<Recommendation[]> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    const headers = await this.getAuthHeaders();
    const response = await httpClient.get('/api/ecosystem/recommendations', { headers });
    return response.data;
  }

  async getPatterns(): Promise<SystemPattern[]> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    const headers = await this.getAuthHeaders();
    const response = await httpClient.get('/api/ecosystem/patterns', { headers });
    return response.data;
  }

  async getPredictions(): Promise<Prediction[]> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    const headers = await this.getAuthHeaders();
    const response = await httpClient.get('/api/ecosystem/predictions', { headers });
    return response.data;
  }

  async generateInsight(type: string, data: object): Promise<AIInsight> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    const headers = await this.getAuthHeaders();
    const response = await httpClient.post('/api/ecosystem/insights/generate', {
      type,
      data,
    }, { headers });
    return response.data;
  }

  async dismissInsight(insightId: string): Promise<void> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    const headers = await this.getAuthHeaders();
    await httpClient.delete(`/api/ecosystem/insights/${insightId}`, { headers });
  }

  async executeRecommendation(recommendationId: string): Promise<void> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    const headers = await this.getAuthHeaders();
    await httpClient.post(`/api/ecosystem/recommendations/${recommendationId}/execute`, {}, { headers });
  }

  async getSystemAnalysis(): Promise<object> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    const headers = await this.getAuthHeaders();
    const response = await httpClient.get('/api/ecosystem/analysis', { headers });
    return response.data;
  }

  async getOptimizationSuggestions(): Promise<object[]> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    const headers = await this.getAuthHeaders();
    const response = await httpClient.get('/api/ecosystem/optimizations', { headers });
    return response.data;
  }

  async getPerformanceTrends(metric: string, timeframe: string): Promise<object[]> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    const headers = await this.getAuthHeaders();
    const response = await httpClient.get('/api/ecosystem/trends', {
      headers,
      params: { metric, timeframe },
    });
    return response.data;
  }

  async runSystemDiagnostics(): Promise<object> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    const headers = await this.getAuthHeaders();
    const response = await httpClient.post('/api/ecosystem/diagnostics', {}, { headers });
    return response.data;
  }

  async getSecurityAudit(): Promise<object> {
    const httpClient = connectionService.getHttpClient();
    if (!httpClient) {
      throw new Error('No active connection');
    }

    const headers = await this.getAuthHeaders();
    const response = await httpClient.get('/api/ecosystem/security-audit', { headers });
    return response.data;
  }

  // WebSocket event handlers for real-time ecosystem updates
  subscribeToInsights(callback: (insight: AIInsight) => void): void {
    const wsClient = connectionService.getWsClient();
    if (!wsClient) {
      throw new Error('No active WebSocket connection');
    }

    wsClient.on('new_insight', callback);
  }

  subscribeToRecommendations(callback: (recommendation: Recommendation) => void): void {
    const wsClient = connectionService.getWsClient();
    if (!wsClient) {
      throw new Error('No active WebSocket connection');
    }

    wsClient.on('new_recommendation', callback);
  }

  subscribeToPatterns(callback: (pattern: SystemPattern) => void): void {
    const wsClient = connectionService.getWsClient();
    if (!wsClient) {
      throw new Error('No active WebSocket connection');
    }

    wsClient.on('pattern_detected', callback);
  }

  unsubscribeFromEcosystemEvents(): void {
    const wsClient = connectionService.getWsClient();
    if (!wsClient) return;

    wsClient.off('new_insight');
    wsClient.off('new_recommendation');
    wsClient.off('pattern_detected');
  }

  // Utility methods for local processing
  analyzeLocalData(data: object[]): AIInsight[] {
    // Placeholder for local AI analysis
    // In a real implementation, this would use TensorFlow.js or similar
    return [];
  }

  calculateTrend(dataPoints: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (dataPoints.length < 2) return 'stable';
    
    const first = dataPoints[0];
    const last = dataPoints[dataPoints.length - 1];
    const threshold = 0.05; // 5% threshold
    
    const change = (last - first) / first;
    
    if (change > threshold) return 'increasing';
    if (change < -threshold) return 'decreasing';
    return 'stable';
  }

  generateInsightId(): string {
    return `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const ecosystemService = new EcosystemService();
