import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { SystemMetrics, Process, Service } from '@/types';
import { systemService } from '@/services/systemService';

interface SystemState {
  metrics: SystemMetrics | null;
  processes: Process[];
  services: Service[];
  lastUpdate: string | null;
  loading: boolean;
}

const initialState: SystemState = {
  metrics: null,
  processes: [],
  services: [],
  lastUpdate: null,
  loading: false,
};

// Async thunks
export const fetchSystemMetrics = createAsyncThunk(
  'system/fetchMetrics',
  async (_, { rejectWithValue }) => {
    try {
      const metrics = await systemService.getMetrics();
      return metrics;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch system metrics');
    }
  }
);

export const fetchProcesses = createAsyncThunk(
  'system/fetchProcesses',
  async (_, { rejectWithValue }) => {
    try {
      const processes = await systemService.getProcesses();
      return processes;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch processes');
    }
  }
);

export const fetchServices = createAsyncThunk(
  'system/fetchServices',
  async (_, { rejectWithValue }) => {
    try {
      const services = await systemService.getServices();
      return services;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch services');
    }
  }
);

export const killProcess = createAsyncThunk(
  'system/killProcess',
  async (pid: number, { rejectWithValue }) => {
    try {
      await systemService.killProcess(pid);
      return pid;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to kill process');
    }
  }
);

export const controlService = createAsyncThunk(
  'system/controlService',
  async ({ name, action }: { name: string; action: 'start' | 'stop' | 'restart' }, { rejectWithValue }) => {
    try {
      await systemService.controlService(name, action);
      return { name, action };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to control service');
    }
  }
);

const systemSlice = createSlice({
  name: 'system',
  initialState,
  reducers: {
    updateMetrics: (state, action: PayloadAction<SystemMetrics>) => {
      state.metrics = action.payload;
      state.lastUpdate = new Date().toISOString();
    },
    updateProcesses: (state, action: PayloadAction<Process[]>) => {
      state.processes = action.payload;
    },
    updateServices: (state, action: PayloadAction<Service[]>) => {
      state.services = action.payload;
    },
    removeProcess: (state, action: PayloadAction<number>) => {
      state.processes = state.processes.filter(p => p.pid !== action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch metrics cases
      .addCase(fetchSystemMetrics.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchSystemMetrics.fulfilled, (state, action) => {
        state.metrics = action.payload;
        state.lastUpdate = new Date().toISOString();
        state.loading = false;
      })
      .addCase(fetchSystemMetrics.rejected, (state) => {
        state.loading = false;
      })
      // Fetch processes cases
      .addCase(fetchProcesses.fulfilled, (state, action) => {
        state.processes = action.payload;
      })
      // Fetch services cases
      .addCase(fetchServices.fulfilled, (state, action) => {
        state.services = action.payload;
      })
      // Kill process cases
      .addCase(killProcess.fulfilled, (state, action) => {
        state.processes = state.processes.filter(p => p.pid !== action.payload);
      });
  },
});

export const {
  updateMetrics,
  updateProcesses,
  updateServices,
  removeProcess,
} = systemSlice.actions;

export default systemSlice.reducer;
