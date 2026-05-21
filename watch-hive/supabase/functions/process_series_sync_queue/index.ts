import { assertCronAuthorized } from "../_shared/cron-auth.ts";
import { edgeLog } from "../_shared/edgeLog.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { tmdbMovieCa, tmdbTvNextAir } from "../_shared/tmdb.ts";

/**
 * Drains series_sync_queue and refreshes release_cache (TMDB metadata only).
 * Release reminders are precomputed via ingest_regional_airings →
 * precompute_release_notifications → dispatch_notification_queue.
 */
const FN = "process_series_sync_queue";
const BATCH = 12;

Deno.serve(async (req) => {
  edgeLog(FN, "request", { method: req.method });
  const authErr = assertCronAuthorized(req);
  if (authErr) {
    edgeLog(FN, "auth_failed", { hasCronSecret: !!Deno.env.get("CRON_SECRET") });
    return authErr;
  }
  edgeLog(FN, "auth_ok");

  const apiKey = Deno.env.get("TMDB_API_KEY");
  if (!apiKey) {
    edgeLog(FN, "missing_tmdb_key");
    return new Response(JSON.stringify({ error: "Missing TMDB_API_KEY" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = serviceClient();

    const { data: pending, error: qErr } = await supabase
      .from("series_sync_queue")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(BATCH);

    if (qErr) throw qErr;

    edgeLog(FN, "queue_fetched", {
      pendingCount: (pending ?? []).length,
      batchLimit: BATCH,
    });

    let processed = 0;
    let failed = 0;

    for (const row of pending ?? []) {
      const { data: locked, error: lockErr } = await supabase
        .from("series_sync_queue")
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();
      if (lockErr || !locked) continue;

      try {
        let title: string;
        let release_date: string | null;
        let poster_path: string | null;

        if (row.media_type === "movie") {
          const m = await tmdbMovieCa(apiKey, row.content_id);
          title = m.title;
          release_date = m.release_date;
          poster_path = m.poster_path;
        } else {
          const t = await tmdbTvNextAir(apiKey, row.content_id);
          title = t.title;
          release_date = t.release_date;
          poster_path = t.poster_path;
        }

        const now = new Date().toISOString();
        const { error: upErr } = await supabase.from("release_cache").upsert(
          {
            content_id: row.content_id,
            media_type: row.media_type,
            title,
            release_date,
            poster_path,
            refreshed_at: now,
            tmdb_region: "CA",
            updated_at: now,
          },
          { onConflict: "content_id,media_type" },
        );
        if (upErr) throw upErr;

        await supabase
          .from("series_sync_queue")
          .update({
            status: "done",
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        processed++;
      } catch (e) {
        edgeLog(FN, "row_failed", { queueId: row.id, err: String(e) });
        console.error(e);
        await supabase
          .from("series_sync_queue")
          .update({
            status: "failed",
            attempts: (row.attempts ?? 0) + 1,
            last_error: String(e).slice(0, 500),
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        failed++;
      }
    }

    const body = {
      ok: true,
      picked: (pending ?? []).length,
      processed,
      failed,
    };
    edgeLog(FN, "done", body);
    return new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    edgeLog(FN, "fatal", { err: String(e) });
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
