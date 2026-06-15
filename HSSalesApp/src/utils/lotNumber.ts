const BD = '০১২৩৪৫৬৭৮৯';
const BN_MONTHS = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রি', 'মে', 'জুন', 'জুলা', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'];

function toBengali(n: number, pad = 2): string {
  return String(n).padStart(pad, '0').split('').map((d) => BD[Number(d)]).join('');
}

/**
 * Generates a Bengali lot number with year.
 * Example: লট-০৫-জুন-২৬-০৪২
 */
export function generateBengaliLotNumber(): string {
  const now = new Date();
  const day = toBengali(now.getDate());
  const month = BN_MONTHS[now.getMonth()];
  const year2 = toBengali(now.getFullYear() % 100);
  const seq = toBengali(Math.floor(Math.random() * 999) + 1, 3);
  return `লট-${day}-${month}-${year2}-${seq}`;
}
