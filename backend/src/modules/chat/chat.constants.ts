export const CONTACT_INFO_PATTERNS: Record<string, RegExp> = {
  phone: /(\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}|\b\d{10}\b)/g,
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  social_handle: /(?:@|handle:|username:|id:)\s*[a-zA-Z0-9_.]{3,}/gi,
  whatsapp_keyword: /whatsapp/gi,
  telegram_keyword: /telegram/gi,
  instagram_keyword: /instagram|insta|ig\s*[:@]/gi,
  snapchat_keyword: /snapchat|snap\s*[:@]/gi,
  facebook_keyword: /facebook|fb\s*[:@]|m\.me\//gi,
  signal_keyword: /signal\s*[:@]/gi,
  discord_keyword: /discord\s*[:@|#]/gi,
  website_url:
    /https?:\/\/(?!wegotcha\.app)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/\S*)?/g,
  venmo_keyword: /venmo/gi,
  cashapp_keyword: /cash\s*app|cashapp|(\$[a-zA-Z0-9_]{2,})/gi,
} as const;

export const HARASSMENT_PATTERNS: Record<string, RegExp> = {
  repeated_insults:
    /\b(shut up|stupid|idiot|moron|dumb|ugly|fat|worthless)\b/gi,
  threats:
    /\b(i'?ll? (hurt|kill|beat|find you|come for)|you better|watch your back|you'?re dead)\b/gi,
  sexual_harassment:
    /\b(sexy|hot|naked|porn|fuck|dick|pussy|ass|cock|slut|whore|bitch)\b/gi,
  repeated_messages: /\b(.{3,})\s+\1\s+\1\b/s,
  all_caps_message: /^[A-Z\s!@#$%^&*(),.?":{}|<>]{10,}$/g,
} as const;

export const SCAM_PATTERNS: Record<string, RegExp> = {
  payment_request:
    /\b(send\s*me\s*\$|pay\s*me|wire\s*transfer|gift\s*card|crypto|bitcoin|venmo\s*me|cashapp)\b/gi,
  urgency_pressure:
    /\b(urgent|emergency|immediately|right now|act fast|last chance|hurry)\b/gi,
  fake_support:
    /\b(support team|customer service|verify your account|confirm identity|click this link)\b/gi,
} as const;
