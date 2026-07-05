export function getGoogleClientIds() {
  const web =
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    "";
  const ios = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || web;
  const android = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || web;
  return { web, ios, android, configured: Boolean(web) };
}
