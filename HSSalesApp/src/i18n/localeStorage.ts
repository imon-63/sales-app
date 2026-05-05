import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AppLocale } from '../store/slices/uiSlice';

const KEY = '@hssales/locale';

export async function readStoredLocale(): Promise<AppLocale | null> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v === 'en' || v === 'bn') return v;
  } catch {
    /* ignore */
  }
  return null;
}

export async function persistAppLocale(locale: AppLocale): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, locale);
  } catch {
    /* ignore */
  }
}
