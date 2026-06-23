export const PROFANITY_LIST = [
  'fuck', 'shit', 'bitch', 'ass', 'damn', 'bastard', 'cock', 'dick', 'pussy',
  'whore', 'slut', 'nigger', 'nigga', 'fag', 'faggot', 'retard', 'cunt', 'piss',
  'motherfucker', 'bullshit', 'jackass', 'wanker', 'twat', 'bollocks', 'bugger',
  'arse', 'crap', 'dildo', 'penis', 'vagina', 'orgasm', 'porn',
];

const PROFANITY_REGEX = new RegExp(
  PROFANITY_LIST.map((word) => `\\b${word}\\b`).join('|'),
  'i',
);

export function containsProfanity(text: string): boolean {
  return PROFANITY_REGEX.test(text);
}

export function sanitizeProfanity(text: string): string {
  return text.replace(PROFANITY_REGEX, (match) => '*'.repeat(match.length));
}
