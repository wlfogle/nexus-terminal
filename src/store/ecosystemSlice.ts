import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { AIInsight, Recommendation, SystemPattern, Prediction } from '@/types';
import { ecosystemService } from '@/services/ecosystemService';

interface EcosystemState {
  insights: AIInsight[];
  recommendations: Recommendation[];
  patterns: SystemPattern[];
  predictions: Prediction[];
  loading: boolean;
}

const initialState: EcosystemState = {
  insights: [],
  recommendations: [],
  patterns: [],
  predictions: [],
  loading: false,
};

// Async thunks
export const fetchInsights = createAsyncThunk(
  'ecosystem/fetchInsights',
  async (_, { rejectWithValue }) => {
    try {
      const insights = await ecosystemService.getInsights();
      return insights;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch insights');
    }
  }
);

export const fetchRecommendations = createAsyncThunk(
  'ecosystem/fetchRecommendations',
  async (_, { rejectWithValue }) => {
    try {
      const recommendations = await ecosystemService.getRecommendations();
      return recommendations;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch recommendations');
    }
  }
);

export const fetchPatterns = createAsyncThunk(
  'ecosystem/fetchPatterns',
  async (_, { rejectWithValue }) => {
    try {
      const patterns = await ecosystemService.getPatterns();
      return patterns;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch patterns');
    }
  }
);

export const fetchPredictions = createAsyncThunk(
  'ecosystem/fetchPredictions',
  async (_, { rejectWithValue }) => {
    try {
      const predictions = await ecosystemService.getPredictions();
      return predictions;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch predictions');
    }
  }
);

const ecosystemSlice = createSlice({
  name: 'ecosystem',
  initialState,
  reducers: {
    addInsight: (state, action: PayloadAction<AIInsight>) => {
      state.insights.push(action.payload);
    },
    removeInsight: (state, action: PayloadAction<string>) => {
      state.insights = state.insights.filter(i => i.id !== action.payload);
    },
    addRecommendation: (state, action: PayloadAction<Recommendation>) => {
      state.recommendations.push(action.payload);
    },
    removeRecommendation: (state, action: PayloadAction<string>) => {
      state.recommendations = state.recommendations.filter(r => r.id !== action.payload);
    },
    clearInsights: (state) => {
      state.insights = [];
    },
    clearRecommendations: (state) => {
      state.recommendations = [];
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch insights cases
      .addCase(fetchInsights.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchInsights.fulfilled, (state, action) => {
        state.insights = action.payload;
        state.loading = false;
      })
      .addCase(fetchInsights.rejected, (state) => {
        state.loading = false;
      })
      // Fetch recommendations cases
      .addCase(fetchRecommendations.fulfilled, (state, action) => {
        state.recommendations = action.payload;
      })
      // Fetch patterns cases
      .addCase(fetchPatterns.fulfilled, (state, action) => {
        state.patterns = action.payload;
      })
      // Fetch predictions cases
      .addCase(fetchPredictions.fulfilled, (state, action) => {
        state.predictions = action.payload;
      });
  },
});

export const {
  addInsight,
  removeInsight,
  addRecommendation,
  removeRecommendation,
  clearInsights,
  clearRecommendations,
} = ecosystemSlice.actions;

export default ecosystemSlice.reducer;
