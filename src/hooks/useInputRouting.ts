import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { invoke } from '@tauri-apps/api/core';
import { selectActiveTab, addAIMessage } from '../store/slices/terminalTabSlice';

export const useInputRouting = () => {
  const dispatch = useDispatch();
  const activeTab = useSelector(selectActiveTab);

  // Smart command detection - determines if input is a shell command vs AI query
  const isShellCommand = useCallback((input: string): boolean => {
    const trimmed = input.trim();
    
    // Explicit AI triggers - these always go to AI
    if (trimmed.match(/^(what|how|why|when|where|who|can|should|would|could|will|is|are|do|does|did|explain|help|show|tell|describe|please)/i)) {
      console.log(`🤖 AI trigger word detected: ${trimmed}`);
      return false;
    }
    
    // AI conversational phrases
    if (trimmed.match(/\b(help me|explain|show me|tell me|what is|how do|why does|can you|could you|would you)\b/i)) {
      console.log(`🤖 AI conversational phrase detected: ${trimmed}`);
      return false;
    }
    
    // Questions with question marks always go to AI
    if (trimmed.includes('?')) {
      console.log(`🤖 Question detected: ${trimmed}`);
      return false;
    }
    
    // Shell command patterns - PRIORITIZE THESE
    const shellCommands = [
      // File operations
      'ls', 'll', 'la', 'dir', 'pwd', 'cd', 'mkdir', 'rmdir', 'rm', 'cp', 'mv', 'ln', 'find', 'locate',
      'touch', 'chmod', 'chown', 'chgrp', 'file', 'stat', 'du', 'df', 'tree',
      
      // Text processing
      'cat', 'less', 'more', 'head', 'tail', 'grep', 'awk', 'sed', 'sort', 'uniq', 'cut', 'tr',
      'wc', 'diff', 'comm', 'join', 'paste', 'split',
      
      // System info
      'ps', 'top', 'htop', 'kill', 'killall', 'jobs', 'nohup', 'screen', 'tmux',
      'who', 'w', 'users', 'id', 'groups', 'sudo', 'su', 'whoami', 'date', 'uptime',
      'uname', 'hostname', 'dmesg', 'lscpu', 'lsmem', 'lsblk', 'lsusb', 'lspci',
      
      // Network
      'ping', 'curl', 'wget', 'ssh', 'scp', 'rsync', 'netstat', 'ss', 'nmap',
      'iptables', 'route', 'ip', 'ifconfig', 'tcpdump', 'nc', 'ncat',
      
      // Package management
      'apt', 'yum', 'dnf', 'pacman', 'yay', 'brew', 'pip', 'npm', 'yarn', 'pnpm',
      'cargo', 'go', 'gem', 'composer', 'conda', 'snap', 'flatpak',
      
      // Development tools
      'git', 'docker', 'docker-compose', 'kubectl', 'helm', 'terraform',
      'make', 'cmake', 'gcc', 'g++', 'clang', 'rustc', 'node', 'python', 'python3',
      'java', 'javac', 'mvn', 'gradle', 'vim', 'nano', 'emacs', 'code',
      
      // Service management
      'systemctl', 'service', 'journalctl', 'systemd-analyze',
      
      // Archive operations
      'tar', 'zip', 'unzip', 'gzip', 'gunzip', 'bzip2', 'bunzip2', '7z',
      
      // Environment
      'env', 'export', 'set', 'unset', 'alias', 'unalias', 'which', 'type', 'whereis',
      'history', 'clear', 'reset', 'source', 'exec', 'eval'
    ];
    
    // Get first word of input
    const firstWord = trimmed.split(/\s+/)[0];
    
    // PRIORITY CHECK: If first word is a known shell command, it's a shell command
    if (shellCommands.includes(firstWord)) {
      console.log(`🐚 Shell command detected by name: ${firstWord}`);
      return true;
    }
    
    // Check for common shell patterns
    if (trimmed.startsWith('./') || trimmed.startsWith('/') || trimmed.startsWith('~/') || 
        trimmed.startsWith('$') || trimmed.startsWith('sudo ')) {
      console.log(`🐚 Shell pattern detected: ${trimmed}`);
      return true;
    }
    
    // Check for pipe operations
    if (trimmed.includes('|') || trimmed.includes('&&') || trimmed.includes('||')) {
      console.log(`🐚 Shell pipe detected: ${trimmed}`);
      return true;
    }
    
    // Check for redirection
    if (trimmed.includes('>') || trimmed.includes('<') || trimmed.includes('>>')) {
      console.log(`🐚 Shell redirection detected: ${trimmed}`);
      return true;
    }
    
    // Check for environment variable assignment
    if (trimmed.match(/^[A-Z_][A-Z0-9_]*=/)) {
      console.log(`🐚 Environment variable detected: ${trimmed}`);
      return true;
    }
    
    // Check for filesystem paths
    if (trimmed.match(/^[.~/]/)) {
      console.log(`🐚 Filesystem path detected: ${trimmed}`);
      return true;
    }
    
    // If it's a short command-like input, likely shell
    if (trimmed.split(/\s+/).length <= 3 && trimmed.length < 40) {
      console.log(`🐚 Short command detected: ${trimmed}`);
      return true;
    }
    
    // Everything else goes to AI
    console.log(`🤖 AI query detected: ${trimmed}`);
    return false;
  }, []);

  // Handle input routing between AI and shell
  const handleInput = useCallback(async (input: string, onAIResponse?: (message: string) => void) => {
    const trimmed = input.trim();
    if (!trimmed || !activeTab) return;
    
    console.log(`🔀 Routing input: "${trimmed}"`);
    
    if (isShellCommand(trimmed)) {
      // Execute as shell command
      if (activeTab.terminalId) {
        try {
          console.log(`🐚 Sending to shell: ${trimmed}`);
          await invoke('write_to_terminal', { 
            terminalId: activeTab.terminalId, 
            data: trimmed + '\r' 
          });
        } catch (error) {
          console.error('Failed to execute shell command:', error);
        }
      }
    } else {
      // Send to AI assistant
      console.log(`🤖 Sending to AI: ${trimmed}`);
      
      // Add user message immediately
      dispatch(addAIMessage({
        tabId: activeTab.id,
        message: {
          role: 'user',
          content: trimmed,
          timestamp: new Date()
        }
      }));
      
      try {
        // Start AI request immediately with minimal context for speed
        const startTime = Date.now();
        
        // Simplified prompt for faster response
        const quickPrompt = `User Query: ${trimmed}\n\nContext: Terminal session in ${activeTab.workingDirectory} using ${activeTab.shell}`;
        
        console.log('🚀 Sending AI request...');
        
        // Send to AI with minimal context for speed
        const aiResponse = await invoke('ai_chat_with_memory', {
          message: trimmed,
          conversationId: activeTab.id,
          context: quickPrompt
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
              context_type: 'minimal'
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
  }, [activeTab, isShellCommand, dispatch]);

  return {
    handleInput,
    isShellCommand
  };
};
