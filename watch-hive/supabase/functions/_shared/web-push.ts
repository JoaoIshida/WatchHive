import webpush from "npm:web-push@3.6.7";
import { edgeLog } from "./edgeLog.ts";

/** Default VAPID `sub`; override with Edge secret VAPID_SUBJECT when you want a different contact. */
const DEFAULT_VAPID_SUBJECT = "mailto:joaoishida@gmail.com";

/** Apple returns 403 BadJwtToken when VAPID `sub` uses localhost (web-push vapid-helper validateSubject). */
export function resolveVapidSubject(fn: string): string {
  let s = (Deno.env.get("VAPID_SUBJECT") || DEFAULT_VAPID_SUBJECT).trim();
  s = s.replace(/^mailto:\s+/i, "mailto:");
  try {
    const u = new URL(s);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
      edgeLog(fn, "vapid_subject_localhost_override", {
        msg:
          "Apple rejects localhost in VAPID subject; using default contact. Set VAPID_SUBJECT in Edge secrets.",
      });
      return DEFAULT_VAPID_SUBJECT;
    }
  } catch {
    /* invalid URL; webpush.setVapidDetails will throw */
  }
  return s;
}

/** Returns true when VAPID env vars are present and webpush is configured. */
export function configureWebPush(fn: string): boolean {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY")?.trim() ?? "";
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY")?.trim() ?? "";
  if (!publicKey || !privateKey) {
    edgeLog(fn, "missing_vapid");
    return false;
  }
  webpush.setVapidDetails(resolveVapidSubject(fn), publicKey, privateKey);
  return true;
}

export type PushSub = {
  id: string;
  subscription: Record<string, unknown>;
};

export type PushSendResult = {
  anyOk: boolean;
  prunedSubIds: string[];
};

/**
 * Send a JSON payload to all subscriptions for a user.
 * On 410/404 the subscription id is collected into `prunedSubIds` (caller deletes them).
 * Other errors are logged and treated as transient.
 */
export async function sendPushAndPrune(
  fn: string,
  subs: PushSub[],
  payload: Record<string, unknown> | string,
  ctx?: Record<string, unknown>,
): Promise<PushSendResult> {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  const prunedSubIds: string[] = [];
  let anyOk = false;
  for (const s of subs) {
    try {
      await webpush.sendNotification(s.subscription, body);
      anyOk = true;
    } catch (e: unknown) {
      const status = (e as { statusCode?: number })?.statusCode;
      const msg = String(e);
      if (
        status === 410 ||
        status === 404 ||
        msg.includes("410") ||
        msg.includes("404")
      ) {
        edgeLog(fn, "subscription_gone", {
          ...(ctx || {}),
          subscriptionId: s.id,
          status,
        });
        prunedSubIds.push(s.id);
      } else {
        edgeLog(fn, "webpush_error", {
          ...(ctx || {}),
          subscriptionId: s.id,
          status,
          message: msg,
        });
        console.error("webpush error", e);
      }
    }
  }
  return { anyOk, prunedSubIds };
}
