import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface TerminalState {
  terminals: {
    [id: string]: {
      id: string;
      title: string;
      isActive: boolean;
      history: string[];
    };
  };
  activeTerminalId: string | null;
  isLoading: boolean;
}

const initialState: TerminalState = {
  terminals: {},
  activeTerminalId: null,
  isLoading: false,
};

const terminalSlice = createSlice({
  name: 'terminal',
  initialState,
  reducers: {
    createTerminal: (state, action: PayloadAction<{ id: string; title?: string }>) => {
      const { id, title = `Terminal ${Object.keys(state.terminals).length + 1}` } = action.payload;
      state.terminals[id] = {
        id,
        title,
        isActive: false,
        history: [],
      };
      if (!state.activeTerminalId) {
        state.activeTerminalId = id;
        state.terminals[id].isActive = true;
      }
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
  },
});

export const { createTerminal, setActiveTerminal, addOutput, closeTerminal, setLoading } = terminalSlice.actions;
export default terminalSlice.reducer;
