import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { combineReducers } from '@reduxjs/toolkit';

import connectionReducer from './connectionSlice';
import authReducer from './authSlice';
import systemReducer from './systemSlice';
import filesReducer from './filesSlice';
import terminalReducer from './terminalSlice';
import ecosystemReducer from './ecosystemSlice';

import { RootState } from '@/types';

const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['connection', 'auth'], // Only persist connection and auth data
};

const rootReducer = combineReducers({
  connection: connectionReducer,
  auth: authReducer,
  system: systemReducer,
  files: filesReducer,
  terminal: terminalReducer,
  ecosystem: ecosystemReducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
});

export const persistor = persistStore(store);

export type AppDispatch = typeof store.dispatch;
export type { RootState };
