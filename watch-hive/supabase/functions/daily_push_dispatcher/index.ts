import { assertCronAuthorized } from "../_shared/cron-auth.ts";
import { edgeLog } from "../_shared/edgeLog.ts";
import {
  PUSH_TYPES,
  type PendingNotificationRow,
  pushPendingNotifications,
} from "../_shared/pushDispatch.ts";
import { serviceClient } from "../_shared/supabase.ts";

const FN = "daily_push_dispatcher";
const MAX_ROWS_PER_RUN = 5000;
/** Rows older than this are stale (e.g. failed sends days ago); mark them, don't bundle them. */
const MAX_AGE_HOURS = 36;

Deno.serve(async (req) => {
  edgeLog(FN, "request", { method: req.method });

  const authErr = assertCronAuthorized(req);
  if (authErr) {
    edgeLog(FN, "auth_failed", { hasCronSecret: !!Deno.env.get("CRON_SECRET") });
    return authErr;
  }
  edgeLog(FN, "auth_ok");

  try {
    const supabase = serviceClient();
    const cutoff = new Date(Date.now() - MAX_AGE_HOURS * 3600 * 1000).toISOString();

    const { error: oldErr } = await supabase
      .from("notifications")
      .update({ push_sent_at: new Date().toISOString() })
      .in("type", [...PUSH_TYPES])
      .is("push_sent_at", null)
      .lt("created_at", cutoff);
    if (oldErr) throw oldErr;

    const { data: rawRows, error: qErr } = await supabase
      .from("notifications")
      .select("id, user_id, type, title, message, link")
      .in("type", [...PUSH_TYPES])
      .is("push_sent_at", null)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(MAX_ROWS_PER_RUN);
    if (qErr) throw qErr;

    const rows = (rawRows ?? []) as PendingNotificationRow[];
    edgeLog(FN, "rows_loaded", { count: rows.length, cap: MAX_ROWS_PER_RUN });

    const pushSummary = await pushPendingNotifications(FN, supabase, rows);

    const summary: Record<string, unknown> = {
      ok: true,
      rowsLoaded: rows.length,
      ...pushSummary,
    };
    if (pushSummary.errors.length) summary.errors = pushSummary.errors;
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
