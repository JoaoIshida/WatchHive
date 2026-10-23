import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { edgeLog } from "./edgeLog.ts";
import { configureWebPush, sendPushAndPrune } from "./web-push.ts";

/** Notification types that produce web pushes. */
export const PUSH_TYPES = [
  "release_reminder",
  "catalog_expanded",
  "series_catchup",
] as const;

export type PendingNotificationRow = {
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

export type PushDispatchSummary = {
  usersConsidered: number;
  usersPushed: number;
  usersSkippedDisabled: number;
  usersSkippedNoSubs: number;
  rowsAggregated: number;
  subscriptionsCleared: number;
  errors: string[];
};

function allowPushForType(pref: PrefRow | null, type: string): boolean {
  if (type === "series_catchup") return pref?.push_catchup !== false;
  if (type === "release_reminder" || type === "catalog_expanded") {
    return pref?.push_releases !== false;
  }
  return false;
}

export function decideVariant(rows: PendingNotificationRow[]): Variant {
  if (rows.length === 1) {
    const r = rows[0];
    return {
      title: r.title,
      body: r.message,
      url: r.link || "/profile/notifications",
    };
  }

  const byLink = new Map<string, PendingNotificationRow[]>();
  for (const r of rows) {
    const key = r.link || "/profile/notifications";
    const list = byLink.get(key) ?? [];
    list.push(r);
    byLink.set(key, list);
  }

  // Several rows for one title are usually different reminders for the same show (a weekly
  // catch-up plus a release reminder, or a late "tomorrow" plus "today"), not N new episodes.
  // The newest row carries the current information, so send that one.
  if (byLink.size === 1) {
    const [link, group] = [...byLink.entries()][0];
    const latest = group[group.length - 1];
    return { title: latest.title, body: latest.message, url: link };
  }

  return {
    title: "WatchHive",
    body: `${byLink.size} new titles available`,
    url: "/profile/notifications",
  };
}

async function markRowsPushed(
  logFn: string,
  supabase: SupabaseClient,
  rows: PendingNotificationRow[],
  whenIso: string,
): Promise<void> {
  if (!rows.length) return;
  const ids = rows.map((r) => r.id);
  const { error } = await supabase
    .from("notifications")
    .update({ push_sent_at: whenIso })
    .in("id", ids);
  if (error) {
    edgeLog(logFn, "mark_pushed_error", {
      err: error.message,
      ids: ids.slice(0, 10),
      total: ids.length,
    });
    throw error;
  }
}

/**
 * Send aggregated Web Push for the given notification rows (must already exist in DB).
 */
export async function pushPendingNotifications(
  logFn: string,
  supabase: SupabaseClient,
  rows: PendingNotificationRow[],
): Promise<PushDispatchSummary> {
  const summary: PushDispatchSummary = {
    usersConsidered: 0,
    usersPushed: 0,
    usersSkippedDisabled: 0,
    usersSkippedNoSubs: 0,
    rowsAggregated: 0,
    subscriptionsCleared: 0,
    errors: [],
  };

  if (!rows.length) return summary;

  if (!configureWebPush(logFn)) {
    summary.errors.push("Missing VAPID keys");
    return summary;
  }

  const byUser = new Map<string, PendingNotificationRow[]>();
  for (const r of rows) {
    if (!PUSH_TYPES.includes(r.type as (typeof PUSH_TYPES)[number])) continue;
    const list = byUser.get(r.user_id) ?? [];
    list.push(r);
    byUser.set(r.user_id, list);
  }

  const userIds = [...byUser.keys()];
  summary.usersConsidered = userIds.length;

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
        edgeLog(logFn, "user_push_disabled", {
          user_id: userId,
          rowCount: userRows.length,
        });
        await markRowsPushed(logFn, supabase, userRows, nowIso);
        summary.usersSkippedDisabled++;
        summary.rowsAggregated += userRows.length;
        continue;
      }

      const allowedRows = userRows.filter((r) =>
        allowPushForType(pref as PrefRow | null, r.type)
      );
      const blockedRows = userRows.filter(
        (r) => !allowPushForType(pref as PrefRow | null, r.type),
      );

      if (blockedRows.length) {
        await markRowsPushed(logFn, supabase, blockedRows, nowIso);
      }

      if (!allowedRows.length) {
        summary.rowsAggregated += blockedRows.length;
        continue;
      }

      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("id, subscription")
        .eq("user_id", userId);

      if (!subs?.length) {
        edgeLog(logFn, "user_no_subscriptions", {
          user_id: userId,
          rowCount: allowedRows.length,
        });
        await markRowsPushed(logFn, supabase, allowedRows, nowIso);
        summary.usersSkippedNoSubs++;
        summary.rowsAggregated += allowedRows.length + blockedRows.length;
        continue;
      }

      const variant = decideVariant(allowedRows);
      const payload = {
        title: variant.title,
        body: variant.body,
        url: variant.url,
        // One tray slot per destination: a later push for another title must not replace this one.
        tag: `wh:${variant.url}`,
        renotify: true,
      };

      edgeLog(logFn, "attempt_push", {
        user_id: userId,
        rows: allowedRows.length,
        subscriptions: subs.length,
        body: variant.body,
      });

      const { anyOk, prunedSubIds } = await sendPushAndPrune(
        logFn,
        subs as Sub[],
        payload,
        { user_id: userId },
      );

      if (prunedSubIds.length) {
        await supabase
          .from("push_subscriptions")
          .delete()
          .in("id", prunedSubIds);
        summary.subscriptionsCleared += prunedSubIds.length;
      }

      if (anyOk) {
        await markRowsPushed(logFn, supabase, allowedRows, nowIso);
        summary.usersPushed++;
        summary.rowsAggregated += allowedRows.length + blockedRows.length;
        edgeLog(logFn, "push_ok", { user_id: userId, rows: allowedRows.length });
      } else {
        edgeLog(logFn, "push_all_failed", {
          user_id: userId,
          rows: allowedRows.length,
          subscriptions: subs.length,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      summary.errors.push(`user ${userId}: ${msg}`);
      edgeLog(logFn, "user_error", { user_id: userId, err: msg });
      console.error(e);
    }
  }

  return summary;
}
