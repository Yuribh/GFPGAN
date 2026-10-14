// Minimal, anonymous usage counts (LGPD-friendly): which screens people reach, nothing about who they are.
// No device id, no advertising id, no IP stored by us. The session id is random per app launch and never saved.
// Rows go to the app_events table (migration 0005), which the anon key may insert into but never read.

export const EVENTS = ['app_open', 'lookup_started', 'price_viewed', 'favorite_added', 'share', 'plus_viewed', 'plus_purchased', 'plate_lookup', 'plate_found', 'advisor_asked'] as const;
export type AppEvent = typeof EVENTS[number];

export interface AnalyticsOptions {
  url?: string; anonKey?: string; platform: string; appVersion: string;
  fetchImpl?: typeof fetch; sessionId?: string;
}

function randomUuid(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  // RFC 4122 v4 from Math.random: fine for an anonymous session tag, not for secrets
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function createAnalytics(opts: AnalyticsOptions) {
  const enabled = Boolean(opts.url && opts.anonKey);
  const session = opts.sessionId ?? randomUuid();
  const f = opts.fetchImpl ?? fetch;
  const endpoint = enabled ? opts.url!.replace(/\/$/, '') + '/rest/v1/app_events' : '';
  return {
    enabled,
    session,
    /** Fire and forget: a failed count never affects the screen. */
    async track(event: AppEvent): Promise<boolean> {
      if (!enabled || !EVENTS.includes(event)) return false;
      try {
        const res = await f(endpoint, {
          method: 'POST',
          headers: {
            apikey: opts.anonKey!, authorization: `Bearer ${opts.anonKey}`,
            'content-type': 'application/json', prefer: 'return=minimal',
          },
          body: JSON.stringify({ event, session_id: session, platform: opts.platform, app_version: opts.appVersion }),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
  };
}
