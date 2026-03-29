import webpush from 'web-push';

/** Match Edge function default; set VAPID_SUBJECT in env for production. */
const DEFAULT_VAPID_SUBJECT = 'mailto:joaoishida@gmail.com';

export function resolveVapidSubject() {
  let s = (process.env.VAPID_SUBJECT || DEFAULT_VAPID_SUBJECT).trim();
  s = s.replace(/^mailto:\s+/i, 'mailto:');
  try {
    const u = new URL(s);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
      return DEFAULT_VAPID_SUBJECT;
    }
  } catch {
    /* webpush will validate */
  }
  return s;
}

/**
 * @returns {boolean} true if VAPID is configured
 */
export function ensureWebPushConfigured() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(resolveVapidSubject(), publicKey, privateKey);
  return true;
}

/**
 * Send JSON Web Push payload to all subscriptions for user (respects push_enabled).
 * @returns {Promise<boolean>} true if at least one subscription accepted the push
 */
export async function sendWebPushPayloadToUser(supabase, userId, payloadObj) {
  if (!ensureWebPushConfigured()) {
    console.warn('push-notify: VAPID keys missing; skipping Web Push');
    return false;
  }

  const { data: pref } = await supabase
    .from('notification_preferences')
    .select('push_enabled')
    .eq('user_id', userId)
    .maybeSingle();

  if (pref && pref.push_enabled === false) return false;

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, subscription')
    .eq('user_id', userId);

  if (!subs?.length) return false;

  const payload =
    typeof payloadObj === 'string' ? payloadObj : JSON.stringify(payloadObj);

  let anyOk = false;
  for (const s of subs) {
    try {
      await webpush.sendNotification(s.subscription, payload);
      anyOk = true;
    } catch (e) {
      const status = e?.statusCode;
      const msg = String(e?.message || e);
      if (status === 410 || status === 404 || msg.includes('410') || msg.includes('404')) {
        await supabase.from('push_subscriptions').delete().eq('id', s.id);
      } else {
        console.error('push-notify: webpush error', e);
      }
    }
  }
  return anyOk;
}
