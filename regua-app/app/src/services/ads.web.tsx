// Web has no ads SDK: same API as ads.tsx, doing nothing.
export const adsAvailable = false;
export async function adPrivacyOptionsRequired(): Promise<boolean> { return false; }
export async function openAdPrivacyOptions(): Promise<void> {}
export function AdBanner() { return null; }
