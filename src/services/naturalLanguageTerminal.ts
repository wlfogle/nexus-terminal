import { AIInsight, Prediction } from '@/types';
import { neuralEngine } from './neuralEngine';

/**
 * AI-powered terminal assistant that provides intelligent suggestions,
 * predictions, and natural language command processing
 */
class NaturalLanguageTerminal {
  private initialized = false;
  private commandHistory: string[] = [];
  private contextVectors: Record<string, number[]> = {};
  private sessionContext: Record<string, any> = {};
  private intentMap: Record<string, string> = {
    'show files': 'ls',
    'list files': 'ls',
    'display files': 'ls',
    'show processes': 'ps',
    'list processes': 'ps',
    'check memory': 'free -h',
    'check disk space': 'df -h',
    'show disk usage': 'df -h',
    'show system info': 'uname -a',
    'who am i': 'whoami',
    'show network': 'netstat -tuln',
    'show connections': 'ss -tuln',
    'restart service': 'systemctl restart',
    'start service': 'systemctl start',
    'stop service': 'systemctl stop',
    'show logs': 'journalctl -xe',
    'find file': 'find . -name',
    'search content': 'grep -r',
    'create directory': 'mkdir',
    'remove directory': 'rmdir',
    'remove file': 'rm',
    'copy file': 'cp',
    'move file': 'mv',
    'rename file': 'mv',
    'change permissions': 'chmod',
    'check status': 'systemctl status',
    'view file': 'cat',
    'edit file': 'nano',
    'compress file': 'tar -czf',
    'extract file': 'tar -xzf',
    'download file': 'wget',
    'fetch url': 'curl',
    'upload file': 'scp',
    'sync files': 'rsync',
  };

  /**
   * Initialize the natural language terminal processing system
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Ensure the neural engine is initialized
      await neuralEngine.initialize();
      
      // Build context and intent processors
      this.buildIntentMap();
      
      this.initialized = true;
      console.log('🧩 Natural Language Terminal initialized');
    } catch (error) {
      console.error('Failed to initialize Natural Language Terminal:', error);
      throw error;
    }
  }

  /**
   * Process a natural language command and translate it into a system command
   * @param input The natural language input from user
   * @returns The processed system command and additional context
   */
  async processCommand(input: string): Promise<{
    command: string;
    confidence: number;
    alternatives: string[];
    explanation: string;
  }> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Store the command in history
    this.commandHistory.push(input);
    if (this.commandHistory.length > 100) {
      this.commandHistory = this.commandHistory.slice(-100);
    }
    
    // Update the session context
    this.updateSessionContext(input);

    // First try direct intent matching
    const directMatch = this.matchIntent(input);
    if (directMatch.confidence > 0.8) {
      return directMatch;
    }

    // If no direct match with high confidence, use the neural engine
    try {
      const contextString = this.getContextString();
      const prediction = await neuralEngine.predictOptimalCommand(contextString, input);
      
      // Take the best prediction if confidence is good
      if (prediction.confidence[0] > 0.4) {
        return {
          command: prediction.suggestions[0],
          confidence: prediction.confidence[0],
          alternatives: prediction.suggestions.slice(1),
          explanation: prediction.explanations[0]
        };
      }
      
      // Fall back to the best direct match if neural prediction is low confidence
      return directMatch;
      
    } catch (error) {
      console.error('Neural command prediction failed:', error);
      // Fall back to basic intent matching
      return directMatch;
    }
  }

  /**
   * Get AI-powered insights related to recent terminal usage
   */
  async getInsights(): Promise<AIInsight[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Get insights from neural engine
      const anomalies = await neuralEngine.detectAnomalies();
      const recommendations = await neuralEngine.generateIntelligentRecommendations();
      
      // Combine and prioritize insights
      const insights = [...anomalies, ...recommendations];
      
      // Sort by severity and actionability
      return this.prioritizeInsights(insights);
    } catch (error) {
      console.error('Failed to get terminal insights:', error);
      return [];
    }
  }
  
  /**
   * Get predictions about system performance and potential issues
   */
  async getPredictions(): Promise<Prediction[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Get performance predictions
      const performancePrediction = await neuralEngine.predictPerformance();
      const failurePredictions = await neuralEngine.predictFailures();
      
      // Create a prediction for general performance
      const performance: Prediction = {
        id: `perf_${Date.now()}`,
        metric: 'System Performance',
        prediction: Math.max(100 - ((performancePrediction.cpu + performancePrediction.memory) / 2), 0),
        confidence: performancePrediction.confidence,
        timeframe: '1 hour',
        reasoning: `Based on CPU (${performancePrediction.cpu.toFixed(1)}%) and memory (${performancePrediction.memory.toFixed(1)}%) trends`
      };
      
      return [performance, ...failurePredictions];
    } catch (error) {
      console.error('Failed to get terminal predictions:', error);
      return [];
    }
  }

  /**
   * Record the outcome of a command execution for learning
   * @param command The command that was executed
   * @param outcome Whether the command succeeded or resulted in an error
   */
  async recordCommandOutcome(command: string, outcome: 'success' | 'error'): Promise<void> {
    if (!this.initialized) return;

    try {
      // Learn from the command execution
      await neuralEngine.learnFromUserBehavior(
        command, 
        this.sessionContext, 
        outcome
      );
    } catch (error) {
      console.error('Failed to record command outcome:', error);
    }
  }

  /**
   * Analyze a terminal session and provide insights about usage patterns
   */
  async analyzeSession(): Promise<{
    commandCount: number;
    uniqueCommands: number;
    mostUsedCommands: Record<string, number>;
    errorRate: number;
    productivity: number;
    suggestions: string[];
  }> {
    if (this.commandHistory.length === 0) {
      return {
        commandCount: 0,
        uniqueCommands: 0,
        mostUsedCommands: {},
        errorRate: 0,
        productivity: 0,
        suggestions: []
      };
    }

    // Count commands
    const commandCounts: Record<string, number> = {};
    let errorCount = 0;
    
    this.commandHistory.forEach(cmd => {
      const baseCmd = cmd.split(' ')[0];
      commandCounts[baseCmd] = (commandCounts[baseCmd] || 0) + 1;
      
      if (this.sessionContext[cmd] === 'error') {
        errorCount++;
      }
    });
    
    // Sort commands by frequency
    const mostUsedCommands = Object.fromEntries(
      Object.entries(commandCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
    );
    
    // Calculate productivity score based on command variety and error rate
    const errorRate = errorCount / this.commandHistory.length;
    const uniqueCommandRatio = Object.keys(commandCounts).length / this.commandHistory.length;
    const productivity = Math.min(100, (1 - errorRate) * 80 + uniqueCommandRatio * 20);
    
    // Generate suggestions based on usage patterns
    const suggestions = await this.generateSessionSuggestions(commandCounts, errorRate);
    
    return {
      commandCount: this.commandHistory.length,
      uniqueCommands: Object.keys(commandCounts).length,
      mostUsedCommands,
      errorRate: errorRate * 100,
      productivity,
      suggestions
    };
  }

  /**
   * Get the system's perceived personality based on usage patterns
   */
  async getSystemPersonality(): Promise<{
    type: string;
    traits: string[];
    confidence: number;
  }> {
    return neuralEngine.getSystemPersonality();
  }

  /**
   * Private helper methods
   */
  private matchIntent(input: string): {
    command: string;
    confidence: number;
    alternatives: string[];
    explanation: string;
  } {
    const normalizedInput = input.toLowerCase().trim();
    
    // Check for exact matches in intent map
    if (this.intentMap[normalizedInput]) {
      return {
        command: this.intentMap[normalizedInput],
        confidence: 1.0,
        alternatives: [],
        explanation: `Executing: ${this.intentMap[normalizedInput]}`
      };
    }
    
    // Check for partial matches
    const matches = Object.entries(this.intentMap)
      .map(([intent, cmd]) => {
        let confidence = 0;
        
        // Check if input contains the entire intent phrase
        if (normalizedInput.includes(intent)) {
          confidence = 0.9;
        } else {
          // Calculate word-level match ratio
          const inputWords = normalizedInput.split(/\s+/);
          const intentWords = intent.split(/\s+/);
          
          const matchingWords = intentWords.filter(word => 
            inputWords.some(inputWord => inputWord.includes(word) || word.includes(inputWord))
          );
          
          confidence = matchingWords.length / intentWords.length;
        }
        
        // Boost confidence for commands with arguments already in input
        if (normalizedInput.includes(' ') && confidence > 0.5) {
          const args = normalizedInput.split(/\s+/).slice(1).join(' ');
          if (args.length > 0) {
            confidence += 0.1;
          }
        }
        
        return { intent, command: cmd, confidence };
      })
      .filter(match => match.confidence > 0.4)
      .sort((a, b) => b.confidence - a.confidence);
    
    if (matches.length > 0) {
      // Extract parameters if needed
      const bestMatch = matches[0];
      let finalCommand = bestMatch.command;
      
      // Check if we need to extract arguments from input
      const inputParts = normalizedInput.split(/\s+/);
      const intentParts = bestMatch.intent.split(/\s+/);
      
      if (inputParts.length > intentParts.length) {
        const args = inputParts.slice(intentParts.length).join(' ');
        
        // For commands that typically need arguments
        if (finalCommand.endsWith(' ')) {
          finalCommand += args;
        } else if (args.length > 0) {
          finalCommand += ' ' + args;
        }
      }
      
      return {
        command: finalCommand,
        confidence: bestMatch.confidence,
        alternatives: matches.slice(1, 4).map(m => m.command),
        explanation: `Executing: ${finalCommand}`
      };
    }
    
    // No good match found
    return {
      command: normalizedInput, // Pass through the original input
      confidence: 0.1,
      alternatives: [],
      explanation: 'No matching command pattern found. Executing as entered.'
    };
  }

  private updateSessionContext(input: string): void {
    // Simple context tracking
    const timestamp = Date.now();
    const hour = new Date().getHours();
    
    this.sessionContext = {
      ...this.sessionContext,
      lastCommand: input,
      lastCommandTime: timestamp,
      timeOfDay: hour,
      commandCount: (this.sessionContext.commandCount || 0) + 1,
      sessionDuration: timestamp - (this.sessionContext.sessionStart || timestamp)
    };
    
    // Initialize session start if this is the first command
    if (!this.sessionContext.sessionStart) {
      this.sessionContext.sessionStart = timestamp;
    }
  }

  private getContextString(): string {
    // Build a context string from recent commands and session state
    const recentCommands = this.commandHistory.slice(-5).join('; ');
    
    const contextParts = [
      `Recent commands: ${recentCommands}`,
      `Session duration: ${Math.floor((this.sessionContext.sessionDuration || 0) / 1000 / 60)} minutes`,
      `Command count: ${this.sessionContext.commandCount || 0}`
    ];
    
    return contextParts.join('. ');
  }

  private buildIntentMap(): void {
    // The intent map is already defined in the class
    // This method could be expanded to load additional intents from a config file
    console.log(`Loaded ${Object.keys(this.intentMap).length} natural language command mappings`);
  }

  private prioritizeInsights(insights: AIInsight[]): AIInsight[] {
    // First sort by severity (high > medium > low)
    const severityOrder: Record<string, number> = {
      'high': 3,
      'medium': 2,
      'low': 1
    };
    
    return insights.sort((a, b) => {
      // Sort by severity first
      const severityDiff = (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
      if (severityDiff !== 0) return severityDiff;
      
      // Then by actionability
      if (a.actionable !== b.actionable) {
        return a.actionable ? -1 : 1;
      }
      
      // Then by recency (timestamp)
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }

  private async generateSessionSuggestions(
    commandCounts: Record<string, number>,
    errorRate: number
  ): Promise<string[]> {
    const suggestions: string[] = [];
    
    // Check for repetitive patterns
    const commands = Object.keys(commandCounts);
    if (commands.length < 3 && this.commandHistory.length > 10) {
      suggestions.push('Consider creating aliases for frequently used commands');
    }
    
    // Check for high error rate
    if (errorRate > 0.3) {
      suggestions.push('Try using command completion (Tab key) to reduce errors');
    }
    
    // Check for filesystem-heavy operations
    const filesystemCommands = ['ls', 'cd', 'cp', 'mv', 'rm', 'mkdir', 'rmdir', 'find'];
    const fsCommandCount = filesystemCommands.reduce((count, cmd) => 
      count + (commandCounts[cmd] || 0), 0
    );
    
    if (fsCommandCount > this.commandHistory.length * 0.7) {
      suggestions.push('Consider using a file manager for heavy file operations');
    }
    
    // Add neural engine suggestions if available
    try {
      const recommendations = await neuralEngine.generateIntelligentRecommendations();
      const productivityTips = recommendations
        .filter(r => r.type === 'optimization')
        .map(r => r.description)
        .slice(0, 2);
      
      suggestions.push(...productivityTips);
    } catch (error) {
      console.error('Failed to get neural recommendations:', error);
    }
    
    return suggestions.slice(0, 5);
  }

  /**
   * Reset the terminal assistant state
   */
  dispose(): void {
    this.commandHistory = [];
    this.contextVectors = {};
    this.sessionContext = {};
    this.initialized = false;
  }
}

export const naturalLanguageTerminal = new NaturalLanguageTerminal();
