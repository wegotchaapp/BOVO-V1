/**
 * Blocks personal contact info in public trip replies (Option A).
 * Private group chat is available only after payment.
 */
const PII_CHECKS: { label: string; pattern: RegExp }[] = [
  {
    label: 'email address',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/i,
  },
  {
    label: 'phone number',
    // Require separators or a full 10-digit run so dates/prices are not blocked.
    pattern:
      /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s])\d{3}[-.\s]\d{4}\b|\b\d{10}\b/,
  },
  {
    label: 'social handle',
    pattern: /@[A-Za-z0-9_.]{3,}/,
  },
  {
    label: 'street address',
    pattern:
      /\b\d{1,5}\s+[A-Za-z0-9.'-]+\s+(?:st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|ct|court|way|pkwy|parkway|hwy|highway)\b/i,
  },
  {
    label: 'credit card number',
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/,
  },
  {
    label: 'SSN',
    pattern: /\b\d{3}-\d{2}-\d{4}\b/,
  },
];

const CONTACT_PHRASE =
  /\b(?:call|text|whatsapp|telegram|signal|dm|message)\s+me\b|\bmy\s+(?:number|phone|cell|email|address)\s+is\b/i;

export function findPublicReplyPii(text: string): string | null {
  const normalized = text.trim();
  if (!normalized) return null;

  for (const check of PII_CHECKS) {
    if (check.pattern.test(normalized)) return check.label;
  }
  if (CONTACT_PHRASE.test(normalized) && /\d/.test(normalized)) {
    return 'personal contact details';
  }
  return null;
}

export function assertNoPublicReplyPii(text: string): void {
  const hit = findPublicReplyPii(text);
  if (hit) {
    throw new Error(
      `Public replies cannot include ${hit}. Book your seat to chat privately with the Voyager.`,
    );
  }
}
