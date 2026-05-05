import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type ToastType = 'success' | 'error' | 'info';

export type AppLocale = 'en' | 'bn';

interface ToastState {
  visible: boolean;
  title: string;
  message: string;
  type: ToastType;
}

interface UiState {
  locale: AppLocale;
  toast: ToastState;
}

const initialState: UiState = {
  locale: 'en',
  toast: {
    visible: false,
    title: '',
    message: '',
    type: 'success',
  },
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setLocale(state, action: PayloadAction<AppLocale>) {
      state.locale = action.payload;
    },
    showToast: (
      state,
      action: PayloadAction<{ title: string; message: string; type?: ToastType }>,
    ) => {
      state.toast = {
        visible: true,
        title: action.payload.title,
        message: action.payload.message,
        type: action.payload.type ?? 'success',
      };
    },
    hideToast: (state) => {
      state.toast.visible = false;
    },
  },
});

export const { setLocale, showToast, hideToast } = uiSlice.actions;
export const uiReducer = uiSlice.reducer;
