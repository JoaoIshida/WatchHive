import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { assertCronOrServiceRequest } from "../_shared/cron-auth.ts";
import { fetchTvCatalogTotals } from "../_shared/tmdb.ts";
import { edgeLog } from "../_shared/edgeLog.ts";

const FN = "refresh_series_progress_catalog";
const DEFAULT_LIMIT = 40;

type ProgressRow = {
  id: string;
  user_id: string;
  series_id: number;
  catalog_total_episodes: number | null;
};

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

  let limit = DEFAULT_LIMIT;
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    if (typeof body?.limit === "number" && body.limit > 0 && body.limit <= 80) {
      limit = Math.floor(body.limit);
    }
  } catch {
    // ignore
  }

  edgeLog(FN, "limit", { limit });

  const { data: idRows, error: rpcError } = await supabase.rpc(
    "series_ids_for_catalog_refresh",
    { p_limit: limit },
  );
  if (rpcError) {
    console.error(rpcError);
    return new Response(JSON.stringify({ error: rpcError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const seriesIds = (idRows || []) as Array<{ series_id: number }>;
  const ids = [...new Set(seriesIds.map((r) => r.series_id))];

  edgeLog(FN, "rpc_series_ids", { count: ids.length });

  let seriesProcessed = 0;
  let progressRowsUpdated = 0;
  let notificationsInserted = 0;
  const errors: string[] = [];

  for (const sid of ids) {
    try {
      edgeLog(FN, "series_start", { series_id: sid });
      const { totalEpisodes, name } = await fetchTvCatalogTotals(sid, apiKey);
      const { data: rows, error: prErr } = await supabase
        .from("series_progress")
        .select("id, user_id, series_id, catalog_total_episodes")
        .eq("series_id", sid);
      if (prErr) throw prErr;
      const progressList = (rows || []) as ProgressRow[];
      if (progressList.length === 0) continue;

      const now = new Date().toISOString();
      const title = name || `Series ${sid}`;

      for (const row of progressList) {
        const oldTotal = row.catalog_total_episodes;
        const watched = await countWatchedEpisodes(supabase, row.id);
        const grew = oldTotal !== null && totalEpisodes > oldTotal;
        const behind = totalEpisodes > 0 && watched < totalEpisodes;
        /** TMDB regular-season episode count increased; user still behind on watch progress. */
        const catalogGrewBehind = grew && behind;

        if (catalogGrewBehind) {
          edgeLog(FN, "branch_catalog_expanded", {
            series_id: sid,
            progressId: row.id,
            user_id: row.user_id,
            oldTotal,
            totalEpisodes,
            watched,
          });
          const dedupeKey = `new_eps:${sid}:${totalEpisodes}`;
          const { error: insErr } = await supabase.from("notifications").insert({
            user_id: row.user_id,
            type: "catalog_expanded",
            title: "New episodes",
            message: `${title} now has new episodes listed. Open the show when you're ready.`,
            link: `/series/${sid}`,
            read: false,
            dedupe_key: dedupeKey,
          });
          if (insErr) {
            if (insErr.code !== "23505") {
              console.error("notification insert", insErr);
            }
          } else {
            notificationsInserted += 1;
          }
        }

        const { error: upErr } = await supabase
          .from("series_progress")
          .update({
            catalog_total_episodes: totalEpisodes,
            catalog_refreshed_at: now,
          })
          .eq("id", row.id);
        if (upErr) throw upErr;
        progressRowsUpdated += 1;
      }
      seriesProcessed += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`series ${sid}: ${msg}`);
      edgeLog(FN, "series_error", { series_id: sid, err: msg });
      console.error(e);
    }
  }

  const summary: Record<string, unknown> = {
    ok: true,
    seriesProcessed,
    progressRowsUpdated,
    notificationsInserted,
  };
  if (errors.length) summary.errors = errors;
  edgeLog(FN, "done", summary);
  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
