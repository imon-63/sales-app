/** Always formats as ৳ + locale-formatted number (never "BDT" prefix). */
export function makeMoney(
  locale: string,
  minFractions = 0,
  maxFractions = 0,
): { format: (n: number) => string } {
  const fmt = new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en-BD', {
    minimumFractionDigits: minFractions,
    maximumFractionDigits: maxFractions,
  });
  return { format: (n: number) => '৳' + fmt.format(n) };
}
