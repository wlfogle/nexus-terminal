import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { AuthMethod, AuthConfig } from '@/types';
import { authService } from '@/services/authService';

interface AuthState {
  method: AuthMethod;
  token?: string;
  credentials?: object;
  isAuthenticated: boolean;
  error: string | null;
}

const initialState: AuthState = {
  method: 'token',
  isAuthenticated: false,
  error: null,
};

// Async thunks
export const authenticateUser = createAsyncThunk(
  'auth/authenticate',
  async (config: AuthConfig, { rejectWithValue }) => {
    try {
      const result = await authService.authenticate(config);
      return result;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Authentication failed');
    }
  }
);

export const refreshToken = createAsyncThunk(
  'auth/refresh',
  async (_, { rejectWithValue }) => {
    try {
      const result = await authService.refreshToken();
      return result;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Token refresh failed');
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await authService.logout();
      return true;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Logout failed');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthMethod: (state, action: PayloadAction<AuthMethod>) => {
      state.method = action.payload;
    },
    setToken: (state, action: PayloadAction<string>) => {
      state.token = action.payload;
    },
    setCredentials: (state, action: PayloadAction<object>) => {
      state.credentials = action.payload;
    },
    clearAuth: (state) => {
      state.token = undefined;
      state.credentials = undefined;
      state.isAuthenticated = false;
      state.error = null;
    },
    clearAuthError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Authenticate cases
      .addCase(authenticateUser.pending, (state) => {
        state.error = null;
      })
      .addCase(authenticateUser.fulfilled, (state, action) => {
        state.isAuthenticated = true;
        state.token = action.payload.token;
        state.credentials = action.payload.credentials;
        state.error = null;
      })
      .addCase(authenticateUser.rejected, (state, action) => {
        state.isAuthenticated = false;
        state.error = action.payload as string;
      })
      // Refresh token cases
      .addCase(refreshToken.fulfilled, (state, action) => {
        state.token = action.payload.token;
      })
      .addCase(refreshToken.rejected, (state, action) => {
        state.error = action.payload as string;
        state.isAuthenticated = false;
      })
      // Logout cases
      .addCase(logout.fulfilled, (state) => {
        state.isAuthenticated = false;
        state.token = undefined;
        state.credentials = undefined;
        state.error = null;
      });
  },
});

export const {
  setAuthMethod,
  setToken,
  setCredentials,
  clearAuth,
  clearAuthError,
} = authSlice.actions;

export default authSlice.reducer;
