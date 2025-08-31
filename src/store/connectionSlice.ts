import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { ConnectionConfig, ConnectionStatus } from '@/types';
import { connectionService } from '@/services/connectionService';

interface ConnectionState {
  status: ConnectionStatus;
  config: ConnectionConfig | null;
  error: string | null;
  lastConnected: string | null;
  profiles: ConnectionConfig[];
}

const initialState: ConnectionState = {
  status: 'disconnected',
  config: null,
  error: null,
  lastConnected: null,
  profiles: [],
};

// Async thunks
export const connectToServer = createAsyncThunk(
  'connection/connect',
  async (config: ConnectionConfig, { rejectWithValue }) => {
    try {
      await connectionService.connect(config);
      return config;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to connect');
    }
  }
);

export const disconnectFromServer = createAsyncThunk(
  'connection/disconnect',
  async (_, { rejectWithValue }) => {
    try {
      await connectionService.disconnect();
      return true;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to disconnect');
    }
  }
);

export const autoDiscoverServers = createAsyncThunk(
  'connection/autoDiscover',
  async (_, { rejectWithValue }) => {
    try {
      const servers = await connectionService.autoDiscover();
      return servers;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Auto-discovery failed');
    }
  }
);

const connectionSlice = createSlice({
  name: 'connection',
  initialState,
  reducers: {
    setConnectionStatus: (state, action: PayloadAction<ConnectionStatus>) => {
      state.status = action.payload;
    },
    setConnectionError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    addConnectionProfile: (state, action: PayloadAction<ConnectionConfig>) => {
      const existingIndex = state.profiles.findIndex(p => p.id === action.payload.id);
      if (existingIndex >= 0) {
        state.profiles[existingIndex] = action.payload;
      } else {
        state.profiles.push(action.payload);
      }
    },
    removeConnectionProfile: (state, action: PayloadAction<string>) => {
      state.profiles = state.profiles.filter(p => p.id !== action.payload);
    },
    clearConnectionError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Connect cases
      .addCase(connectToServer.pending, (state) => {
        state.status = 'connecting';
        state.error = null;
      })
      .addCase(connectToServer.fulfilled, (state, action) => {
        state.status = 'connected';
        state.config = action.payload;
        state.lastConnected = new Date().toISOString();
        state.error = null;
      })
      .addCase(connectToServer.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.payload as string;
      })
      // Disconnect cases
      .addCase(disconnectFromServer.pending, (state) => {
        state.status = 'disconnected';
      })
      .addCase(disconnectFromServer.fulfilled, (state) => {
        state.status = 'disconnected';
        state.config = null;
        state.error = null;
      })
      .addCase(disconnectFromServer.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.payload as string;
      });
  },
});

export const {
  setConnectionStatus,
  setConnectionError,
  addConnectionProfile,
  removeConnectionProfile,
  clearConnectionError,
} = connectionSlice.actions;

export default connectionSlice.reducer;
