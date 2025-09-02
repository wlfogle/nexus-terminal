import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { invoke } from '@tauri-apps/api/core';
import { TerminalTab } from '../../types/terminal';
import { 
  addError 
} from '../../store/slices/terminalTabSlice';
import EnhancedAIAssistant from '../ai/EnhancedAIAssistant';
import '@xterm/xterm/css/xterm.css';

interface TerminalWithAIProps {
  tab: TerminalTab;
}

export const TerminalWithAI: React.FC<TerminalWithAIProps> = ({ tab }) => {
  const dispatch = useDispatch();
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminal = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const [aiPanelOpen, setAIPanelOpen] = useState(true); // Start in AI mode by default
  const [isTerminalReady, setIsTerminalReady] = useState(false);
  const [mode, setMode] = useState<'ai' | 'shell'>('ai'); // Start in AI mode
  const [inputBuffer, setInputBuffer] = useState('');
  const [aiMessage, setAIMessage] = useState('');

  // Smart command detection - determines if input is a shell command vs AI query
  const isShellCommand = (input: string): boolean => {
    const trimmed = input.trim();
    
    // If it looks like a question or natural language, it's for AI
    if (trimmed.match(/^(what|how|why|when|where|who|can|should|would|could|will|is|are|do|does|did|explain|help|show|tell|describe|please)/i)) {
      return false;
    }
    
    // If it contains question words or conversational phrases, it's for AI
    if (trimmed.match(/\b(help me|explain|show me|tell me|what is|how do|why does|can you|could you|would you)\b/i)) {
      return false;
    }
    
    // Shell command patterns
    const shellCommands = [
      // File operations
      'ls', 'll', 'dir', 'pwd', 'cd', 'mkdir', 'rmdir', 'rm', 'cp', 'mv', 'ln', 'find', 'locate',
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
    
    // Check for explicit shell command patterns first
    if (shellCommands.includes(firstWord)) {
      return true;
    }
    
    // Check for common shell patterns
    if (trimmed.startsWith('./') || trimmed.startsWith('/') || trimmed.startsWith('~/') || 
        trimmed.startsWith('$') || trimmed.startsWith('sudo ')) {
      return true;
    }
    
    // Check for pipe operations
    if (trimmed.includes('|') || trimmed.includes('&&') || trimmed.includes('||')) {
      return true;
    }
    
    // Check for redirection
    if (trimmed.includes('>') || trimmed.includes('<') || trimmed.includes('>>')) {
      return true;
    }
    
    // Check for environment variable assignment
    if (trimmed.match(/^[A-Z_][A-Z0-9_]*=/)) {
      return true;
    }
    
    // Check for filesystem paths
    if (trimmed.match(/^[.~/]/)) {
      return true;
    }
    
    // Default to shell for single words that might be commands
    if (trimmed.split(/\s+/).length === 1 && trimmed.length < 20 && !trimmed.includes('?')) {
      return true;
    }
    
    // Default to AI for longer sentences or questions
    return false;
  };

  // Handle input routing between AI and shell
  const handleInput = async (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return;
    
    if (isShellCommand(trimmed)) {
      // Execute as shell command
      if (tab.terminalId && terminal.current) {
        try {
          // Send to shell
          await invoke('write_to_terminal', { 
            terminalId: tab.terminalId, 
            data: trimmed + '\r' 
          });
        } catch (error) {
          console.error('Failed to execute shell command:', error);
        }
      }
    } else {
      // Send to AI assistant
      if (!aiPanelOpen) {
        setAIPanelOpen(true);
      }
      setAIMessage(trimmed);
    }
  };

  // Memoize terminal theme based on shell type
  const terminalTheme = useMemo(() => {
    const baseTheme = {
      background: '#1a1a1a',
      foreground: '#ffffff',
      cursor: '#ffffff',
      cursorAccent: '#000000',
      selectionBackground: '#ffffff40',
      black: '#000000',
      red: '#ff5555',
      green: '#50fa7b',
      yellow: '#f1fa8c',
      blue: '#bd93f9',
      magenta: '#ff79c6',
      cyan: '#8be9fd',
      white: '#bfbfbf',
      brightBlack: '#4d4d4d',
      brightRed: '#ff6e6e',
      brightGreen: '#69ff94',
      brightYellow: '#ffffa5',
      brightBlue: '#d6acff',
      brightMagenta: '#ff92df',
      brightCyan: '#a4ffff',
      brightWhite: '#ffffff',
    };

    // Customize theme based on shell type
    switch (tab.shell) {
      case 'fish':
        return { ...baseTheme, blue: '#00ADD8', cyan: '#00ADD8' };
      case 'zsh':
        return { ...baseTheme, green: '#F15A29', brightGreen: '#F15A29' };
      case 'powershell':
        return { ...baseTheme, blue: '#012456', brightBlue: '#5391FE' };
      default:
        return baseTheme;
    }
  }, [tab.shell]);

  // Memoize terminal options
  const terminalOptions = useMemo(() => ({
    theme: terminalTheme,
    fontFamily: 'JetBrains Mono, Monaco, Menlo, "Ubuntu Mono", monospace',
    fontSize: 14,
    fontWeight: 'normal' as const,
    lineHeight: 1.2,
    letterSpacing: 0,
    cursorBlink: true,
    cursorStyle: 'block' as const,
    scrollback: 10000,
    tabStopWidth: 4,
    allowProposedApi: true
  }), [terminalTheme]);

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current || !tab.terminalId) return;

    // Create terminal instance
    terminal.current = new Terminal(terminalOptions);
    
    // Add addons
    fitAddon.current = new FitAddon();
    terminal.current.loadAddon(fitAddon.current);
    terminal.current.loadAddon(new WebLinksAddon());
    terminal.current.loadAddon(new SearchAddon());

    // Open terminal
    terminal.current.open(terminalRef.current);
    fitAddon.current.fit();

    // Set up data handler with command history integration
    terminal.current.onData(async (data) => {
      if (tab.terminalId) {
        try {
          await invoke('write_to_terminal', { 
            terminalId: tab.terminalId, 
            data 
          });
          
          // Handle Ctrl+R for command history search
          if (data === '\x12') { // Ctrl+R
            const history = tab.terminalHistory.map(h => h.command).slice(-20);
            if (history.length > 0) {
              const searchPrompt = `\r\n🔍 Command History (${history.length} commands):\r\n${history.map((cmd, i) => `${i + 1}. ${cmd}`).join('\r\n')}\r\n`;
              terminal.current?.write(searchPrompt);
            }
          }
        } catch (error) {
          console.error('Failed to write to terminal:', error);
          dispatch(addError({
            tabId: tab.id,
            error: {
              command: 'write_to_terminal',
              errorMessage: error?.toString() || 'Failed to write to terminal',
              timestamp: new Date(),
              workingDirectory: tab.workingDirectory
            }
          }));
        }
      }
    });

    // Welcome message with AI-first greeting
    terminal.current.writeln('🚀 Welcome to NexusTerminal - AI-First Terminal Assistant');
    terminal.current.writeln('🤖 AI Chat Mode is active by default!');
    terminal.current.writeln('💡 Type commands like "ls -la" to execute shell commands');
    terminal.current.writeln('💬 Type questions like "how do I..." for AI assistance');
    terminal.current.writeln('⚡ Shell: ' + getShellWelcomeMessage(tab.shell).replace(/^.+ Welcome to /, ''));
    terminal.current.writeln('');

    setIsTerminalReady(true);

    return () => {
      if (terminal.current) {
        terminal.current.dispose();
        terminal.current = null;
      }
      setIsTerminalReady(false);
    };
  }, [tab.terminalId, terminalOptions, tab.shell, tab.workingDirectory, tab.id, dispatch]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (fitAddon.current && terminal.current && isTerminalReady) {
        fitAddon.current.fit();
        const { cols, rows } = terminal.current;
        
        if (tab.terminalId) {
          invoke('resize_terminal', { 
            terminalId: tab.terminalId, 
            cols, 
            rows 
          }).catch(error => {
            console.error('Failed to resize terminal:', error);
          });
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isTerminalReady, tab.terminalId]);

  // Focus terminal when tab becomes active
  useEffect(() => {
    if (terminal.current && tab.isActive && isTerminalReady) {
      terminal.current.focus();
    }
  }, [tab.isActive, isTerminalReady]);

  // Force AI panel to open on mount
  useEffect(() => {
    setAIPanelOpen(true);
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+Shift+A - Open AI assistant
      if (event.ctrlKey && event.shiftKey && event.key === 'A') {
        event.preventDefault();
        setAIPanelOpen(true);
      }
      // Ctrl+Shift+F - Search in terminal
      else if (event.ctrlKey && event.shiftKey && event.key === 'F') {
        event.preventDefault();
        if (terminal.current) {
          // Note: XTerm.js addons don't provide getAddon method
          // We'll implement custom search functionality if needed
          console.log('Search functionality not yet implemented');
        }
      }
      // Ctrl+Shift+C - Clear terminal
      else if (event.ctrlKey && event.shiftKey && event.key === 'C') {
        event.preventDefault();
        if (terminal.current) {
          terminal.current.clear();
        }
      }
      // Escape - Close AI panel
      else if (event.key === 'Escape' && aiPanelOpen) {
        event.preventDefault();
        setAIPanelOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);


  const getShellWelcomeMessage = (shell: string): string => {
    switch (shell) {
      case 'fish':
        return '🐟 Welcome to Fish Shell - The friendly interactive shell';
      case 'zsh':
        return '⚡ Welcome to Zsh - The powerful Z shell';
      case 'powershell':
        return '💙 Welcome to PowerShell - Object-based shell';
      case 'bash':
      default:
        return '🐚 Welcome to Bash - The Bourne Again Shell';
    }
  };

  const getQuickActions = () => {
    const actions = [
      {
        icon: '🤖',
        label: 'Ask AI',
        shortcut: 'Ctrl+Shift+A',
        onClick: () => setAIPanelOpen(true),
        highlight: tab.aiContext.errors.length > 0 || tab.aiContext.suggestions.length > 0
      }
    ];

    if (tab.aiContext.errors.length > 0) {
      actions.push({
        icon: '🚨',
        label: `Fix ${tab.aiContext.errors.length} Error${tab.aiContext.errors.length > 1 ? 's' : ''}`,
        shortcut: '',
        onClick: () => {
          // Just open the AI panel - the enhanced assistant will handle error context
          setAIPanelOpen(true);
        },
        highlight: true
      });
    }

    if (tab.aiContext.suggestions.length > 0) {
      actions.push({
        icon: '💡',
        label: `${tab.aiContext.suggestions.length} Suggestion${tab.aiContext.suggestions.length > 1 ? 's' : ''}`,
        shortcut: '',
        onClick: () => setAIPanelOpen(true),
        highlight: true
      });
    }

    return actions;
  };

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Terminal Area */}
      <div className="flex-1 relative">
        {/* XTerm.js Container */}
        <div 
          ref={terminalRef}
          className="absolute inset-0 p-4"
          style={{ 
            backgroundColor: terminalTheme.background,
            fontFamily: terminalOptions.fontFamily 
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }}
          onDrop={(e) => {
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0 && terminal.current) {
              const paths = files.map(f => `"${(f as any).path || f.name}"`).join(' ');
              terminal.current.write(paths);
            }
          }}
        />
        
        {/* Quick Actions Overlay */}
        <div className="absolute bottom-4 right-4 flex flex-col space-y-2">
          {getQuickActions().map((action, index) => (
            <button
              key={index}
              onClick={action.onClick}
              title={`${action.label} ${action.shortcut ? `(${action.shortcut})` : ''}`}
              className={`
                flex items-center px-3 py-2 rounded-lg shadow-lg transition-all duration-200 text-sm
                ${action.highlight 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-gray-800/90 text-gray-200 hover:bg-gray-700'
                }
                backdrop-blur-sm hover:scale-105 hover:shadow-xl
              `}
            >
              <span className="mr-2">{action.icon}</span>
              {action.label}
            </button>
          ))}
        </div>

        {/* Loading overlay */}
        {!isTerminalReady && (
          <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
              <div className="text-gray-400">Initializing {tab.shell} terminal...</div>
            </div>
          </div>
        )}
      </div>

      {/* AI-First Input Interface */}
      {!aiPanelOpen && (
        <div className="bg-gray-800 border-t border-gray-700 p-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-4 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-300 font-medium">AI-First Mode</span>
              </div>
              <button
                onClick={() => setAIPanelOpen(true)}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Open Full Assistant
              </button>
            </div>
            <div className="flex gap-3">
              <input
                type="text"
                value={inputBuffer}
                onChange={(e) => setInputBuffer(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleInput(inputBuffer);
                    setInputBuffer('');
                  }
                }}
                placeholder="Type commands (ls -la) or ask AI questions (how do I...)"
                className="flex-1 px-4 py-2 bg-gray-900 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
              />
              <button
                onClick={() => {
                  if (inputBuffer.trim()) {
                    handleInput(inputBuffer);
                    setInputBuffer('');
                  }
                }}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Send
              </button>
            </div>
            <div className="text-xs text-gray-400 mt-2">
              💡 Smart routing: Shell commands go to terminal, questions go to AI
            </div>
          </div>
        </div>
      )}

      {/* AI Assistant Panel */}
      {aiPanelOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-6xl mx-4 h-[90vh] flex flex-col">
            {/* Window Controls Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800 rounded-t-lg">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-white">🤖 NexusTerminal AI Assistant</h3>
                <div className="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded">
                  AI-First Mode Active
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Minimize button */}
                <button
                  onClick={() => setAIPanelOpen(false)}
                  className="w-6 h-6 rounded-full bg-yellow-500 hover:bg-yellow-600 flex items-center justify-center transition-colors"
                  title="Minimize (Esc)"
                >
                  <span className="text-xs text-black font-bold">−</span>
                </button>
                {/* Maximize button */}
                <button
                  onClick={() => {/* Toggle fullscreen logic could go here */}}
                  className="w-6 h-6 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-colors"
                  title="Maximize"
                >
                  <span className="text-xs text-black font-bold">□</span>
                </button>
                {/* Close button */}
                <button
                  onClick={() => setAIPanelOpen(false)}
                  className="w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
                  title="Close"
                >
                  <span className="text-xs text-white font-bold">✕</span>
                </button>
              </div>
            </div>
            {/* AI Assistant Content with enforced scrolling */}
            <div 
              className="flex-1" 
              style={{
                overflow: 'auto',
                overflowY: 'scroll',
                scrollbarWidth: 'auto',
                scrollbarColor: '#6B7280 #374151'
              }}
            >
              <EnhancedAIAssistant />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
