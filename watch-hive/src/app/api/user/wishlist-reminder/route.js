import { getServerUser, createServerClient } from '../../../lib/supabase-server';

const KINDS = new Set(['release_day', 'one_day_before', 'one_week_before', 'custom']);

export async function PATCH(req) {
  try {
    const user = await getServerUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const body = await req.json();
    const { content_id, media_type, use_global_default, reminder_kind, custom_days_before } = body;

    if (content_id == null || !media_type) {
      return new Response(JSON.stringify({ error: 'content_id and media_type required' }), {
        status: 400,
      });
    }

    if (reminder_kind != null && !KINDS.has(reminder_kind)) {
      return new Response(JSON.stringify({ error: 'Invalid reminder_kind' }), { status: 400 });
    }

    if (custom_days_before != null) {
      const n = Number(custom_days_before);
      if (n < 1 || n > 30) {
        return new Response(JSON.stringify({ error: 'custom_days_before must be 1–30' }), {
          status: 400,
        });
      }
    }

    const supabase = await createServerClient();
    const { data: wl, error: wErr } = await supabase
      .from('wishlist')
      .select('id')
      .eq('user_id', user.id)
      .eq('content_id', content_id)
      .eq('media_type', media_type)
      .maybeSingle();

    if (wErr) throw wErr;
    if (!wl) {
      return new Response(JSON.stringify({ error: 'Wishlist item not found' }), { status: 404 });
    }

    const row = {
      wishlist_id: wl.id,
      use_global_default: use_global_default !== false,
      reminder_kind: use_global_default === false ? reminder_kind : null,
      custom_days_before:
        use_global_default === false && reminder_kind === 'custom'
          ? Number(custom_days_before) || 3
          : null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('wishlist_reminders').upsert(row, {
      onConflict: 'wishlist_id',
    });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Failed to update reminder' }), { status: 500 });
  }
}
