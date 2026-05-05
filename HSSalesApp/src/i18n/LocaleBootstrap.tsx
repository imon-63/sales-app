import React, { useEffect } from 'react';

import { useAppDispatch } from '../store/hooks';
import { setLocale } from '../store/slices/uiSlice';
import { readStoredLocale } from './localeStorage';

/**
 * Restores saved language before first meaningful paint (async — may follow default briefly).
 */
export function LocaleBootstrap() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    let cancelled = false;
    readStoredLocale().then((l) => {
      if (!cancelled && l) dispatch(setLocale(l));
    });
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  return null;
}
