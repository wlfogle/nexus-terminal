import { invoke } from '@tauri-apps/api/tauri';
import { writeFile, readBinaryFile } from '@tauri-apps/api/fs';
import { join, tempDir } from '@tauri-apps/api/path';

export interface ScreenCapture {
  id: string;
  timestamp: string;
  data: Uint8Array;
  format: 'png' | 'jpeg';
  width: number;
  height: number;
  region?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface OCRResult {
  text: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface VisualElement {
  type: 'button' | 'text' | 'input' | 'window' | 'code' | 'terminal' | 'menu' | 'icon';
  text?: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  attributes: Record<string, any>;
}

export interface ScreenAnalysis {
  captureId: string;
  timestamp: string;
  ocrResults: OCRResult[];
  visualElements: VisualElement[];
  detectedContext: {
    windowType: 'terminal' | 'editor' | 'browser' | 'desktop' | 'unknown';
    primaryContent: string;
    codeLanguage?: string;
    terminalCommands?: string[];
    errorMessages?: string[];
  };
  summary: string;
}

export interface VisionQuery {
  prompt: string;
  includeOCR?: boolean;
  includeElements?: boolean;
  focusRegion?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

class VisionService {
  private isInitialized = false;
  private ocrEngine: 'tesseract' | 'paddleocr' | 'easyocr' = 'tesseract';
  private captures: Map<string, ScreenCapture> = new Map();

  /**
   * Initialize computer vision service
   */
  async initialize(): Promise<void> {
    try {
      // Check if required dependencies are available
      await this.checkDependencies();
      this.isInitialized = true;
      console.log('Vision Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize vision service:', error);
      throw error;
    }
  }

  /**
   * Capture the entire screen
   */
  async captureScreen(): Promise<ScreenCapture> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const captureResult = await invoke('capture_screen') as {
        data: number[];
        width: number;
        height: number;
      };

      const capture: ScreenCapture = {
        id: `screen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        data: new Uint8Array(captureResult.data),
        format: 'png',
        width: captureResult.width,
        height: captureResult.height
      };

      this.captures.set(capture.id, capture);
      return capture;
    } catch (error) {
      console.error('Failed to capture screen:', error);
      throw error;
    }
  }

  /**
   * Capture a specific region of the screen
   */
  async captureRegion(x: number, y: number, width: number, height: number): Promise<ScreenCapture> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const captureResult = await invoke('capture_screen_region', {
        x, y, width, height
      }) as {
        data: number[];
        width: number;
        height: number;
      };

      const capture: ScreenCapture = {
        id: `region_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        data: new Uint8Array(captureResult.data),
        format: 'png',
        width: captureResult.width,
        height: captureResult.height,
        region: { x, y, width, height }
      };

      this.captures.set(capture.id, capture);
      return capture;
    } catch (error) {
      console.error('Failed to capture screen region:', error);
      throw error;
    }
  }

  /**
   * Perform OCR on a screen capture
   */
  async performOCR(captureId: string): Promise<OCRResult[]> {
    const capture = this.captures.get(captureId);
    if (!capture) {
      throw new Error(`Capture ${captureId} not found`);
    }

    try {
      // Save capture to temporary file for processing
      const tempPath = await this.saveCaptureToTemp(capture);
      
      const ocrResults = await invoke('perform_ocr', {
        imagePath: tempPath,
        engine: this.ocrEngine
      }) as Array<{
        text: string;
        confidence: number;
        x: number;
        y: number;
        width: number;
        height: number;
      }>;

      return ocrResults.map(result => ({
        text: result.text,
        confidence: result.confidence,
        boundingBox: {
          x: result.x,
          y: result.y,
          width: result.width,
          height: result.height
        }
      }));
    } catch (error) {
      console.error('OCR processing failed:', error);
      throw error;
    }
  }

  /**
   * Detect UI elements in a screen capture
   */
  async detectElements(captureId: string): Promise<VisualElement[]> {
    const capture = this.captures.get(captureId);
    if (!capture) {
      throw new Error(`Capture ${captureId} not found`);
    }

    try {
      const tempPath = await this.saveCaptureToTemp(capture);
      
      const elements = await invoke('detect_ui_elements', {
        imagePath: tempPath
      }) as Array<{
        type: string;
        text?: string;
        x: number;
        y: number;
        width: number;
        height: number;
        confidence: number;
        attributes: Record<string, any>;
      }>;

      return elements.map(element => ({
        type: element.type as VisualElement['type'],
        text: element.text,
        boundingBox: {
          x: element.x,
          y: element.y,
          width: element.width,
          height: element.height
        },
        confidence: element.confidence,
        attributes: element.attributes
      }));
    } catch (error) {
      console.error('Element detection failed:', error);
      throw error;
    }
  }

  /**
   * Analyze screen capture comprehensively
   */
  async analyzeScreen(captureId: string): Promise<ScreenAnalysis> {
    const capture = this.captures.get(captureId);
    if (!capture) {
      throw new Error(`Capture ${captureId} not found`);
    }

    try {
      // Perform OCR and element detection in parallel
      const [ocrResults, visualElements] = await Promise.all([
        this.performOCR(captureId),
        this.detectElements(captureId)
      ]);

      // Analyze the content to determine context
      const detectedContext = this.analyzeContext(ocrResults, visualElements);
      
      // Generate summary
      const summary = this.generateSummary(ocrResults, visualElements, detectedContext);

      return {
        captureId,
        timestamp: capture.timestamp,
        ocrResults,
        visualElements,
        detectedContext,
        summary
      };
    } catch (error) {
      console.error('Screen analysis failed:', error);
      throw error;
    }
  }

  /**
   * Ask AI to interpret screen capture with specific query
   */
  async queryScreenWithAI(captureId: string, query: VisionQuery): Promise<string> {
    const capture = this.captures.get(captureId);
    if (!capture) {
      throw new Error(`Capture ${captureId} not found`);
    }

    try {
      // Get screen analysis if requested
      let context = '';
      
      if (query.includeOCR || query.includeElements) {
        const analysis = await this.analyzeScreen(captureId);
        
        if (query.includeOCR) {
          const ocrText = analysis.ocrResults
            .map(result => `"${result.text}" (confidence: ${Math.round(result.confidence * 100)}%)`)
            .join(', ');
          context += `\nText detected on screen: ${ocrText}`;
        }
        
        if (query.includeElements) {
          const elements = analysis.visualElements
            .map(element => `${element.type}${element.text ? `: "${element.text}"` : ''}`)
            .join(', ');
          context += `\nUI elements detected: ${elements}`;
        }
        
        context += `\nDetected context: ${analysis.detectedContext.windowType}`;
        if (analysis.detectedContext.codeLanguage) {
          context += `, programming language: ${analysis.detectedContext.codeLanguage}`;
        }
      }

      // Convert image to base64 for AI processing
      const base64Image = await this.convertCaptureToBase64(capture);
      
      const prompt = `Looking at this screen capture, ${query.prompt}
      
      ${context}
      
      Please provide a helpful response based on what you can see in the image.`;

      // Send to AI service with vision capabilities
      const response = await invoke('query_vision_ai', {
        prompt,
        image: base64Image,
        focusRegion: query.focusRegion,
        ollamaHost: process.env.OLLAMA_HOST || 'localhost',
        ollamaPort: process.env.OLLAMA_PORT || '11434'
      }) as string;

      return response;
    } catch (error) {
      console.error('AI vision query failed:', error);
      throw error;
    }
  }

  /**
   * Get contextual help based on what's currently on screen
   */
  async getContextualHelp(): Promise<string> {
    try {
      const capture = await this.captureScreen();
      const analysis = await this.analyzeScreen(capture.id);
      
      let helpQuery = 'What can you see on this screen and how can I help with it?';
      
      // Customize query based on detected context
      if (analysis.detectedContext.windowType === 'terminal') {
        helpQuery = 'I can see a terminal window. What commands or operations might be helpful here?';
      } else if (analysis.detectedContext.windowType === 'editor') {
        helpQuery = `I can see a code editor${analysis.detectedContext.codeLanguage ? ` with ${analysis.detectedContext.codeLanguage} code` : ''}. What programming assistance might be needed?`;
      }

      // Check for error messages
      if (analysis.detectedContext.errorMessages && analysis.detectedContext.errorMessages.length > 0) {
        helpQuery = `I can see error messages on the screen: "${analysis.detectedContext.errorMessages.join(', ')}". How can I help resolve these errors?`;
      }

      return await this.queryScreenWithAI(capture.id, {
        prompt: helpQuery,
        includeOCR: true,
        includeElements: true
      });
    } catch (error) {
      console.error('Failed to get contextual help:', error);
      throw error;
    }
  }

  /**
   * Monitor screen for changes and provide proactive assistance
   */
  async startScreenMonitoring(callback: (analysis: ScreenAnalysis) => void, intervalMs: number = 5000): Promise<void> {
    const monitor = async () => {
      try {
        const capture = await this.captureScreen();
        const analysis = await this.analyzeScreen(capture.id);
        
        // Only trigger callback if significant changes detected
        if (this.hasSignificantChanges(analysis)) {
          callback(analysis);
        }
      } catch (error) {
        console.error('Screen monitoring error:', error);
      }
    };

    // Start monitoring
    setInterval(monitor, intervalMs);
    console.log('Screen monitoring started');
  }

  /**
   * Save capture to temporary file for processing
   */
  private async saveCaptureToTemp(capture: ScreenCapture): Promise<string> {
    const tempDirPath = await tempDir();
    const filename = `${capture.id}.${capture.format}`;
    const tempPath = await join(tempDirPath, filename);
    
    await writeFile(tempPath, capture.data);
    return tempPath;
  }

  /**
   * Convert capture to base64 for AI processing
   */
  private async convertCaptureToBase64(capture: ScreenCapture): Promise<string> {
    const base64 = btoa(String.fromCharCode(...capture.data));
    return `data:image/${capture.format};base64,${base64}`;
  }

  /**
   * Analyze context from OCR and element detection results
   */
  private analyzeContext(ocrResults: OCRResult[], visualElements: VisualElement[]): ScreenAnalysis['detectedContext'] {
    const allText = ocrResults.map(result => result.text.toLowerCase()).join(' ');
    
    // Detect window type
    let windowType: 'terminal' | 'editor' | 'browser' | 'desktop' | 'unknown' = 'unknown';
    
    if (allText.includes('$') || allText.includes('bash') || allText.includes('command') || 
        visualElements.some(el => el.type === 'terminal')) {
      windowType = 'terminal';
    } else if (allText.includes('function') || allText.includes('import') || allText.includes('class') ||
               visualElements.some(el => el.type === 'code')) {
      windowType = 'editor';
    } else if (allText.includes('http') || allText.includes('www') || allText.includes('browser')) {
      windowType = 'browser';
    }

    // Detect programming language
    let codeLanguage: string | undefined;
    const languageKeywords = {
      'javascript': ['function', 'const', 'let', 'var', 'import', 'export'],
      'typescript': ['interface', 'type', 'extends', 'implements'],
      'python': ['def', 'import', 'from', 'class', 'self'],
      'rust': ['fn', 'struct', 'impl', 'use', 'mod'],
      'go': ['func', 'package', 'import', 'type', 'struct'],
      'java': ['public', 'class', 'extends', 'implements', 'package']
    };

    for (const [lang, keywords] of Object.entries(languageKeywords)) {
      if (keywords.some(keyword => allText.includes(keyword))) {
        codeLanguage = lang;
        break;
      }
    }

    // Extract terminal commands
    const terminalCommands: string[] = [];
    const commandRegex = /\$\s*([a-zA-Z0-9\-_\.\/\s]+)/g;
    let match;
    while ((match = commandRegex.exec(allText)) !== null) {
      terminalCommands.push(match[1].trim());
    }

    // Detect error messages
    const errorMessages: string[] = [];
    const errorKeywords = ['error', 'failed', 'exception', 'warning', 'not found', 'permission denied'];
    
    for (const result of ocrResults) {
      const text = result.text.toLowerCase();
      if (errorKeywords.some(keyword => text.includes(keyword))) {
        errorMessages.push(result.text);
      }
    }

    return {
      windowType,
      primaryContent: ocrResults.map(r => r.text).join(' ').substring(0, 500),
      codeLanguage,
      terminalCommands: terminalCommands.length > 0 ? terminalCommands : undefined,
      errorMessages: errorMessages.length > 0 ? errorMessages : undefined
    };
  }

  /**
   * Generate summary of screen analysis
   */
  private generateSummary(ocrResults: OCRResult[], visualElements: VisualElement[], context: ScreenAnalysis['detectedContext']): string {
    let summary = `Screen shows a ${context.windowType} window`;
    
    if (context.codeLanguage) {
      summary += ` with ${context.codeLanguage} code`;
    }
    
    if (context.terminalCommands && context.terminalCommands.length > 0) {
      summary += `. Recent commands: ${context.terminalCommands.slice(-3).join(', ')}`;
    }
    
    if (context.errorMessages && context.errorMessages.length > 0) {
      summary += `. Errors detected: ${context.errorMessages.length} error(s)`;
    }
    
    summary += `. Contains ${ocrResults.length} text elements and ${visualElements.length} UI elements.`;
    
    return summary;
  }

  /**
   * Check if screen analysis shows significant changes
   */
  private lastAnalysis: ScreenAnalysis | null = null;
  
  private hasSignificantChanges(analysis: ScreenAnalysis): boolean {
    if (!this.lastAnalysis) {
      this.lastAnalysis = analysis;
      return true;
    }
    
    // Check for window type changes
    if (this.lastAnalysis.detectedContext.windowType !== analysis.detectedContext.windowType) {
      this.lastAnalysis = analysis;
      return true;
    }
    
    // Check for new error messages
    const oldErrors = this.lastAnalysis.detectedContext.errorMessages || [];
    const newErrors = analysis.detectedContext.errorMessages || [];
    if (newErrors.length > oldErrors.length) {
      this.lastAnalysis = analysis;
      return true;
    }
    
    // Check for significant text changes (more than 30% different)
    const oldTextLength = this.lastAnalysis.ocrResults.reduce((sum, r) => sum + r.text.length, 0);
    const newTextLength = analysis.ocrResults.reduce((sum, r) => sum + r.text.length, 0);
    const lengthDifference = Math.abs(newTextLength - oldTextLength) / Math.max(oldTextLength, 1);
    
    if (lengthDifference > 0.3) {
      this.lastAnalysis = analysis;
      return true;
    }
    
    return false;
  }

  /**
   * Check if required dependencies are available
   */
  private async checkDependencies(): Promise<void> {
    try {
      await invoke('check_vision_dependencies');
    } catch (error) {
      throw new Error('Computer vision dependencies not available. Please install required packages.');
    }
  }

  /**
   * Clean up old captures to free memory
   */
  cleanup(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    
    for (const [id, capture] of this.captures) {
      if (new Date(capture.timestamp).getTime() < oneHourAgo) {
        this.captures.delete(id);
      }
    }
  }
}

// Singleton instance
export const visionService = new VisionService();
