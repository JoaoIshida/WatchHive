import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { assertCronOrServiceRequest } from "../_shared/cron-auth.ts";
import { fetchTvCatalogTotals } from "../_shared/tmdb.ts";
import { edgeLog } from "../_shared/edgeLog.ts";

const FN = "weekly_series_catchup_notifications";
const DEFAULT_BATCH = 350;

type ProgressRow = {
  id: string;
  user_id: string;
  series_id: number;
  catalog_total_episodes: number | null;
};

function isoWeekUtcKey(d = new Date()): string {
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

async function countWatchedEpisodes(
  supabase: ReturnType<typeof createServiceClient>,
  progressId: string,
): Promise<number> {
  const { data: seasons, error: se } = await supabase
    .from("series_seasons")
    .select("id")
    .eq("series_progress_id", progressId);
  if (se) throw se;
  const seasonIds = (seasons || []).map((s: { id: string }) => s.id);
  if (seasonIds.length === 0) return 0;
  const { count, error: ce } = await supabase
    .from("series_episodes")
    .select("id", { count: "exact", head: true })
    .in("series_season_id", seasonIds);
  if (ce) throw ce;
  return count ?? 0;
}

Deno.serve(async (req) => {
  edgeLog(FN, "request", { method: req.method });
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createServiceClient();
  const denied = assertCronOrServiceRequest(req);
  if (denied) {
    edgeLog(FN, "auth_failed", { hasCronSecret: !!Deno.env.get("CRON_SECRET") });
    return denied;
  }
  edgeLog(FN, "auth_ok");

  const apiKey = Deno.env.get("TMDB_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "TMDB_API_KEY not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let batchLimit = DEFAULT_BATCH;
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    if (typeof body?.limit === "number" && body.limit > 0 && body.limit <= 800) {
      batchLimit = Math.floor(body.limit);
    }
  } catch {
    // ignore
  }

  const weekKey = isoWeekUtcKey();
  edgeLog(FN, "batch", { batchLimit, weekKey });

  const { data: rows, error: qErr } = await supabase
    .from("series_progress")
    .select("id, user_id, series_id, catalog_total_episodes")
    .eq("completed", false)
    .not("catalog_total_episodes", "is", null)
    .limit(batchLimit);

  if (qErr) {
    console.error(qErr);
    return new Response(JSON.stringify({ error: qErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const progressList = (rows || []) as ProgressRow[];
  const titleCache = new Map<number, string>();

  async function seriesTitle(sid: number): Promise<string> {
    if (titleCache.has(sid)) return titleCache.get(sid)!;
    const { name } = await fetchTvCatalogTotals(sid, apiKey);
    const t = name || `Series ${sid}`;
    titleCache.set(sid, t);
    return t;
  }

  let notificationsInserted = 0;
  let candidatesSkipped = 0;
  const errors: string[] = [];

  for (const row of progressList) {
    const total = row.catalog_total_episodes;
    if (total == null || total <= 0) continue;
    try {
      const watched = await countWatchedEpisodes(supabase, row.id);
      if (watched >= total) {
        candidatesSkipped += 1;
        continue;
      }
      const title = await seriesTitle(row.series_id);
      const dedupeKey = `weekly_catchup:${row.user_id}:${row.series_id}:${weekKey}`;
      const { error: insErr } = await supabase.from("notifications").insert({
        user_id: row.user_id,
        type: "series_catchup",
        title: "Episodes waiting",
        message: `${title} has ${total} episodes on TMDB; you’ve marked ${watched} watched. Catch up when you’re ready.`,
        link: `/series/${row.series_id}`,
        read: false,
        dedupe_key: dedupeKey,
      });
      if (insErr) {
        if (insErr.code !== "23505") {
          console.error("weekly_catchup insert", insErr);
          errors.push(`series ${row.series_id} user ${row.user_id}: ${insErr.message}`);
        }
      } else {
        notificationsInserted += 1;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`progress ${row.id}: ${msg}`);
      console.error(e);
    }
  }

  const summary: Record<string, unknown> = {
    ok: true,
    weekKey,
    scanned: progressList.length,
    notificationsInserted,
    skippedCaughtUp: candidatesSkipped,
  };
  if (errors.length) summary.errors = errors;
  edgeLog(FN, "done", summary);
  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
