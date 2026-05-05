import { bn } from './bn';
import { en, type TxKey } from './en';
import type { AppLocale } from '../store/slices/uiSlice';

export type { TxKey };

export function translate(
  locale: AppLocale,
  key: TxKey,
  params?: Record<string, string | number>,
): string {
  const table = locale === 'bn' ? bn : en;
  let out: string = (table[key] as string) ?? (en[key] as string) ?? String(key);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      out = out.split(`{{${k}}}`).join(String(v));
    }
  }
  return out;
}
