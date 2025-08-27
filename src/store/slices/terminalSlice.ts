import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface TerminalSession {
  id: string;
  title: string;
  shell: string;
  cwd: string;
  createdAt: string;
  isActive: boolean;
  history: string[];
}

interface TerminalOutput {
  id: string;
  terminalId: string;
  data: string;
  timestamp: number;
  type: 'stdout' | 'stderr' | 'stdin';
}

interface TerminalState {
  terminals: Record<string, TerminalSession>;
  activeTerminalId: string | null;
  output: TerminalOutput[];
  isCreatingTerminal: boolean;
  isLoading: boolean;
  error: string | null;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
}

const initialState: TerminalState = {
  terminals: {},
  activeTerminalId: null,
  output: [],
  isCreatingTerminal: false,
  isLoading: false,
  error: null,
  connectionStatus: 'disconnected',
};

const terminalSlice = createSlice({
  name: 'terminal',
  initialState,
  reducers: {
    createTerminal: (state, action: PayloadAction<{ id: string; title?: string; shell?: string; cwd?: string }>) => {
      const { id, title, shell = 'bash', cwd = '~' } = action.payload;
      const terminalTitle = title || `Terminal ${Object.keys(state.terminals).length + 1}`;
      
      state.terminals[id] = {
        id,
        title: terminalTitle,
        shell,
        cwd,
        createdAt: new Date().toISOString(),
        isActive: false,
        history: [],
      };
      
      // Deactivate other terminals if this is the first or user wants it active
      if (!state.activeTerminalId || action.payload.title) {
        Object.keys(state.terminals).forEach(termId => {
          if (termId !== id) {
            state.terminals[termId].isActive = false;
          }
        });
        state.terminals[id].isActive = true;
        state.activeTerminalId = id;
      }
      
      state.isCreatingTerminal = false;
      state.error = null;
    },
    setActiveTerminal: (state, action: PayloadAction<string>) => {
      // Deactivate all terminals
      Object.values(state.terminals).forEach(terminal => {
        terminal.isActive = false;
      });
      // Activate the selected terminal
      if (state.terminals[action.payload]) {
        state.terminals[action.payload].isActive = true;
        state.activeTerminalId = action.payload;
      }
    },
    addOutput: (state, action: PayloadAction<{ terminalId: string; output: string }>) => {
      const { terminalId, output } = action.payload;
      if (state.terminals[terminalId]) {
        state.terminals[terminalId].history.push(output);
      }
    },
    closeTerminal: (state, action: PayloadAction<string>) => {
      delete state.terminals[action.payload];
      if (state.activeTerminalId === action.payload) {
        const remainingIds = Object.keys(state.terminals);
        state.activeTerminalId = remainingIds.length > 0 ? remainingIds[0] : null;
        if (state.activeTerminalId) {
          state.terminals[state.activeTerminalId].isActive = true;
        }
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    
    addTerminalOutput: (state, action: PayloadAction<Omit<TerminalOutput, 'id' | 'timestamp'>>) => {
      const output: TerminalOutput = {
        ...action.payload,
        id: `output-${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
      };
      state.output.push(output);
      
      // Keep only last 1000 outputs per terminal
      const terminalOutputs = state.output.filter(o => o.terminalId === output.terminalId);
      if (terminalOutputs.length > 1000) {
        state.output = state.output.filter(o => 
          o.terminalId !== output.terminalId || 
          terminalOutputs.slice(-1000).includes(o)
        );
      }
    },
    
    updateTerminalCwd: (state, action: PayloadAction<{ id: string; cwd: string }>) => {
      const { id, cwd } = action.payload;
      if (state.terminals[id]) {
        state.terminals[id].cwd = cwd;
      }
    },
    
    updateTerminalTitle: (state, action: PayloadAction<{ id: string; title: string }>) => {
      const { id, title } = action.payload;
      if (state.terminals[id]) {
        state.terminals[id].title = title;
      }
    },
    
    setCreatingTerminal: (state, action: PayloadAction<boolean>) => {
      state.isCreatingTerminal = action.payload;
    },
    
    setConnectionStatus: (state, action: PayloadAction<'connected' | 'connecting' | 'disconnected'>) => {
      state.connectionStatus = action.payload;
    },
    
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    
    clearOutput: (state, action: PayloadAction<string>) => {
      const terminalId = action.payload;
      state.output = state.output.filter(output => output.terminalId !== terminalId);
    },
  },
});

export const { 
  createTerminal, 
  setActiveTerminal, 
  addOutput, 
  addTerminalOutput,
  closeTerminal, 
  setLoading,
  updateTerminalCwd,
  updateTerminalTitle,
  setCreatingTerminal,
  setConnectionStatus,
  setError,
  clearOutput
} = terminalSlice.actions;

// Selectors
export const selectActiveTerminal = (state: { terminal: TerminalState }) => {
  const { activeTerminalId, terminals } = state.terminal;
  return activeTerminalId ? terminals[activeTerminalId] : null;
};

export const selectTerminalOutput = (terminalId: string) => (state: { terminal: TerminalState }) => {
  return state.terminal.output.filter(output => output.terminalId === terminalId);
};

export const selectAllTerminals = (state: { terminal: TerminalState }) => {
  return Object.values(state.terminal.terminals);
};

export default terminalSlice.reducer;
