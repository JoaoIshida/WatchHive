import { assertCronAuthorized } from "../_shared/cron-auth.ts";
import { edgeLog } from "../_shared/edgeLog.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { configureWebPush, sendPushAndPrune } from "../_shared/web-push.ts";

const FN = "daily_push_dispatcher";

/** Notification types that produce web pushes (mirror send_due_notifications). */
const PUSH_TYPES = ["release_reminder", "catalog_expanded", "series_catchup"] as const;

/** Hard upper bound on rows pulled per run (safety guard for free tier). */
const MAX_ROWS_PER_RUN = 5000;

type PendingRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
};

type PrefRow = {
  push_enabled: boolean | null;
  push_catchup: boolean | null;
  push_releases: boolean | null;
};

type Sub = {
  id: string;
  subscription: Record<string, unknown>;
};

type Variant = {
  title: string;
  body: string;
  url: string;
};

/** Default true for nullable / missing pref columns. */
function allowPushForType(pref: PrefRow | null, type: string): boolean {
  if (type === "series_catchup") return pref?.push_catchup !== false;
  if (type === "release_reminder" || type === "catalog_expanded") {
    return pref?.push_releases !== false;
  }
  return false;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Decide push copy based on the aggregated rows for one user.
 * - 1 row -> reuse existing row's title/message/link (single-event UX preserved)
 * - all rows for the same series link -> "<series> - N new episodes" (or "New season of <series>" if any catalog_expanded row is present)
 * - mixed titles -> "X new titles available", url to /profile/notifications
 */
function decideVariant(rows: PendingRow[]): Variant {
  if (rows.length === 1) {
    const r = rows[0];
    return {
      title: r.title,
      body: r.message,
      url: r.link || "/profile/notifications",
    };
  }

  /** Group by link so per-series rollups collapse. Movies always have unique links. */
  const byLink = new Map<string, PendingRow[]>();
  for (const r of rows) {
    const key = r.link || "/profile/notifications";
    const list = byLink.get(key) ?? [];
    list.push(r);
    byLink.set(key, list);
  }

  if (byLink.size === 1) {
    const [link, group] = [...byLink.entries()][0];
    const seriesTitle = extractSeriesName(group);
    const hasCatalogExpanded = group.some((r) => r.type === "catalog_expanded");
    if (hasCatalogExpanded) {
      return {
        title: "WatchHive",
        body: `New season of ${seriesTitle}`,
        url: link,
      };
    }
    return {
      title: "WatchHive",
      body: `${seriesTitle} - ${group.length} new episodes`,
      url: link,
    };
  }

  return {
    title: "WatchHive",
    body: `${byLink.size} new titles available`,
    url: "/profile/notifications",
  };
}

/**
 * Best-effort series-title extraction from existing row strings.
 * Title patterns produced upstream:
 *   - process_series_sync_queue: "New episode: <title>", "Premiere: <title>", "In theatres: <title>"
 *   - refresh_series_progress_catalog: message "<title> now has new episodes listed..."
 *   - weekly_series_catchup_notifications: message "<title> has N episodes not watched yet..." (single show)
 * If nothing matches, fall back to "your show".
 */
function extractSeriesName(rows: PendingRow[]): string {
  for (const r of rows) {
    const fromTitle = r.title.match(
      /^(?:New episode|Premiere|In theatres|Episodes waiting):\s*(.+)$/i,
    );
    if (fromTitle?.[1]) return fromTitle[1].trim();
  }
  for (const r of rows) {
    const catalog = r.message.match(/^(.+?)\s+now has new episodes listed\./);
    if (catalog?.[1]) return catalog[1].trim();
  }
  for (const r of rows) {
    const weekly = r.message.match(/^(.+?)\s+has\s+\d+\s+episodes not watched yet\./);
    if (weekly?.[1]) return weekly[1].trim();
  }
  for (const r of rows) {
    const fromMsg = r.message.match(/^[“"](?<name>[^"”]+)[”"]\s/);
    if (fromMsg?.groups?.name) return fromMsg.groups.name;
    const fromMsgPlain = r.message.match(/^([^.]+?)\s+has\s/);
    if (fromMsgPlain?.[1]) return fromMsgPlain[1].trim();
  }
  return "your show";
}

Deno.serve(async (req) => {
  edgeLog(FN, "request", { method: req.method });

  const authErr = assertCronAuthorized(req);
  if (authErr) {
    edgeLog(FN, "auth_failed", { hasCronSecret: !!Deno.env.get("CRON_SECRET") });
    return authErr;
  }
  edgeLog(FN, "auth_ok");

  if (!configureWebPush(FN)) {
    return new Response(JSON.stringify({ error: "Missing VAPID keys" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = serviceClient();

    const { data: rawRows, error: qErr } = await supabase
      .from("notifications")
      .select("id, user_id, type, title, message, link")
      .in("type", [...PUSH_TYPES])
      .is("push_sent_at", null)
      .order("created_at", { ascending: true })
      .limit(MAX_ROWS_PER_RUN);
    if (qErr) throw qErr;

    const rows = (rawRows ?? []) as PendingRow[];
    edgeLog(FN, "rows_loaded", { count: rows.length, cap: MAX_ROWS_PER_RUN });

    const byUser = new Map<string, PendingRow[]>();
    for (const r of rows) {
      const list = byUser.get(r.user_id) ?? [];
      list.push(r);
      byUser.set(r.user_id, list);
    }

    const userIds = [...byUser.keys()];
    edgeLog(FN, "users_to_consider", { usersConsidered: userIds.length });

    let usersPushed = 0;
    let usersSkippedDisabled = 0;
    let usersSkippedNoSubs = 0;
    let rowsAggregated = 0;
    let subscriptionsCleared = 0;
    const errors: string[] = [];

    const dayTag = `wh-daily-${todayKey()}`;
    const nowIso = new Date().toISOString();

    for (const userId of userIds) {
      const userRows = byUser.get(userId)!;
      try {
        const { data: pref } = await supabase
          .from("notification_preferences")
          .select("push_enabled, push_catchup, push_releases")
          .eq("user_id", userId)
          .maybeSingle();

        const pushEnabled = pref?.push_enabled === true;

        if (!pushEnabled) {
          edgeLog(FN, "user_push_disabled", {
            user_id: userId,
            rowCount: userRows.length,
          });
          await markRowsPushed(supabase, userRows, nowIso);
          usersSkippedDisabled++;
          rowsAggregated += userRows.length;
          continue;
        }

        const allowedRows = userRows.filter((r) =>
          allowPushForType(pref as PrefRow | null, r.type)
        );
        const blockedRows = userRows.filter(
          (r) => !allowPushForType(pref as PrefRow | null, r.type),
        );

        if (blockedRows.length) {
          await markRowsPushed(supabase, blockedRows, nowIso);
        }

        if (!allowedRows.length) {
          edgeLog(FN, "user_all_categories_off", {
            user_id: userId,
            blocked: blockedRows.length,
          });
          rowsAggregated += blockedRows.length;
          continue;
        }

        const { data: subs } = await supabase
          .from("push_subscriptions")
          .select("id, subscription")
          .eq("user_id", userId);

        if (!subs?.length) {
          edgeLog(FN, "user_no_subscriptions", {
            user_id: userId,
            rowCount: allowedRows.length,
          });
          await markRowsPushed(supabase, allowedRows, nowIso);
          usersSkippedNoSubs++;
          rowsAggregated += allowedRows.length + blockedRows.length;
          continue;
        }

        const variant = decideVariant(allowedRows);
        const payload = {
          title: variant.title,
          body: variant.body,
          url: variant.url,
          tag: dayTag,
          renotify: true,
        };

        edgeLog(FN, "attempt_push", {
          user_id: userId,
          rows: allowedRows.length,
          subscriptions: subs.length,
          body: variant.body,
        });

        const { anyOk, prunedSubIds } = await sendPushAndPrune(
          FN,
          subs as Sub[],
          payload,
          { user_id: userId },
        );

        if (prunedSubIds.length) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .in("id", prunedSubIds);
          subscriptionsCleared += prunedSubIds.length;
        }

        if (anyOk) {
          await markRowsPushed(supabase, allowedRows, nowIso);
          usersPushed++;
          rowsAggregated += allowedRows.length + blockedRows.length;
          edgeLog(FN, "push_ok", { user_id: userId, rows: allowedRows.length });
        } else {
          edgeLog(FN, "push_all_failed", {
            user_id: userId,
            rows: allowedRows.length,
            subscriptions: subs.length,
          });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`user ${userId}: ${msg}`);
        edgeLog(FN, "user_error", { user_id: userId, err: msg });
        console.error(e);
      }
    }

    const summary: Record<string, unknown> = {
      ok: true,
      rowsLoaded: rows.length,
      usersConsidered: userIds.length,
      usersPushed,
      usersSkippedDisabled,
      usersSkippedNoSubs,
      rowsAggregated,
      subscriptionsCleared,
    };
    if (errors.length) summary.errors = errors;
    edgeLog(FN, "done", summary);
    return new Response(JSON.stringify(summary), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    edgeLog(FN, "fatal", { err: msg });
    console.error(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

async function markRowsPushed(
  supabase: ReturnType<typeof serviceClient>,
  rows: PendingRow[],
  whenIso: string,
): Promise<void> {
  if (!rows.length) return;
  const ids = rows.map((r) => r.id);
  const { error } = await supabase
    .from("notifications")
    .update({ push_sent_at: whenIso })
    .in("id", ids);
  if (error) {
    edgeLog(FN, "mark_pushed_error", {
      err: error.message,
      ids: ids.slice(0, 10),
      total: ids.length,
    });
    throw error;
  }
}
