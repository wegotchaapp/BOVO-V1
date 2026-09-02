const fs = require('node:fs');
const path = require('node:path');

const envFile = path.resolve(process.argv[2] ?? '.env');
const managedKeys = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'STRIPE_SECRET_KEY',
  'APP_ENV',
  'APP_URL',
  'ALLOWED_ORIGINS',
  'LOG_LEVEL',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'TWILIO_VERIFY_SERVICE_SID',
  'RESEND_API_KEY',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
];

const source = fs.readFileSync(envFile, 'utf8');
const foundKeys = new Set();
const output = source.replace(/^([A-Z][A-Z0-9_]*)=.*$/gm, (line, key) => {
  foundKeys.add(key);

  if (!managedKeys.includes(key) || !Object.hasOwn(process.env, key)) {
    return line;
  }

  // JSON string syntax is accepted by dotenv and safely represents delimiter,
  // quote, backslash, and newline characters without exposing their values.
  return `${key}=${JSON.stringify(process.env[key])}`;
});

const missingKeys = managedKeys.filter(
  (key) => Object.hasOwn(process.env, key) && !foundKeys.has(key),
);

if (missingKeys.length > 0) {
  throw new Error(
    `The deployment environment template is missing: ${missingKeys.join(', ')}`,
  );
}

fs.writeFileSync(envFile, output);
