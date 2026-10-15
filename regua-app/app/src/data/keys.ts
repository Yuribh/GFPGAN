// Headers for Supabase's public key. Legacy anon keys are JWTs and also go in Authorization; the newer publishable
// keys (sb_publishable_...) are not JWTs and must only go in apikey, or the gateway rejects the request.
export function publicKeyHeaders(key: string): Record<string, string> {
  return key.startsWith('eyJ') ? { apikey: key, authorization: `Bearer ${key}` } : { apikey: key };
}
