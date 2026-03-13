/**
 * Normalize phone numbers to a consistent format for alias lookup.
 * Strips all non-digit characters except leading +.
 * Returns digits-only (e.g. "5511999887766") for storage and comparison.
 */
export function normalizePhone(phone: string): string {
  // Remove everything except digits
  const digits = phone.replace(/\D/g, '');

  // Brazilian numbers without country code:
  // 11 digits: DDD (2) + 9 + number (8) — e.g. 11999887766 (mobile, 3rd digit is 9)
  // 10 digits: DDD (2) + number (8) — e.g. 1133445566 (landline)
  // 13 digits starting with 55: already has country code
  if (digits.length === 11 && digits[2] === '9') {
    return `55${digits}`;
  }
  if (digits.length === 10) {
    return `55${digits}`;
  }

  return digits;
}

/**
 * Format phone to E.164 (with +) for display.
 */
export function toE164(phone: string): string {
  const digits = normalizePhone(phone);
  return `+${digits}`;
}

/**
 * Format phone for WhatsApp API consumption (any provider: Evolution, Cloud API, Uzapi, etc).
 * Brazilian mobile: removes the 9th digit → 55 + DDD(2) + 8 digits = 12 digits.
 * Brazilian landline: keeps as-is → 55 + DDD(2) + 8 digits = 12 digits.
 * Non-Brazilian: returns normalized digits as-is.
 *
 * Examples:
 *   "5543999560095" → "554399560095"  (mobile, 9th digit removed)
 *   "+55 (21) 98359-0876" → "552183590876"  (mobile, 9th digit removed)
 *   "5511333445566" → "5511333445566"  (landline, unchanged — no leading 9 after DDD)
 *   "1234567890" → "1234567890"  (non-BR, unchanged)
 */
export function toWhatsApp(phone: string): string {
  const digits = normalizePhone(phone);

  // Brazilian number: 55 + DDD(2) + 9 + 8 digits = 13 digits
  if (digits.length === 13 && digits.startsWith('55') && digits[4] === '9') {
    return digits.slice(0, 4) + digits.slice(5); // remove the 9th digit
  }

  return digits;
}
