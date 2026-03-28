import { getServerUser, createServerClient } from '../../../lib/supabase-server';

export async function POST(req) {
  try {
    const user = await getServerUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const subscription = await req.json();
    if (!subscription?.endpoint || !subscription?.keys) {
      return new Response(JSON.stringify({ error: 'Invalid subscription' }), { status: 400 });
    }

    const supabase = await createServerClient();

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
      push_enabled: true,
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
        push_enabled: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: user.id,
        subscription,
        endpoint: subscription.endpoint,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    );

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Failed to save subscription' }), { status: 500 });
  }
}
