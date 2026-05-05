import { useCallback } from 'react';

import { useAppSelector } from '../store/hooks';
import { translate, type TxKey } from './translate';

export function useT() {
  const locale = useAppSelector((s) => s.ui.locale);

  return useCallback(
    (key: TxKey, params?: Record<string, string | number>) =>
      translate(locale, key, params),
    [locale],
  );
}
