import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { User } from '../../types/models';

export type AuthState = {
  token: string | null;
  user: User | null;
};

const initialState: AuthState = {
  token: null,
  user: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSession(
      state,
      action: PayloadAction<{ token: string; user: User }>,
    ) {
      state.token = action.payload.token;
      state.user = action.payload.user;
    },
    clearSession() {
      return initialState;
    },
  },
});

export const { setSession, clearSession } = authSlice.actions;
export const authReducer = authSlice.reducer;
