import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { TerminalSession, CommandHistory } from '@/types';
import { terminalService } from '@/services/terminalService';

interface TerminalState {
  sessions: TerminalSession[];
  activeSession: string | null;
  history: CommandHistory[];
  output: string;
  loading: boolean;
}

const initialState: TerminalState = {
  sessions: [],
  activeSession: null,
  history: [],
  output: '',
  loading: false,
};

// Async thunks
export const createSession = createAsyncThunk(
  'terminal/createSession',
  async (name: string, { rejectWithValue }) => {
    try {
      const session = await terminalService.createSession(name);
      return session;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to create session');
    }
  }
);

export const executeCommand = createAsyncThunk(
  'terminal/executeCommand',
  async ({ sessionId, command }: { sessionId: string; command: string }, { rejectWithValue }) => {
    try {
      const result = await terminalService.executeCommand(sessionId, command);
      return result;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to execute command');
    }
  }
);

export const terminateSession = createAsyncThunk(
  'terminal/terminateSession',
  async (sessionId: string, { rejectWithValue }) => {
    try {
      await terminalService.terminateSession(sessionId);
      return sessionId;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to terminate session');
    }
  }
);

export const fetchHistory = createAsyncThunk(
  'terminal/fetchHistory',
  async (sessionId: string, { rejectWithValue }) => {
    try {
      const history = await terminalService.getHistory(sessionId);
      return history;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch history');
    }
  }
);

const terminalSlice = createSlice({
  name: 'terminal',
  initialState,
  reducers: {
    setActiveSession: (state, action: PayloadAction<string>) => {
      state.activeSession = action.payload;
    },
    appendOutput: (state, action: PayloadAction<string>) => {
      state.output += action.payload;
    },
    clearOutput: (state) => {
      state.output = '';
    },
    addHistoryEntry: (state, action: PayloadAction<CommandHistory>) => {
      state.history.push(action.payload);
    },
    updateSessionActivity: (state, action: PayloadAction<string>) => {
      const session = state.sessions.find(s => s.id === action.payload);
      if (session) {
        session.lastActivity = new Date().toISOString();
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Create session cases
      .addCase(createSession.pending, (state) => {
        state.loading = true;
      })
      .addCase(createSession.fulfilled, (state, action) => {
        state.sessions.push(action.payload);
        state.activeSession = action.payload.id;
        state.loading = false;
      })
      .addCase(createSession.rejected, (state) => {
        state.loading = false;
      })
      // Execute command cases
      .addCase(executeCommand.fulfilled, (state, action) => {
        state.history.push(action.payload);
        // Update session activity
        const session = state.sessions.find(s => s.id === action.payload.sessionId);
        if (session) {
          session.lastActivity = new Date().toISOString();
        }
      })
      // Terminate session cases
      .addCase(terminateSession.fulfilled, (state, action) => {
        state.sessions = state.sessions.filter(s => s.id !== action.payload);
        if (state.activeSession === action.payload) {
          state.activeSession = state.sessions.length > 0 ? state.sessions[0].id : null;
        }
      })
      // Fetch history cases
      .addCase(fetchHistory.fulfilled, (state, action) => {
        state.history = action.payload;
      });
  },
});

export const {
  setActiveSession,
  appendOutput,
  clearOutput,
  addHistoryEntry,
  updateSessionActivity,
} = terminalSlice.actions;

export default terminalSlice.reducer;
