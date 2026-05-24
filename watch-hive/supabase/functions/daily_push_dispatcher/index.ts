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

    const { data: rawRows, error: qErr } = await supabase
      .from("notifications")
      .select("id, user_id, type, title, message, link")
      .in("type", [...PUSH_TYPES])
      .is("push_sent_at", null)
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
