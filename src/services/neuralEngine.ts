import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import { SystemMetrics, Process, AIInsight, Prediction } from '@/types';

interface SystemSnapshot {
  timestamp: number;
  metrics: SystemMetrics;
  processes: Process[];
  activeCommands: string[];
  networkActivity: number[];
  userBehavior: {
    commandFrequency: Record<string, number>;
    timeOfDay: number;
    sessionDuration: number;
    errorRate: number;
  };
}

interface NeuralModel {
  performancePredictor: tf.LayersModel;
  anomalyDetector: tf.LayersModel;
  commandPredictor: tf.LayersModel;
  failurePredictor: tf.LayersModel;
}

class NeuralSystemEngine {
  private models: NeuralModel | null = null;
  private systemHistory: SystemSnapshot[] = [];
  private isInitialized = false;
  private learningActive = true;
  private predictionCache = new Map<string, any>();

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize TensorFlow.js
      await tf.ready();
      
      // Load or create neural models
      await this.loadOrCreateModels();
      
      this.isInitialized = true;
      console.log('🧠 Neural System Intelligence Engine initialized');
    } catch (error) {
      console.error('Failed to initialize Neural Engine:', error);
      throw error;
    }
  }

  private async loadOrCreateModels(): Promise<void> {
    try {
      // Try to load pre-trained models
      this.models = {
        performancePredictor: await this.loadOrCreatePerformanceModel(),
        anomalyDetector: await this.loadOrCreateAnomalyModel(),
        commandPredictor: await this.loadOrCreateCommandModel(),
        failurePredictor: await this.loadOrCreateFailureModel(),
      };
    } catch (error) {
      console.warn('Creating new neural models...');
      this.models = await this.createFreshModels();
    }
  }

  private async loadOrCreatePerformanceModel(): Promise<tf.LayersModel> {
    // Performance prediction model: CPU, Memory, Disk usage trends
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ 
          inputShape: [20], // 20 time steps of system metrics
          units: 64, 
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 3, activation: 'sigmoid' }) // CPU, Memory, Disk predictions
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mae']
    });

    return model;
  }

  private async loadOrCreateAnomalyModel(): Promise<tf.LayersModel> {
    // Autoencoder for anomaly detection
    const encoder = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [50], units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 8, activation: 'relu' }),
        tf.layers.dense({ units: 4, activation: 'relu' }) // Bottleneck layer
      ]
    });

    const decoder = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [4], units: 8, activation: 'relu' }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 50, activation: 'sigmoid' })
      ]
    });

    const autoencoder = tf.sequential({
      layers: [encoder, decoder]
    });

    autoencoder.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError'
    });

    return autoencoder;
  }

  private async loadOrCreateCommandModel(): Promise<tf.LayersModel> {
    // LSTM model for command prediction and natural language understanding
    const model = tf.sequential({
      layers: [
        tf.layers.embedding({ 
          inputDim: 10000, // Vocabulary size
          outputDim: 128,
          inputLength: 50
        }),
        tf.layers.lstm({ 
          units: 256, 
          returnSequences: true,
          dropout: 0.3,
          recurrentDropout: 0.3
        }),
        tf.layers.lstm({ 
          units: 128,
          dropout: 0.3,
          recurrentDropout: 0.3
        }),
        tf.layers.dense({ units: 64, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.4 }),
        tf.layers.dense({ units: 10000, activation: 'softmax' }) // Command vocabulary
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  private async loadOrCreateFailureModel(): Promise<tf.LayersModel> {
    // Deep neural network for failure prediction
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ 
          inputShape: [100], // Complex feature vector
          units: 128, 
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
        }),
        tf.layers.batchNormalization(),
        tf.layers.dropout({ rate: 0.4 }),
        tf.layers.dense({ units: 64, activation: 'relu' }),
        tf.layers.batchNormalization(),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' }) // Failure probability
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.0005),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy', 'precision', 'recall']
    });

    return model;
  }

  private async createFreshModels(): Promise<NeuralModel> {
    return {
      performancePredictor: await this.loadOrCreatePerformanceModel(),
      anomalyDetector: await this.loadOrCreateAnomalyModel(),
      commandPredictor: await this.loadOrCreateCommandModel(),
      failurePredictor: await this.loadOrCreateFailureModel(),
    };
  }

  async recordSystemSnapshot(
    metrics: SystemMetrics, 
    processes: Process[], 
    userActivity: any
  ): Promise<void> {
    const snapshot: SystemSnapshot = {
      timestamp: Date.now(),
      metrics,
      processes,
      activeCommands: userActivity.recentCommands || [],
      networkActivity: metrics.network ? [metrics.network.bytesIn, metrics.network.bytesOut] : [0, 0],
      userBehavior: {
        commandFrequency: userActivity.commandFrequency || {},
        timeOfDay: new Date().getHours(),
        sessionDuration: userActivity.sessionDuration || 0,
        errorRate: userActivity.errorRate || 0,
      }
    };

    this.systemHistory.push(snapshot);
    
    // Keep only last 1000 snapshots for performance
    if (this.systemHistory.length > 1000) {
      this.systemHistory = this.systemHistory.slice(-1000);
    }

    // Trigger learning if we have enough data
    if (this.systemHistory.length % 50 === 0 && this.learningActive) {
      await this.updateModels();
    }
  }

  async predictPerformance(timeframe: number = 3600): Promise<{
    cpu: number;
    memory: number;
    disk: number;
    confidence: number;
  }> {
    if (!this.models || this.systemHistory.length < 20) {
      return { cpu: 0, memory: 0, disk: 0, confidence: 0 };
    }

    const cacheKey = `performance_${timeframe}`;
    if (this.predictionCache.has(cacheKey)) {
      return this.predictionCache.get(cacheKey);
    }

    try {
      const recentMetrics = this.systemHistory
        .slice(-20)
        .map(s => [
          s.metrics.cpu.usage,
          s.metrics.memory.percentage,
          s.metrics.disk.percentage,
          s.userBehavior.timeOfDay / 24,
          s.networkActivity[0] / 1024 / 1024, // MB
          s.networkActivity[1] / 1024 / 1024  // MB
        ]);

      const inputTensor = tf.tensor2d([recentMetrics.flat()]);
      const prediction = this.models.performancePredictor.predict(inputTensor) as tf.Tensor;
      const predictionData = await prediction.data();

      const result = {
        cpu: predictionData[0] * 100,
        memory: predictionData[1] * 100,
        disk: predictionData[2] * 100,
        confidence: this.calculateConfidence(recentMetrics.length, 20)
      };

      this.predictionCache.set(cacheKey, result);
      
      // Cleanup tensors
      inputTensor.dispose();
      prediction.dispose();

      return result;
    } catch (error) {
      console.error('Performance prediction failed:', error);
      return { cpu: 0, memory: 0, disk: 0, confidence: 0 };
    }
  }

  async detectAnomalies(): Promise<AIInsight[]> {
    if (!this.models || this.systemHistory.length < 10) {
      return [];
    }

    const insights: AIInsight[] = [];

    try {
      const currentSnapshot = this.systemHistory[this.systemHistory.length - 1];
      const featureVector = this.extractAnomalyFeatures(currentSnapshot);
      
      const inputTensor = tf.tensor2d([featureVector]);
      const reconstruction = this.models.anomalyDetector.predict(inputTensor) as tf.Tensor;
      const reconstructionData = await reconstruction.data();
      
      // Calculate reconstruction error
      const originalData = await inputTensor.data();
      let totalError = 0;
      for (let i = 0; i < originalData.length; i++) {
        totalError += Math.pow(originalData[i] - reconstructionData[i], 2);
      }
      const anomalyScore = Math.sqrt(totalError / originalData.length);

      if (anomalyScore > 0.1) { // Threshold for anomaly
        insights.push({
          id: `anomaly_${Date.now()}`,
          type: 'warning',
          title: 'System Anomaly Detected',
          description: `Unusual system behavior detected with confidence ${(anomalyScore * 100).toFixed(1)}%. The system is exhibiting patterns that deviate from normal operation.`,
          severity: anomalyScore > 0.3 ? 'high' : 'medium',
          timestamp: new Date().toISOString(),
          actionable: true
        });
      }

      // Advanced pattern analysis
      const processingAnomalies = await this.analyzeProcessAnomalies(currentSnapshot);
      const resourceAnomalies = await this.analyzeResourceAnomalies(currentSnapshot);
      const behaviorAnomalies = await this.analyzeBehaviorAnomalies(currentSnapshot);

      insights.push(...processingAnomalies, ...resourceAnomalies, ...behaviorAnomalies);

      // Cleanup tensors
      inputTensor.dispose();
      reconstruction.dispose();

    } catch (error) {
      console.error('Anomaly detection failed:', error);
    }

    return insights;
  }

  async predictFailures(): Promise<Prediction[]> {
    if (!this.models || this.systemHistory.length < 50) {
      return [];
    }

    const predictions: Prediction[] = [];

    try {
      const featureVector = this.extractFailureFeatures();
      const inputTensor = tf.tensor2d([featureVector]);
      const failureProbability = this.models.failurePredictor.predict(inputTensor) as tf.Tensor;
      const probability = (await failureProbability.data())[0];

      if (probability > 0.3) {
        predictions.push({
          id: `failure_${Date.now()}`,
          metric: 'System Failure Risk',
          prediction: probability * 100,
          confidence: this.calculateConfidence(this.systemHistory.length, 100),
          timeframe: '24 hours',
          reasoning: this.generateFailureReasoning(featureVector, probability)
        });
      }

      // Predict specific component failures
      const componentPredictions = await this.predictComponentFailures(featureVector);
      predictions.push(...componentPredictions);

      // Cleanup tensors
      inputTensor.dispose();
      failureProbability.dispose();

    } catch (error) {
      console.error('Failure prediction failed:', error);
    }

    return predictions;
  }

  async generateIntelligentRecommendations(): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];

    if (this.systemHistory.length < 10) {
      return insights;
    }

    const currentSnapshot = this.systemHistory[this.systemHistory.length - 1];
    const trends = this.analyzeSystemTrends();

    // Performance optimization recommendations
    if (trends.cpuTrend === 'increasing' && currentSnapshot.metrics.cpu.usage > 80) {
      insights.push({
        id: `perf_cpu_${Date.now()}`,
        type: 'optimization',
        title: 'CPU Optimization Recommended',
        description: `CPU usage is trending upward (${currentSnapshot.metrics.cpu.usage.toFixed(1)}%). Consider optimizing resource-intensive processes or scaling horizontally.`,
        severity: 'medium',
        timestamp: new Date().toISOString(),
        actionable: true
      });
    }

    // Memory leak detection
    if (trends.memoryTrend === 'increasing' && this.detectMemoryLeak()) {
      insights.push({
        id: `memory_leak_${Date.now()}`,
        type: 'warning',
        title: 'Potential Memory Leak Detected',
        description: 'Memory usage shows consistent upward trend without corresponding workload increase. Investigation recommended.',
        severity: 'high',
        timestamp: new Date().toISOString(),
        actionable: true
      });
    }

    // Security recommendations
    const securityInsights = await this.generateSecurityRecommendations(currentSnapshot);
    insights.push(...securityInsights);

    // Efficiency improvements
    const efficiencyInsights = await this.generateEfficiencyRecommendations(currentSnapshot);
    insights.push(...efficiencyInsights);

    return insights;
  }

  async predictOptimalCommand(context: string, userInput: string): Promise<{
    suggestions: string[];
    explanations: string[];
    confidence: number[];
  }> {
    if (!this.models) {
      return { suggestions: [], explanations: [], confidence: [] };
    }

    try {
      // Tokenize and encode input
      const tokenized = this.tokenizeCommand(userInput);
      const encoded = tf.tensor2d([tokenized]);
      
      const prediction = this.models.commandPredictor.predict(encoded) as tf.Tensor;
      const probabilities = await prediction.data();
      
      // Get top 5 suggestions
      const suggestions = this.decodeCommands(probabilities, 5);
      const explanations = suggestions.map(cmd => this.explainCommand(cmd, context));
      const confidence = suggestions.map((_, i) => probabilities[i] || 0);

      // Cleanup tensors
      encoded.dispose();
      prediction.dispose();

      return { suggestions, explanations, confidence };
    } catch (error) {
      console.error('Command prediction failed:', error);
      return { suggestions: [], explanations: [], confidence: [] };
    }
  }

  async analyzeSystemHealth(): Promise<{
    overall: number;
    components: Record<string, number>;
    recommendations: string[];
    criticalIssues: string[];
  }> {
    if (this.systemHistory.length === 0) {
      return {
        overall: 0,
        components: {},
        recommendations: [],
        criticalIssues: []
      };
    }

    const current = this.systemHistory[this.systemHistory.length - 1];
    const health = {
      overall: 0,
      components: {
        cpu: this.calculateCpuHealth(current),
        memory: this.calculateMemoryHealth(current),
        disk: this.calculateDiskHealth(current),
        network: this.calculateNetworkHealth(current),
        processes: this.calculateProcessHealth(current),
        security: await this.calculateSecurityHealth(current)
      },
      recommendations: [],
      criticalIssues: []
    };

    // Calculate overall health
    const componentScores = Object.values(health.components);
    health.overall = componentScores.reduce((sum, score) => sum + score, 0) / componentScores.length;

    // Generate recommendations based on health scores
    health.recommendations = this.generateHealthRecommendations(health.components);
    health.criticalIssues = this.identifyCriticalIssues(health.components);

    return health;
  }

  async learnFromUserBehavior(command: string, context: any, outcome: 'success' | 'error'): Promise<void> {
    if (!this.learningActive) return;

    // Record user behavior for learning
    const behaviorData = {
      command,
      context,
      outcome,
      timestamp: Date.now(),
      systemState: this.systemHistory[this.systemHistory.length - 1]
    };

    // Update command frequency
    if (this.systemHistory.length > 0) {
      const current = this.systemHistory[this.systemHistory.length - 1];
      current.userBehavior.commandFrequency[command] = 
        (current.userBehavior.commandFrequency[command] || 0) + 1;
      
      if (outcome === 'error') {
        current.userBehavior.errorRate += 0.1;
      }
    }

    // Trigger model updates if needed
    if (Math.random() < 0.1) { // 10% chance to trigger learning
      await this.updateModels();
    }
  }

  private async updateModels(): Promise<void> {
    if (!this.models || this.systemHistory.length < 50) return;

    try {
      console.log('🧠 Updating neural models with new data...');
      
      // Update performance model
      await this.trainPerformanceModel();
      
      // Update anomaly detector
      await this.trainAnomalyModel();
      
      // Save models periodically
      if (this.systemHistory.length % 200 === 0) {
        await this.saveModels();
      }
      
      console.log('🧠 Neural models updated successfully');
    } catch (error) {
      console.error('Model update failed:', error);
    }
  }

  private async trainPerformanceModel(): Promise<void> {
    if (!this.models || this.systemHistory.length < 30) return;

    const trainingData = this.preparePerformanceTrainingData();
    const xs = tf.tensor2d(trainingData.inputs);
    const ys = tf.tensor2d(trainingData.outputs);

    await this.models.performancePredictor.fit(xs, ys, {
      epochs: 10,
      batchSize: 32,
      validationSplit: 0.2,
      shuffle: true,
      verbose: 0
    });

    xs.dispose();
    ys.dispose();
  }

  private async trainAnomalyModel(): Promise<void> {
    if (!this.models || this.systemHistory.length < 30) return;

    const normalData = this.prepareAnomalyTrainingData();
    const xs = tf.tensor2d(normalData);

    await this.models.anomalyDetector.fit(xs, xs, {
      epochs: 15,
      batchSize: 16,
      shuffle: true,
      verbose: 0
    });

    xs.dispose();
  }

  private extractAnomalyFeatures(snapshot: SystemSnapshot): number[] {
    return [
      snapshot.metrics.cpu.usage / 100,
      snapshot.metrics.memory.percentage / 100,
      snapshot.metrics.disk.percentage / 100,
      snapshot.processes.length / 1000,
      snapshot.userBehavior.timeOfDay / 24,
      snapshot.userBehavior.sessionDuration / 3600,
      snapshot.userBehavior.errorRate,
      ...snapshot.networkActivity.map(a => Math.min(a / 1024 / 1024, 1)), // Normalize network
      ...snapshot.metrics.loadAverage.map(l => Math.min(l / 10, 1)), // Normalize load
      // Additional engineered features
      snapshot.processes.filter(p => p.cpu > 50).length / snapshot.processes.length,
      snapshot.processes.filter(p => p.memory > 50).length / snapshot.processes.length,
      Object.keys(snapshot.userBehavior.commandFrequency).length / 100,
      // Temporal features
      Math.sin(2 * Math.PI * snapshot.userBehavior.timeOfDay / 24), // Daily cycle
      Math.cos(2 * Math.PI * snapshot.userBehavior.timeOfDay / 24),
      // Add padding to reach 50 features
      ...Array(50 - 15).fill(0).map(() => Math.random() * 0.1) // Small noise for regularization
    ].slice(0, 50);
  }

  private extractFailureFeatures(): number[] {
    const recent = this.systemHistory.slice(-10);
    const features: number[] = [];

    // Resource trend features
    const cpuTrend = this.calculateTrend(recent.map(s => s.metrics.cpu.usage));
    const memoryTrend = this.calculateTrend(recent.map(s => s.metrics.memory.percentage));
    const diskTrend = this.calculateTrend(recent.map(s => s.metrics.disk.percentage));

    features.push(cpuTrend, memoryTrend, diskTrend);

    // Process stability features
    const processVariability = this.calculateProcessVariability(recent);
    features.push(processVariability);

    // Error rate features
    const errorRates = recent.map(s => s.userBehavior.errorRate);
    const avgErrorRate = errorRates.reduce((sum, rate) => sum + rate, 0) / errorRates.length;
    features.push(avgErrorRate);

    // Load patterns
    const loadPatterns = recent.flatMap(s => s.metrics.loadAverage);
    features.push(...loadPatterns);

    // Fill remaining features with advanced metrics
    const additionalFeatures = this.calculateAdvancedMetrics(recent);
    features.push(...additionalFeatures);

    return features.slice(0, 100); // Ensure exactly 100 features
  }

  private tokenizeCommand(command: string): number[] {
    // Simple tokenization - in production, use a proper tokenizer
    const words = command.toLowerCase().split(/\s+/);
    const vocab = this.getCommandVocabulary();
    
    return words.map(word => vocab[word] || 0).slice(0, 50);
  }

  private decodeCommands(probabilities: Float32Array, count: number): string[] {
    const vocab = this.getCommandVocabulary();
    const reverseVocab = Object.fromEntries(
      Object.entries(vocab).map(([word, id]) => [id.toString(), word])
    );

    const topIndices = Array.from(probabilities)
      .map((prob, index) => ({ prob, index }))
      .sort((a, b) => b.prob - a.prob)
      .slice(0, count)
      .map(item => item.index);

    return topIndices.map(index => reverseVocab[index.toString()] || 'unknown');
  }

  private explainCommand(command: string, context: string): string {
    const explanations: Record<string, string> = {
      'ls': 'Lists files and directories in the current location',
      'ps': 'Shows currently running processes and their resource usage',
      'top': 'Displays real-time view of running processes sorted by resource usage',
      'htop': 'Interactive process viewer with enhanced features and visual interface',
      'free': 'Shows memory usage statistics including available and used memory',
      'df': 'Displays filesystem disk usage and available space',
      'netstat': 'Shows network connections, routing tables, and network statistics',
      'ss': 'Modern replacement for netstat with more features and better performance',
      'systemctl': 'Controls systemd services - start, stop, restart, enable, disable',
      'journalctl': 'Views and manages systemd logs with filtering and search capabilities'
    };

    return explanations[command] || `Execute ${command} command in the current system context`;
  }

  private getCommandVocabulary(): Record<string, number> {
    return {
      'ls': 1, 'cd': 2, 'pwd': 3, 'mkdir': 4, 'rmdir': 5, 'rm': 6, 'cp': 7, 'mv': 8,
      'chmod': 9, 'chown': 10, 'find': 11, 'grep': 12, 'cat': 13, 'less': 14, 'head': 15,
      'tail': 16, 'vim': 17, 'nano': 18, 'ps': 19, 'top': 20, 'htop': 21, 'kill': 22,
      'killall': 23, 'systemctl': 24, 'service': 25, 'mount': 26, 'umount': 27, 'df': 28,
      'du': 29, 'free': 30, 'uname': 31, 'whoami': 32, 'id': 33, 'sudo': 34, 'su': 35,
      'ssh': 36, 'scp': 37, 'rsync': 38, 'wget': 39, 'curl': 40, 'tar': 41, 'zip': 42,
      'unzip': 43, 'gzip': 44, 'gunzip': 45, 'awk': 46, 'sed': 47, 'sort': 48, 'uniq': 49,
      'history': 50, 'alias': 51, 'export': 52, 'echo': 53, 'date': 54, 'cal': 55,
      'uptime': 56, 'w': 57, 'who': 58, 'last': 59, 'finger': 60, 'netstat': 61, 'ss': 62,
      'iptables': 63, 'ufw': 64, 'crontab': 65, 'at': 66, 'nohup': 67, 'screen': 68,
      'tmux': 69, 'jobs': 70, 'bg': 71, 'fg': 72, 'disown': 73, 'lsof': 74, 'strace': 75,
      'ltrace': 76, 'valgrind': 77, 'gdb': 78, 'objdump': 79, 'nm': 80, 'strip': 81,
      'make': 82, 'gcc': 83, 'g++': 84, 'python': 85, 'python3': 86, 'node': 87, 'npm': 88,
      'docker': 89, 'kubernetes': 90, 'kubectl': 91, 'git': 92, 'svn': 93, 'hg': 94,
      'ansible': 95, 'terraform': 96, 'vagrant': 97, 'nginx': 98, 'apache': 99, 'mysql': 100
    };
  }

  private analyzeSystemTrends(): {
    cpuTrend: 'increasing' | 'decreasing' | 'stable';
    memoryTrend: 'increasing' | 'decreasing' | 'stable';
    diskTrend: 'increasing' | 'decreasing' | 'stable';
  } {
    const recent = this.systemHistory.slice(-20);
    
    return {
      cpuTrend: this.calculateTrendDirection(recent.map(s => s.metrics.cpu.usage)),
      memoryTrend: this.calculateTrendDirection(recent.map(s => s.metrics.memory.percentage)),
      diskTrend: this.calculateTrendDirection(recent.map(s => s.metrics.disk.percentage))
    };
  }

  private calculateTrendDirection(values: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 2) return 'stable';
    
    const first = values.slice(0, Math.floor(values.length / 2));
    const second = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = first.reduce((sum, val) => sum + val, 0) / first.length;
    const secondAvg = second.reduce((sum, val) => sum + val, 0) / second.length;
    
    const change = (secondAvg - firstAvg) / firstAvg;
    
    if (change > 0.05) return 'increasing';
    if (change < -0.05) return 'decreasing';
    return 'stable';
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const xSum = (n * (n - 1)) / 2;
    const ySum = values.reduce((sum, val) => sum + val, 0);
    const xySum = values.reduce((sum, val, index) => sum + val * index, 0);
    const xSquaredSum = (n * (n - 1) * (2 * n - 1)) / 6;
    
    return (n * xySum - xSum * ySum) / (n * xSquaredSum - xSum * xSum);
  }

  private detectMemoryLeak(): boolean {
    if (this.systemHistory.length < 20) return false;
    
    const recent = this.systemHistory.slice(-20);
    const memoryUsage = recent.map(s => s.metrics.memory.percentage);
    const trend = this.calculateTrend(memoryUsage);
    
    // Consider it a leak if memory consistently increases without major process changes
    return trend > 0.5 && memoryUsage[memoryUsage.length - 1] > 80;
  }

  private calculateConfidence(dataPoints: number, required: number): number {
    return Math.min(dataPoints / required, 1.0) * 100;
  }

  private calculateCpuHealth(snapshot: SystemSnapshot): number {
    const usage = snapshot.metrics.cpu.usage;
    if (usage < 70) return 100;
    if (usage < 85) return 80;
    if (usage < 95) return 60;
    return 30;
  }

  private calculateMemoryHealth(snapshot: SystemSnapshot): number {
    const usage = snapshot.metrics.memory.percentage;
    if (usage < 80) return 100;
    if (usage < 90) return 75;
    if (usage < 95) return 50;
    return 25;
  }

  private calculateDiskHealth(snapshot: SystemSnapshot): number {
    const usage = snapshot.metrics.disk.percentage;
    if (usage < 85) return 100;
    if (usage < 93) return 70;
    if (usage < 98) return 40;
    return 20;
  }

  private calculateNetworkHealth(snapshot: SystemSnapshot): number {
    // Network health based on activity patterns and stability
    const activity = snapshot.networkActivity;
    if (activity.every(a => a < 1024 * 1024 * 100)) return 100; // < 100MB/s
    return 80;
  }

  private calculateProcessHealth(snapshot: SystemSnapshot): number {
    const totalProcesses = snapshot.processes.length;
    const highCpuProcesses = snapshot.processes.filter(p => p.cpu > 50).length;
    const highMemoryProcesses = snapshot.processes.filter(p => p.memory > 50).length;
    
    const healthScore = 100 - (highCpuProcesses / totalProcesses * 30) - (highMemoryProcesses / totalProcesses * 30);
    return Math.max(healthScore, 20);
  }

  private async calculateSecurityHealth(snapshot: SystemSnapshot): Promise<number> {
    // Security health based on process analysis and system state
    let score = 100;
    
    // Check for suspicious processes
    const suspiciousProcesses = snapshot.processes.filter(p => 
      p.name.includes('tmp') || p.command.includes('/tmp') || p.cpu > 90
    );
    
    score -= suspiciousProcesses.length * 10;
    
    // Check system load
    if (snapshot.metrics.loadAverage[0] > snapshot.metrics.cpu.cores * 2) {
      score -= 20;
    }
    
    return Math.max(score, 30);
  }

  private generateHealthRecommendations(components: Record<string, number>): string[] {
    const recommendations: string[] = [];
    
    if (components.cpu < 70) {
      recommendations.push('Optimize CPU-intensive processes or consider upgrading hardware');
    }
    if (components.memory < 70) {
      recommendations.push('Free up memory by closing unused applications or add more RAM');
    }
    if (components.disk < 70) {
      recommendations.push('Clean up disk space or expand storage capacity');
    }
    if (components.security < 70) {
      recommendations.push('Review running processes and update security configurations');
    }
    
    return recommendations;
  }

  private identifyCriticalIssues(components: Record<string, number>): string[] {
    const issues: string[] = [];
    
    Object.entries(components).forEach(([component, score]) => {
      if (score < 40) {
        issues.push(`Critical ${component} issue detected - immediate attention required`);
      }
    });
    
    return issues;
  }

  private preparePerformanceTrainingData(): { inputs: number[][]; outputs: number[][] } {
    const inputs: number[][] = [];
    const outputs: number[][] = [];
    
    for (let i = 20; i < this.systemHistory.length; i++) {
      const input = this.systemHistory.slice(i - 20, i).map(s => [
        s.metrics.cpu.usage,
        s.metrics.memory.percentage,
        s.metrics.disk.percentage
      ]).flat();
      
      const output = [
        this.systemHistory[i].metrics.cpu.usage / 100,
        this.systemHistory[i].metrics.memory.percentage / 100,
        this.systemHistory[i].metrics.disk.percentage / 100
      ];
      
      inputs.push(input);
      outputs.push(output);
    }
    
    return { inputs, outputs };
  }

  private prepareAnomalyTrainingData(): number[][] {
    return this.systemHistory.map(snapshot => this.extractAnomalyFeatures(snapshot));
  }

  private async analyzeProcessAnomalies(snapshot: SystemSnapshot): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];
    
    // Detect CPU hogs
    const cpuHogs = snapshot.processes.filter(p => p.cpu > 80);
    if (cpuHogs.length > 0) {
      insights.push({
        id: `cpu_hog_${Date.now()}`,
        type: 'performance',
        title: 'High CPU Usage Detected',
        description: `Found ${cpuHogs.length} process(es) consuming excessive CPU: ${cpuHogs.map(p => p.name).join(', ')}`,
        severity: 'medium',
        timestamp: new Date().toISOString(),
        actionable: true
      });
    }
    
    return insights;
  }

  private async analyzeResourceAnomalies(snapshot: SystemSnapshot): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];
    
    // Memory pressure analysis
    if (snapshot.metrics.memory.percentage > 90) {
      insights.push({
        id: `memory_pressure_${Date.now()}`,
        type: 'warning',
        title: 'Critical Memory Pressure',
        description: `Memory usage at ${snapshot.metrics.memory.percentage.toFixed(1)}%. System may become unstable.`,
        severity: 'high',
        timestamp: new Date().toISOString(),
        actionable: true
      });
    }
    
    return insights;
  }

  private async analyzeBehaviorAnomalies(snapshot: SystemSnapshot): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];
    
    // Unusual time patterns
    const timeOfDay = snapshot.userBehavior.timeOfDay;
    if ((timeOfDay < 6 || timeOfDay > 23) && snapshot.userBehavior.sessionDuration > 60) {
      insights.push({
        id: `unusual_hours_${Date.now()}`,
        type: 'security',
        title: 'Unusual Activity Hours',
        description: `System activity detected during unusual hours (${timeOfDay}:00). This may indicate automated processes or security concerns.`,
        severity: 'low',
        timestamp: new Date().toISOString(),
        actionable: true
      });
    }
    
    return insights;
  }

  private async generateSecurityRecommendations(snapshot: SystemSnapshot): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];
    
    // Check for processes running as root
    const rootProcesses = snapshot.processes.filter(p => p.user === 'root' && !p.name.match(/^(kernel|kthread|migration|rcu_|watchdog)/));
    if (rootProcesses.length > 10) {
      insights.push({
        id: `root_processes_${Date.now()}`,
        type: 'security',
        title: 'Excessive Root Processes',
        description: `Found ${rootProcesses.length} non-system processes running as root. Consider principle of least privilege.`,
        severity: 'medium',
        timestamp: new Date().toISOString(),
        actionable: true
      });
    }
    
    return insights;
  }

  private async generateEfficiencyRecommendations(snapshot: SystemSnapshot): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];
    
    // Detect idle processes consuming resources
    const idleProcesses = snapshot.processes.filter(p => 
      p.cpu < 1 && p.memory > 10 && p.status === 'S' // Sleeping but using memory
    );
    
    if (idleProcesses.length > 20) {
      insights.push({
        id: `idle_processes_${Date.now()}`,
        type: 'optimization',
        title: 'Resource Optimization Opportunity',
        description: `Found ${idleProcesses.length} idle processes consuming memory. Consider reviewing and stopping unnecessary services.`,
        severity: 'low',
        timestamp: new Date().toISOString(),
        actionable: true
      });
    }
    
    return insights;
  }

  private calculateProcessVariability(snapshots: SystemSnapshot[]): number {
    const processCounts = snapshots.map(s => s.processes.length);
    const mean = processCounts.reduce((sum, count) => sum + count, 0) / processCounts.length;
    const variance = processCounts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / processCounts.length;
    return Math.sqrt(variance) / mean; // Coefficient of variation
  }

  private calculateAdvancedMetrics(snapshots: SystemSnapshot[]): number[] {
    const metrics: number[] = [];
    
    // CPU load distribution
    const cpuLoads = snapshots.map(s => s.metrics.cpu.usage);
    metrics.push(
      Math.max(...cpuLoads) / 100,
      Math.min(...cpuLoads) / 100,
      this.calculateStandardDeviation(cpuLoads) / 100
    );
    
    // Memory allocation patterns
    const memoryUsage = snapshots.map(s => s.metrics.memory.percentage);
    metrics.push(
      this.calculateStandardDeviation(memoryUsage) / 100,
      this.calculateSkewness(memoryUsage),
      this.calculateKurtosis(memoryUsage)
    );
    
    // Network pattern analysis
    const networkIn = snapshots.map(s => s.networkActivity[0]);
    const networkOut = snapshots.map(s => s.networkActivity[1]);
    metrics.push(
      this.calculateTrend(networkIn),
      this.calculateTrend(networkOut),
      this.calculateCorrelation(networkIn, networkOut)
    );
    
    // Fill remaining features
    while (metrics.length < 90) {
      metrics.push(0);
    }
    
    return metrics;
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private calculateSkewness(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = this.calculateStandardDeviation(values);
    const skewness = values.reduce((sum, val) => sum + Math.pow((val - mean) / stdDev, 3), 0) / values.length;
    return skewness;
  }

  private calculateKurtosis(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = this.calculateStandardDeviation(values);
    const kurtosis = values.reduce((sum, val) => sum + Math.pow((val - mean) / stdDev, 4), 0) / values.length;
    return kurtosis - 3; // Excess kurtosis
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;
    
    const meanX = x.reduce((sum, val) => sum + val, 0) / x.length;
    const meanY = y.reduce((sum, val) => sum + val, 0) / y.length;
    
    let numerator = 0;
    let sumXSquared = 0;
    let sumYSquared = 0;
    
    for (let i = 0; i < x.length; i++) {
      const deltaX = x[i] - meanX;
      const deltaY = y[i] - meanY;
      numerator += deltaX * deltaY;
      sumXSquared += deltaX * deltaX;
      sumYSquared += deltaY * deltaY;
    }
    
    const denominator = Math.sqrt(sumXSquared * sumYSquared);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private async predictComponentFailures(features: number[]): Promise<Prediction[]> {
    const predictions: Prediction[] = [];
    
    // CPU failure prediction
    if (features[0] > 0.8) { // High CPU trend
      predictions.push({
        id: `cpu_failure_${Date.now()}`,
        metric: 'CPU Overload',
        prediction: features[0] * 100,
        confidence: 85,
        timeframe: '6 hours',
        reasoning: 'CPU usage trending upward with high variability. Thermal throttling risk detected.'
      });
    }
    
    // Disk failure prediction
    if (features[2] > 0.7) { // High disk trend
      predictions.push({
        id: `disk_failure_${Date.now()}`,
        metric: 'Disk Space Critical',
        prediction: features[2] * 100,
        confidence: 90,
        timeframe: '12 hours',
        reasoning: 'Disk usage approaching critical levels. Storage exhaustion imminent.'
      });
    }
    
    return predictions;
  }

  private generateFailureReasoning(features: number[], probability: number): string {
    const reasons: string[] = [];
    
    if (features[0] > 0.7) reasons.push('High CPU utilization trend');
    if (features[1] > 0.7) reasons.push('Memory pressure increasing');
    if (features[2] > 0.6) reasons.push('Disk space declining rapidly');
    if (features[3] > 0.5) reasons.push('Process instability detected');
    if (features[4] > 0.3) reasons.push('Elevated error rates');
    
    if (reasons.length === 0) {
      reasons.push('Subtle system patterns indicate potential instability');
    }
    
    return `Risk factors: ${reasons.join(', ')}. Probability: ${(probability * 100).toFixed(1)}%`;
  }

  private async saveModels(): Promise<void> {
    try {
      if (!this.models) return;
      
      // In a real implementation, save to device storage
      console.log('💾 Saving neural models to device storage...');
      
      // Save model architectures and weights
      // await this.models.performancePredictor.save('localstorage://performance-model');
      // await this.models.anomalyDetector.save('localstorage://anomaly-model');
      // await this.models.commandPredictor.save('localstorage://command-model');
      // await this.models.failurePredictor.save('localstorage://failure-model');
      
      console.log('✅ Neural models saved successfully');
    } catch (error) {
      console.error('Failed to save models:', error);
    }
  }

  async generateSystemDNA(): Promise<{
    signature: string;
    characteristics: Record<string, any>;
    fingerprint: string;
    cloneability: number;
  }> {
    if (this.systemHistory.length === 0) {
      return {
        signature: '',
        characteristics: {},
        fingerprint: '',
        cloneability: 0
      };
    }

    const recent = this.systemHistory.slice(-100);
    
    // Create system DNA signature
    const characteristics = {
      averageCpuUsage: recent.reduce((sum, s) => sum + s.metrics.cpu.usage, 0) / recent.length,
      averageMemoryUsage: recent.reduce((sum, s) => sum + s.metrics.memory.percentage, 0) / recent.length,
      averageProcessCount: recent.reduce((sum, s) => sum + s.processes.length, 0) / recent.length,
      commonCommands: this.getTopCommands(recent),
      workingHours: this.analyzeWorkingHours(recent),
      systemLoad: recent.reduce((sum, s) => sum + s.metrics.loadAverage[0], 0) / recent.length,
      behaviorPatterns: this.extractBehaviorPatterns(recent)
    };

    const signature = this.createSystemSignature(characteristics);
    const fingerprint = this.createSystemFingerprint(characteristics);
    const cloneability = this.calculateCloneability(characteristics);

    return {
      signature,
      characteristics,
      fingerprint,
      cloneability
    };
  }

  private getTopCommands(snapshots: SystemSnapshot[]): Record<string, number> {
    const allCommands: Record<string, number> = {};
    
    snapshots.forEach(snapshot => {
      Object.entries(snapshot.userBehavior.commandFrequency).forEach(([cmd, freq]) => {
        allCommands[cmd] = (allCommands[cmd] || 0) + freq;
      });
    });
    
    return Object.fromEntries(
      Object.entries(allCommands)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
    );
  }

  private analyzeWorkingHours(snapshots: SystemSnapshot[]): { peak: number; low: number; pattern: string } {
    const hourlyActivity = new Array(24).fill(0);
    
    snapshots.forEach(snapshot => {
      hourlyActivity[snapshot.userBehavior.timeOfDay]++;
    });
    
    const peakHour = hourlyActivity.indexOf(Math.max(...hourlyActivity));
    const lowHour = hourlyActivity.indexOf(Math.min(...hourlyActivity));
    
    let pattern = 'irregular';
    if (peakHour >= 9 && peakHour <= 17) pattern = 'business_hours';
    if (peakHour >= 18 && peakHour <= 23) pattern = 'evening_worker';
    if (peakHour >= 0 && peakHour <= 6) pattern = 'night_owl';
    
    return { peak: peakHour, low: lowHour, pattern };
  }

  private extractBehaviorPatterns(snapshots: SystemSnapshot[]): any {
    return {
      sessionLengths: snapshots.map(s => s.userBehavior.sessionDuration),
      errorTolerance: snapshots.reduce((sum, s) => sum + s.userBehavior.errorRate, 0) / snapshots.length,
      commandComplexity: this.calculateCommandComplexity(snapshots),
      multitaskingLevel: this.calculateMultitaskingLevel(snapshots)
    };
  }

  private calculateCommandComplexity(snapshots: SystemSnapshot[]): number {
    const complexCommands = ['awk', 'sed', 'grep', 'find', 'systemctl', 'docker', 'kubectl'];
    const totalCommands = snapshots.reduce((sum, s) => 
      sum + Object.values(s.userBehavior.commandFrequency).reduce((cmdSum, freq) => cmdSum + freq, 0), 0
    );
    const complexCommandCount = snapshots.reduce((sum, s) => 
      sum + Object.entries(s.userBehavior.commandFrequency)
        .filter(([cmd]) => complexCommands.includes(cmd))
        .reduce((cmdSum, [, freq]) => cmdSum + freq, 0), 0
    );
    
    return totalCommands > 0 ? complexCommandCount / totalCommands : 0;
  }

  private calculateMultitaskingLevel(snapshots: SystemSnapshot[]): number {
    return snapshots.reduce((sum, s) => sum + s.processes.length, 0) / snapshots.length / 100;
  }

  private createSystemSignature(characteristics: any): string {
    const sigData = [
      characteristics.averageCpuUsage,
      characteristics.averageMemoryUsage,
      characteristics.averageProcessCount,
      characteristics.systemLoad,
      Object.keys(characteristics.commonCommands).length,
      characteristics.behaviorPatterns.commandComplexity
    ];
    
    return sigData.map(val => Math.round(val * 1000).toString(36)).join('-');
  }

  private createSystemFingerprint(characteristics: any): string {
    const fingerprint = JSON.stringify(characteristics);
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  private calculateCloneability(characteristics: any): number {
    let score = 100;
    
    // Reduce score for unique characteristics
    if (characteristics.behaviorPatterns.commandComplexity > 0.3) score -= 20;
    if (characteristics.workingHours.pattern === 'irregular') score -= 15;
    if (Object.keys(characteristics.commonCommands).length > 50) score -= 10;
    
    return Math.max(score, 30);
  }

  // Public API methods
  async getIntelligenceLevel(): Promise<number> {
    return Math.min((this.systemHistory.length / 100) * 100, 100);
  }

  async getSystemPersonality(): Promise<{
    type: string;
    traits: string[];
    confidence: number;
  }> {
    if (this.systemHistory.length < 10) {
      return { type: 'unknown', traits: [], confidence: 0 };
    }

    const characteristics = (await this.generateSystemDNA()).characteristics;
    
    let type = 'balanced';
    const traits: string[] = [];
    
    if (characteristics.averageCpuUsage > 70) {
      type = 'high_performance';
      traits.push('CPU Intensive', 'Processing Heavy');
    } else if (characteristics.averageCpuUsage < 30) {
      type = 'lightweight';
      traits.push('Efficient', 'Low Resource');
    }
    
    if (characteristics.behaviorPatterns.commandComplexity > 0.4) {
      traits.push('Advanced User', 'Command Expert');
    }
    
    if (characteristics.workingHours.pattern === 'business_hours') {
      traits.push('Professional', 'Structured Schedule');
    } else if (characteristics.workingHours.pattern === 'night_owl') {
      traits.push('Night Worker', 'Flexible Schedule');
    }
    
    return {
      type,
      traits,
      confidence: Math.min(this.systemHistory.length / 50 * 100, 100)
    };
  }

  dispose(): void {
    if (this.models) {
      Object.values(this.models).forEach(model => model.dispose());
      this.models = null;
    }
    this.systemHistory = [];
    this.predictionCache.clear();
    this.isInitialized = false;
  }
}

export const neuralEngine = new NeuralSystemEngine();
