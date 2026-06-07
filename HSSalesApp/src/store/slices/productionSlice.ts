import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as productionApi from '../../api/production';
import type { Production } from '../../types/models';
import { clearSession } from './authSlice';

type ThunkState = { auth: { token: string | null } };

export type ProductionState = {
  productions: Production[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
};

const initialState: ProductionState = { productions: [], status: 'idle', error: null };

export const fetchProductions = createAsyncThunk<Production[], void, { state: ThunkState }>(
  'production/fetch',
  async (_, { getState, rejectWithValue }) => {
    const token = getState().auth.token;
    if (!token) return rejectWithValue('Not signed in');
    try { return await productionApi.fetchProductions(token); }
    catch (e: any) { return rejectWithValue(e?.message ?? 'Error'); }
  },
);

const productionSlice = createSlice({
  name: 'production',
  initialState,
  reducers: {
    upsertProduction(state, action) {
      const idx = state.productions.findIndex(p => p.id === action.payload.id);
      if (idx >= 0) state.productions[idx] = action.payload;
      else state.productions.unshift(action.payload);
    },
    removeProduction(state, action) {
      state.productions = state.productions.filter(p => p.id !== action.payload);
    },
  },
  extraReducers: builder => {
    builder.addCase(clearSession, () => ({ ...initialState }));
    builder
      .addCase(fetchProductions.pending, state => { state.status = 'loading'; })
      .addCase(fetchProductions.fulfilled, (state, action) => { state.status = 'succeeded'; state.productions = action.payload; })
      .addCase(fetchProductions.rejected, (state, action) => { state.status = 'failed'; state.error = String(action.payload ?? 'Error'); });
  },
});

export const { upsertProduction, removeProduction } = productionSlice.actions;
export const productionReducer = productionSlice.reducer;
