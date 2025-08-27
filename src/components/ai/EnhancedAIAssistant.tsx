import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Eye, Search, Brain, Camera, BookOpen, Zap, AlertTriangle, CheckCircle } from 'lucide-react';
import { selectActiveTab, addAIMessage } from '../../store/slices/terminalTabSlice';
import { ragService } from '../../services/ragService';
import { visionService, ScreenAnalysis } from '../../services/visionService';
import { cn } from '../../lib/utils';

interface EnhancedAIAssistantProps {
  className?: string;
}

interface AICapability {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  enabled: boolean;
  status: 'ready' | 'loading' | 'error' | 'disabled';
}

interface RAGContext {
  query: string;
  results: Array<{
    content: string;
    similarity: number;
    type: string;
    path?: string;
  }>;
  contextUsed: boolean;
}

interface VisionContext {
  hasScreenshot: boolean;
  analysis?: ScreenAnalysis;
  contextUsed: boolean;
}

const EnhancedAIAssistant: React.FC<EnhancedAIAssistantProps> = ({ className }) => {
  const dispatch = useDispatch();
  const activeTab = useSelector(selectActiveTab);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [capabilities, setCapabilities] = useState<AICapability[]>([
    {
      id: 'rag',
      name: 'RAG Knowledge',
      description: 'Semantic search across codebase and history',
      icon: Brain,
      enabled: false,
      status: 'loading'
    },
    {
      id: 'vision',
      name: 'Computer Vision',
      description: 'See and understand your screen',
      icon: Eye,
      enabled: false,
      status: 'loading'
    },
    {
      id: 'proactive',
      name: 'Proactive Assistant',
      description: 'Automatic suggestions based on context',
      icon: Zap,
      enabled: true,
      status: 'ready'
    },
    {
      id: 'documentation',
      name: 'Smart Documentation',
      description: 'Context-aware help and documentation',
      icon: BookOpen,
      enabled: true,
      status: 'ready'
    }
  ]);
  
  const [ragContext, setRagContext] = useState<RAGContext>({ 
    query: '', 
    results: [], 
    contextUsed: false 
  });
  
  const [visionContext, setVisionContext] = useState<VisionContext>({ 
    hasScreenshot: false, 
    contextUsed: false 
  });
  
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [useScreenContext, setUseScreenContext] = useState(false);
  const [useRAGContext, setUseRAGContext] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize AI capabilities
  useEffect(() => {
    const initializeCapabilities = async () => {
      // Initialize RAG service
      try {
        await ragService.initialize();
        setCapabilities(prev => prev.map(cap => 
          cap.id === 'rag' ? { ...cap, enabled: true, status: 'ready' } : cap
        ));
        
        // Index current project if we have an active tab
        if (activeTab?.workingDirectory) {
          await ragService.indexCodebase(activeTab.workingDirectory);
        }
      } catch (error) {
        console.warn('RAG service initialization failed:', error);
        setCapabilities(prev => prev.map(cap => 
          cap.id === 'rag' ? { ...cap, status: 'error' } : cap
        ));
      }
      
      // Initialize Vision service
      try {
        await visionService.initialize();
        setCapabilities(prev => prev.map(cap => 
          cap.id === 'vision' ? { ...cap, enabled: true, status: 'ready' } : cap
        ));
      } catch (error) {
        console.warn('Vision service initialization failed:', error);
        setCapabilities(prev => prev.map(cap => 
          cap.id === 'vision' ? { ...cap, status: 'error' } : cap
        ));
      }
    };
    
    initializeCapabilities();
  }, [activeTab?.workingDirectory]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeTab?.aiConversation]);

  // Handle proactive suggestions based on screen changes
  useEffect(() => {
    if (!capabilities.find(c => c.id === 'vision')?.enabled) return;
    
    const handleScreenChange = (analysis: ScreenAnalysis) => {
      // Auto-generate suggestions for errors
      if (analysis.detectedContext.errorMessages && 
          analysis.detectedContext.errorMessages.length > 0) {
        handleProactiveSuggestion(
          `I noticed error messages on your screen: "${analysis.detectedContext.errorMessages.join(', ')}". Would you like help resolving these?`,
          { analysis, type: 'error_detection' }
        );
      }
      
      // Suggest help for new terminal commands
      if (analysis.detectedContext.windowType === 'terminal' && 
          analysis.detectedContext.terminalCommands) {
        const recentCommand = analysis.detectedContext.terminalCommands[analysis.detectedContext.terminalCommands.length - 1];
        if (recentCommand && (recentCommand.includes('error') || recentCommand.includes('failed'))) {
          handleProactiveSuggestion(
            `I see you might be having issues with "${recentCommand}". Need assistance?`,
            { analysis, type: 'command_assistance' }
          );
        }
      }
    };
    
    // Start screen monitoring for proactive assistance
    visionService.startScreenMonitoring(handleScreenChange, 10000);
  }, [capabilities]);

  const handleProactiveSuggestion = async (suggestion: string, context: any) => {
    if (!activeTab) return;
    
    dispatch(addAIMessage({
      tabId: activeTab.id,
      message: {
        role: 'assistant',
        content: `🔍 **Proactive Suggestion**: ${suggestion}`,
        timestamp: new Date(),
        metadata: {
          type: 'proactive_suggestion',
          context,
          capabilities_used: ['vision', 'proactive']
        }
      }
    }));
  };

  const captureScreen = async () => {
    try {
      const capture = await visionService.captureScreen();
      const analysis = await visionService.analyzeScreen(capture.id);
      
      setVisionContext({
        hasScreenshot: true,
        analysis,
        contextUsed: false
      });
      
      return analysis;
    } catch (error) {
      console.error('Failed to capture screen:', error);
      throw error;
    }
  };

  const performRAGSearch = async (query: string) => {
    try {
      const results = await ragService.search({
        query,
        maxResults: 5,
        threshold: 0.6
      });
      
      setRagContext({
        query,
        results: results.map(r => ({
          content: r.document.content,
          similarity: r.similarity,
          type: r.document.metadata.type,
          path: r.document.metadata.path
        })),
        contextUsed: false
      });
      
      return results;
    } catch (error) {
      console.error('RAG search failed:', error);
      return [];
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !activeTab) return;
    
    setIsLoading(true);
    const userMessage = message;
    setMessage('');
    
    try {
      // Add user message
      dispatch(addAIMessage({
        tabId: activeTab.id,
        message: {
          role: 'user',
          content: userMessage,
          timestamp: new Date()
        }
      }));
      
      let contextualInfo = '';
      const capabilitiesUsed: string[] = [];
      
      // Gather RAG context if enabled
      if (useRAGContext && capabilities.find(c => c.id === 'rag')?.enabled) {
        const ragResults = await performRAGSearch(userMessage);
        if (ragResults.length > 0) {
          contextualInfo += await ragService.getContextForPrompt(userMessage, activeTab.workingDirectory);
          capabilitiesUsed.push('rag');
        }
      }
      
      // Gather vision context if enabled and requested
      if (useScreenContext && capabilities.find(c => c.id === 'vision')?.enabled) {
        try {
          const screenHelp = await visionService.getContextualHelp();
          contextualInfo += `\n\n## 👁️ Screen Context:\n${screenHelp}`;
          capabilitiesUsed.push('vision');
          setVisionContext(prev => ({ ...prev, contextUsed: true }));
        } catch (error) {
          console.warn('Failed to get screen context:', error);
        }
      }
      
      // Build enhanced prompt
      const enhancedPrompt = `${contextualInfo}\n\n**User Query**: ${userMessage}\n\n**Current Context**:\n- Working Directory: ${activeTab.workingDirectory}\n- Shell: ${activeTab.shell}\n- Recent Commands: ${activeTab.aiContext.recentCommands.slice(-3).join(', ')}`;
      
      // Send to AI with enhanced context
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            ...activeTab.aiConversation.slice(-10), // Include recent conversation
            { role: 'user', content: enhancedPrompt }
          ],
          context: {
            tabId: activeTab.id,
            capabilities: capabilitiesUsed,
            workingDirectory: activeTab.workingDirectory
          }
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const aiResponse = await response.text();
      
      // Add AI response
      dispatch(addAIMessage({
        tabId: activeTab.id,
        message: {
          role: 'assistant',
          content: aiResponse,
          timestamp: new Date(),
          metadata: {
            capabilities_used: capabilitiesUsed,
            context_length: contextualInfo.length,
            rag_results: useRAGContext ? ragContext.results.length : 0,
            vision_used: useScreenContext
          }
        }
      }));
      
      // Mark contexts as used
      if (useRAGContext) {
        setRagContext(prev => ({ ...prev, contextUsed: true }));
      }
      
    } catch (error) {
      console.error('Failed to send message:', error);
      
      dispatch(addAIMessage({
        tabId: activeTab.id,
        message: {
          role: 'assistant',
          content: `❌ Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date(),
          metadata: { error: true }
        }
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const getCapabilityIcon = (capability: AICapability) => {
    const Icon = capability.icon;
    const statusColors = {
      ready: 'text-green-500',
      loading: 'text-yellow-500 animate-pulse',
      error: 'text-red-500',
      disabled: 'text-gray-400'
    };
    
    return <Icon className={cn('w-4 h-4', statusColors[capability.status])} />;
  };

  const getCapabilityStatusIcon = (status: AICapability['status']) => {
    switch (status) {
      case 'ready':
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'loading':
        return <div className="w-3 h-3 rounded-full border-2 border-yellow-500 border-t-transparent animate-spin" />;
      case 'error':
        return <AlertTriangle className="w-3 h-3 text-red-500" />;
      default:
        return <div className="w-3 h-3 rounded-full bg-gray-400" />;
    }
  };

  if (!activeTab) {
    return (
      <div className={cn('flex items-center justify-center h-full text-gray-500', className)}>
        <div className="text-center">
          <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No active terminal tab</p>
          <p className="text-sm">Create a tab to start using AI assistance</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full bg-gray-50 dark:bg-gray-900', className)}>
      {/* AI Capabilities Header */}
      <div className="flex-shrink-0 p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Brain className="w-5 h-5 text-blue-500" />
            Enhanced AI Assistant
          </h3>
          <button
            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            {showAdvancedOptions ? 'Hide' : 'Show'} Options
          </button>
        </div>
        
        {/* Capabilities Status */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {capabilities.map(capability => (
            <div key={capability.id} className="flex items-center gap-2 text-sm">
              {getCapabilityIcon(capability)}
              <span className={cn(
                'flex-1 text-xs',
                capability.enabled ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400'
              )}>
                {capability.name}
              </span>
              {getCapabilityStatusIcon(capability.status)}
            </div>
          ))}
        </div>
        
        {/* Advanced Options */}
        {showAdvancedOptions && (
          <div className="space-y-2 pt-3 border-t border-gray-200 dark:border-gray-600">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={useRAGContext}
                onChange={(e) => setUseRAGContext(e.target.checked)}
                disabled={!capabilities.find(c => c.id === 'rag')?.enabled}
                className="rounded"
              />
              <span>Use RAG context from codebase</span>
            </label>
            
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={useScreenContext}
                onChange={(e) => setUseScreenContext(e.target.checked)}
                disabled={!capabilities.find(c => c.id === 'vision')?.enabled}
                className="rounded"
              />
              <span>Include screen context</span>
            </label>
            
            {capabilities.find(c => c.id === 'vision')?.enabled && (
              <button
                onClick={captureScreen}
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                <Camera className="w-4 h-4" />
                Capture Screen Now
              </button>
            )}
          </div>
        )}
        
        {/* Context Indicators */}
        <div className="flex gap-2 mt-2">
          {ragContext.results.length > 0 && (
            <div className="flex items-center gap-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
              <Search className="w-3 h-3" />
              {ragContext.results.length} RAG results
            </div>
          )}
          
          {visionContext.hasScreenshot && (
            <div className="flex items-center gap-1 text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-2 py-1 rounded">
              <Eye className="w-3 h-3" />
              Screen captured
            </div>
          )}
        </div>
      </div>
      
      {/* Conversation Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab.aiConversation.map((msg, index) => (
          <div
            key={index}
            className={cn(
              'flex',
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                'max-w-[80%] px-4 py-2 rounded-lg',
                msg.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700'
              )}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>
              
              {/* Metadata for AI messages */}
              {msg.role === 'assistant' && msg.metadata && (
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 text-xs text-gray-500">
                  {msg.metadata.capabilities_used && (
                    <div>Capabilities: {msg.metadata.capabilities_used.join(', ')}</div>
                  )}
                  {msg.metadata.rag_results > 0 && (
                    <div>RAG results used: {msg.metadata.rag_results}</div>
                  )}
                  {msg.metadata.vision_used && (
                    <div>Screen context included</div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-200 dark:bg-gray-700 px-4 py-2 rounded-lg">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <div className="w-2 h-2 bg-current rounded-full animate-pulse" />
                <div className="w-2 h-2 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                <div className="w-2 h-2 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                <span className="text-sm ml-2">AI is thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input Area */}
      <div className="flex-shrink-0 p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
            placeholder="Ask me anything about your code, terminal, or what you see on screen..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !message.trim()}
            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default EnhancedAIAssistant;
