/**
 * Contact display utilities.
 *
 * Display name hierarchy: customName > crmName > name (pushName) > formatted phone
 * Phone formatting: 5543999452151 → +55 (43) 99945-2151
 */

export function formatPhoneBR(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');

  // Brazilian mobile: 55 + DDD(2) + 9 + 8 digits = 13 digits
  if (digits.length === 13 && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4);
    const part1 = digits.slice(4, 9);
    const part2 = digits.slice(9, 13);
    return `+55 (${ddd}) ${part1}-${part2}`;
  }

  // Brazilian landline: 55 + DDD(2) + 8 digits = 12 digits
  if (digits.length === 12 && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4);
    const part1 = digits.slice(4, 8);
    const part2 = digits.slice(8, 12);
    return `+55 (${ddd}) ${part1}-${part2}`;
  }

  // Brazilian without country code: 11 digits (mobile)
  if (digits.length === 11) {
    const ddd = digits.slice(0, 2);
    const part1 = digits.slice(2, 7);
    const part2 = digits.slice(7, 11);
    return `+55 (${ddd}) ${part1}-${part2}`;
  }

  // Fallback: just add + prefix
  return `+${digits}`;
}

export interface ContactWithNames {
  name: string;
  customName?: string | null;
  crmName?: string | null;
  phone?: string | null;
}

/**
 * Returns the display name following the hierarchy:
 * customName > crmName > name (pushName) > formatted phone > "Sem nome"
 */
export function getDisplayName(contact: ContactWithNames): string {
  if (contact.customName?.trim()) return contact.customName.trim();
  if (contact.crmName?.trim()) return contact.crmName.trim();
  if (contact.name?.trim() && !/^\d+$/.test(contact.name.trim())) return contact.name.trim();
  if (contact.phone) return formatPhoneBR(contact.phone);
  return contact.name || 'Sem nome';
}
