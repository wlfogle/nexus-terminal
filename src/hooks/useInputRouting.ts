import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { invoke } from '@tauri-apps/api/core';
import { selectActiveTab, addAIMessage } from '../store/slices/terminalTabSlice';
import { commandRoutingService } from '../services/commandRouting';

export const useInputRouting = () => {
  const dispatch = useDispatch();
  const activeTab = useSelector(selectActiveTab);

  // Use unified command routing service for smart command detection
  const isShellCommand = useCallback((input: string): boolean => {
    const result = commandRoutingService.isShellCommand(input);
    console.log(`🔀 useInputRouting: "${input}" -> ${result ? '🐚 Shell' : '🤖 AI'}`);
    return result;
  }, []);

  // Handle input routing between AI and shell with enhanced analysis
  const handleInput = useCallback(async (input: string, onAIResponse?: (message: string) => void) => {
    const trimmed = input.trim();
    if (!trimmed || !activeTab) return;
    
    console.log(`🔀 Routing input: "${trimmed}"`);
    
    try {
      // Get detailed routing analysis for better decision making
      const routingResult = await commandRoutingService.routeCommand(trimmed);
      
      console.log(`🔍 Routing analysis: ${routingResult.reason} (confidence: ${(routingResult.confidence * 100).toFixed(1)}%)`);
      
      if (routingResult.isShellCommand) {
        // Execute as shell command
        if (activeTab.terminalId) {
          try {
            console.log(`🐚 Sending to shell: ${trimmed}`);
            await invoke('write_to_terminal', { 
              terminalId: activeTab.terminalId, 
              data: trimmed + '\r' 
            });
            console.log(`✅ Shell command sent successfully: ${trimmed}`);
            
            // Provide feedback on low confidence routing
            if (routingResult.confidence < 0.8) {
              console.log(`💡 Note: If this wasn't a shell command, try asking: "help me with ${trimmed}"`);
            }
          } catch (error) {
            console.error('Failed to execute shell command:', error);
            
            // On shell execution error, offer AI assistance
            if (onAIResponse) {
              const errorMessage = `I had trouble executing "${trimmed}". Let me help you troubleshoot this command.`;
              onAIResponse(errorMessage);
              
              // Also add the AI message to store
              dispatch(addAIMessage({
                tabId: activeTab.id,
                message: {
                  role: 'assistant',
                  content: errorMessage,
                  timestamp: new Date(),
                  metadata: { error_recovery: true, failed_command: trimmed }
                }
              }));
            }
          }
        } else {
          console.error('No terminal ID available for command execution');
        }
        return; // Important: return early for shell commands
      } else {
        // Send to AI assistant
        console.log(`🤖 Sending to AI: ${trimmed}`);
        
        // Add user message immediately for AI queries only
        dispatch(addAIMessage({
          tabId: activeTab.id,
          message: {
            role: 'user',
            content: trimmed,
            timestamp: new Date()
          }
        }));
        
        // Provide feedback on low confidence routing
        if (routingResult.confidence < 0.8) {
          console.log(`💡 Note: If you meant to run a command, try: "${trimmed}" directly`);
        }
        
        try {
          // Start AI request with enhanced context
          const startTime = Date.now();
          
          // Enhanced prompt with routing context
          const enhancedPrompt = `User Query: ${trimmed}\n\nContext: Terminal session in ${activeTab.workingDirectory} using ${activeTab.shell}\nRouting confidence: ${(routingResult.confidence * 100).toFixed(1)}%\nReason: ${routingResult.reason}`;
          
          console.log('🚀 Sending AI request...');
          
          // Send to AI with enhanced context
          const aiResponse = await invoke('ai_chat_with_memory', {
            message: trimmed,
            conversationId: activeTab.id,
            context: enhancedPrompt
          }) as string;
          
          const responseTime = Date.now() - startTime;
          console.log(`✅ AI response received in ${responseTime}ms`);
          
          // Add AI response
          dispatch(addAIMessage({
            tabId: activeTab.id,
            message: {
              role: 'assistant',
              content: aiResponse,
              timestamp: new Date(),
              metadata: {
                response_time_ms: responseTime,
                context_type: 'enhanced',
                routing_confidence: routingResult.confidence
              }
            }
          }));
          
          // Call optional callback with AI response
          if (onAIResponse) {
            onAIResponse(aiResponse);
          }
          
        } catch (error) {
          console.error('❌ AI request failed:', error);
          
          const errorMessage = `❌ Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`;
          
          dispatch(addAIMessage({
            tabId: activeTab.id,
            message: {
              role: 'assistant',
              content: errorMessage,
              timestamp: new Date(),
              metadata: { error: true }
            }
          }));
          
          if (onAIResponse) {
            onAIResponse(errorMessage);
          }
        }
      }
    } catch (routingError) {
      console.error('❌ Command routing failed, using fallback:', routingError);
      
      // Fallback to simple heuristic when routing service fails
      if (isShellCommand(trimmed)) {
        if (activeTab.terminalId) {
          try {
            console.log(`🐚 Fallback shell execution: ${trimmed}`);
            await invoke('write_to_terminal', { 
              terminalId: activeTab.terminalId, 
              data: trimmed + '\r' 
            });
          } catch (error) {
            console.error('Fallback shell execution failed:', error);
          }
        }
      } else {
        // Fallback AI handling
        dispatch(addAIMessage({
          tabId: activeTab.id,
          message: {
            role: 'user',
            content: trimmed,
            timestamp: new Date()
          }
        }));
        
        if (onAIResponse) {
          onAIResponse(`Processing your request: "${trimmed}"`);
        }
      }
    }
  }, [activeTab, isShellCommand, dispatch]);

  return {
    handleInput,
    isShellCommand
  };
};
