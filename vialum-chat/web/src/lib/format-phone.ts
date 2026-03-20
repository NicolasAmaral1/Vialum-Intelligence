/**
 * Formats a Brazilian phone number for display.
 * 5543999452151 → +55 (43) 99945-2151
 */
export function formatPhoneBR(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 13 && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4);
    const part1 = digits.slice(4, 9);
    const part2 = digits.slice(9, 13);
    return `+55 (${ddd}) ${part1}-${part2}`;
  }

  if (digits.length === 12 && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4);
    const part1 = digits.slice(4, 8);
    const part2 = digits.slice(8, 12);
    return `+55 (${ddd}) ${part1}-${part2}`;
  }

  if (digits.length === 11) {
    const ddd = digits.slice(0, 2);
    const part1 = digits.slice(2, 7);
    const part2 = digits.slice(7, 11);
    return `+55 (${ddd}) ${part1}-${part2}`;
  }

  return `+${digits}`;
}
