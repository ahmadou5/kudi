const ONES = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const SCALES = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];

function chunkToWords(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest) {
    if (hundreds) parts.push('and');
    if (rest < 20) {
      parts.push(ONES[rest]);
    } else {
      const t = TENS[Math.floor(rest / 10)];
      const o = rest % 10;
      parts.push(o ? `${t}-${ONES[o]}` : t);
    }
  }
  return parts.join(' ');
}

/** Converts a whole number to English words, e.g. 1000 -> "One Thousand". */
export function numberToWords(value: number): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return 'Zero';
  const words: string[] = [];
  let scale = 0;
  while (n > 0 && scale < SCALES.length) {
    const chunk = n % 1000;
    if (chunk) {
      const label = SCALES[scale];
      words.unshift(label ? `${chunkToWords(chunk)} ${label}` : chunkToWords(chunk));
    }
    n = Math.floor(n / 1000);
    scale += 1;
  }
  return words.join(' ');
}

/** "One Thousand naira only" / "One Thousand naira, Fifty kobo only" */
export function nairaInWords(amount: number): string {
  const naira = Math.floor(amount);
  const kobo = Math.round((amount - naira) * 100);
  const base = `${numberToWords(naira)} naira`;
  return kobo > 0 ? `${base}, ${numberToWords(kobo)} kobo only` : `${base} only`;
}
