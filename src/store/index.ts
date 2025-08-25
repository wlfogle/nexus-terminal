import { configureStore } from '@reduxjs/toolkit';
import terminalReducer from './slices/terminalSlice';
import aiReducer from './slices/aiSlice';

export const store = configureStore({
  reducer: {
    terminal: terminalReducer,
    ai: aiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['terminal/addOutput'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
