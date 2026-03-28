import { getServerUser, createServerClient } from '../../../lib/supabase-server';

export async function POST(req) {
  try {
    const user = await getServerUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    let endpoint = null;
    try {
      const body = await req.json();
      endpoint = body?.endpoint || null;
    } catch {
      /* optional body */
    }

    const supabase = await createServerClient();

    if (endpoint) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id)
        .eq('endpoint', endpoint);
    } else {
      await supabase.from('push_subscriptions').delete().eq('user_id', user.id);
    }

    const { data: existingPref } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    const defaults = {
      timezone: 'America/Toronto',
      default_reminder_kind: 'release_day',
      default_reminder_kinds: ['release_day'],
      custom_days_before: null,
      push_enabled: false,
    };
    const ep = existingPref || {};
    const kinds =
      Array.isArray(ep.default_reminder_kinds) && ep.default_reminder_kinds.length
        ? ep.default_reminder_kinds
        : ep.default_reminder_kind
          ? [ep.default_reminder_kind]
          : defaults.default_reminder_kinds;
    await supabase.from('notification_preferences').upsert(
      {
        ...defaults,
        ...ep,
        user_id: user.id,
        default_reminder_kinds: kinds,
        default_reminder_kind: ep.default_reminder_kind || defaults.default_reminder_kind,
        push_enabled: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Failed to unsubscribe' }), { status: 500 });
  }
}
