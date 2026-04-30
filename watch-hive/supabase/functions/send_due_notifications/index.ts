/**
 * DEPRECATED — superseded by `daily_push_dispatcher` (which aggregates all of a
 * user's pending push rows into one web push per day).
 *
 * Kept deployed as a rollback safety net. The 02:00 PT pg_cron job should call
 * `daily_push_dispatcher` instead. See watch-hive/README.md "Push notifications
 * (cron pipeline)" for the swap procedure.
 *
 * Behavior: still sends ONE push per pending notification row (BATCH = 25). If
 * the cron is accidentally still pointing here, users will see multi-stack OS
 * notifications on busy days.
 */
import { assertCronAuthorized } from "../_shared/cron-auth.ts";
import { edgeLog } from "../_shared/edgeLog.ts";
import { serviceClient } from "../_shared/supabase.ts";
import webpush from "npm:web-push@3.6.7";

const FN = "send_due_notifications";
const BATCH = 25;

const PUSH_TYPES = ["release_reminder", "catalog_expanded", "series_catchup"] as const;

type PushPrefRow = {
  push_enabled?: boolean | null;
  push_catchup?: boolean | null;
  push_releases?: boolean | null;
};

/** Default true when column missing (legacy rows). */
function allowPushForType(pref: PushPrefRow | null, type: string): boolean {
  if (type === "series_catchup") return pref?.push_catchup !== false;
  if (type === "release_reminder" || type === "catalog_expanded") {
    return pref?.push_releases !== false;
  }
  return false;
}

/** Default VAPID `sub`; override with Edge secret VAPID_SUBJECT when you want a different contact. */
const DEFAULT_VAPID_SUBJECT = "mailto:joaoishida@gmail.com";

/** Apple returns 403 BadJwtToken when VAPID `sub` uses localhost (see web-push vapid-helper validateSubject). */
function resolveVapidSubject(): string {
  let s = (Deno.env.get("VAPID_SUBJECT") || DEFAULT_VAPID_SUBJECT).trim();
  s = s.replace(/^mailto:\s+/i, "mailto:");
  try {
    const u = new URL(s);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
      edgeLog(FN, "vapid_subject_localhost_override", {
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

Deno.serve(async (req) => {
  edgeLog(FN, "request", { method: req.method });
  const authErr = assertCronAuthorized(req);
  if (authErr) {
    edgeLog(FN, "auth_failed", { hasCronSecret: !!Deno.env.get("CRON_SECRET") });
    return authErr;
  }
  edgeLog(FN, "auth_ok");

  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY")?.trim() ?? "";
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY")?.trim() ?? "";
  if (!publicKey || !privateKey) {
    edgeLog(FN, "missing_vapid");
    return new Response(JSON.stringify({ error: "Missing VAPID keys" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  webpush.setVapidDetails(resolveVapidSubject(), publicKey, privateKey);

  try {
    const supabase = serviceClient();

    const { data: rows, error } = await supabase
      .from("notifications")
      .select("id, user_id, title, message, link, type")
      .in("type", [...PUSH_TYPES])
      .is("push_sent_at", null)
      .order("created_at", { ascending: true })
      .limit(BATCH);

    if (error) throw error;

    edgeLog(FN, "batch_loaded", {
      count: (rows ?? []).length,
      batchLimit: BATCH,
      notificationIds: (rows ?? []).map((r) => r.id),
    });

    let sent = 0;
    let skipped = 0;
    let cleared = 0;

    for (const n of rows ?? []) {
      const { data: pref } = await supabase
        .from("notification_preferences")
        .select("push_enabled, push_catchup, push_releases")
        .eq("user_id", n.user_id)
        .maybeSingle();

      const pushEnabled = pref?.push_enabled === true;

      if (!pushEnabled) {
        edgeLog(FN, "skip_push_disabled", {
          notificationId: n.id,
          user_id: n.user_id,
        });
        await supabase
          .from("notifications")
          .update({ push_sent_at: new Date().toISOString() })
          .eq("id", n.id);
        skipped++;
        continue;
      }

      if (!allowPushForType(pref as PushPrefRow | null, n.type)) {
        edgeLog(FN, "skip_category_disabled", {
          notificationId: n.id,
          user_id: n.user_id,
          type: n.type,
        });
        await supabase
          .from("notifications")
          .update({ push_sent_at: new Date().toISOString() })
          .eq("id", n.id);
        skipped++;
        continue;
      }

      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("id, subscription, endpoint")
        .eq("user_id", n.user_id);

      if (!subs?.length) {
        edgeLog(FN, "skip_no_subscriptions", {
          notificationId: n.id,
          user_id: n.user_id,
        });
        skipped++;
        continue;
      }

      edgeLog(FN, "attempt_push", {
        notificationId: n.id,
        user_id: n.user_id,
        type: n.type,
        subscriptionCount: subs.length,
      });

      const payload = JSON.stringify({
        title: n.title,
        body: n.message,
        url: n.link || "/",
      });

      let anyOk = false;
      for (const s of subs) {
        try {
          await webpush.sendNotification(
            s.subscription as Record<string, unknown>,
            payload,
          );
          anyOk = true;
        } catch (e: unknown) {
          const status = (e as { statusCode?: number })?.statusCode;
          const msg = String(e);
          if (status === 410 || status === 404 || msg.includes("410") || msg.includes("404")) {
            edgeLog(FN, "subscription_gone", {
              subscriptionId: s.id,
              notificationId: n.id,
              user_id: n.user_id,
              status,
            });
            await supabase.from("push_subscriptions").delete().eq("id", s.id);
            cleared++;
          } else {
            edgeLog(FN, "webpush_error", {
              subscriptionId: s.id,
              notificationId: n.id,
              user_id: n.user_id,
              status,
              message: msg,
            });
            console.error("webpush error", e);
          }
        }
      }

      if (anyOk) {
        await supabase
          .from("notifications")
          .update({ push_sent_at: new Date().toISOString() })
          .eq("id", n.id);
        sent++;
        edgeLog(FN, "push_ok", {
          notificationId: n.id,
          user_id: n.user_id,
        });
      } else {
        edgeLog(FN, "push_all_failed", {
          notificationId: n.id,
          user_id: n.user_id,
        });
      }
    }

    const body = {
      ok: true as const,
      batch: (rows ?? []).length,
      sent,
      skipped,
      subscriptionsCleared: cleared,
    };
    edgeLog(FN, "done", body);
    return new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    edgeLog(FN, "fatal", {
      err: err instanceof Error ? err.message : String(err),
    });
    console.error(err);
    return new Response(
      JSON.stringify({
        error: String(err),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
