import { configureStore } from '@reduxjs/toolkit';

import { authReducer } from './slices/authSlice';
import { inventoryReducer } from './slices/inventorySlice';
import { notificationsReducer } from './slices/notificationsSlice';
import { salesDataReducer } from './slices/salesDataSlice';
import { uiReducer } from './slices/uiSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    salesData: salesDataReducer,
    notifications: notificationsReducer,
    inventory: inventoryReducer,
    ui: uiReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
