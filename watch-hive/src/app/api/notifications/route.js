import { getServerUser, createServerClient } from '../../lib/supabase-server';

/** Aligns with push category toggles (same columns on notification_preferences). */
function allowedNotificationTypes(pref) {
  const p = pref || {};
  const pf = p.push_friends !== false;
  const pc = p.push_catchup !== false;
  const pr = p.push_releases !== false;
  if (pf && pc && pr) return null;
  const types = [];
  if (pf) types.push('friend_request');
  if (pc) types.push('series_catchup');
  if (pr) types.push('release_reminder', 'catalog_expanded', 'new_episodes');
  return types;
}

export async function GET(req) {
  try {
    const user = await getServerUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const supabase = await createServerClient();
    const { data: pref } = await supabase
      .from('notification_preferences')
      .select('push_friends, push_catchup, push_releases')
      .eq('user_id', user.id)
      .maybeSingle();

    const allowed = allowedNotificationTypes(pref);

    const { searchParams } = new URL(req.url, 'http://localhost');
    if (searchParams.get('unreadCount') === '1') {
      if (allowed && allowed.length === 0) {
        return new Response(JSON.stringify({ unread: 0 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      let q = supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);
      if (allowed?.length) q = q.in('type', allowed);
      const { count, error } = await q;
      if (error) throw error;
      return new Response(JSON.stringify({ unread: count ?? 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '40', 10)));

    if (allowed && allowed.length === 0) {
      return new Response(JSON.stringify({ notifications: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let listQ = supabase
      .from('notifications')
      .select('id, type, title, message, link, read, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (allowed?.length) listQ = listQ.in('type', allowed);

    const { data, error } = await listQ;

    if (error) throw error;

    return new Response(JSON.stringify({ notifications: data || [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Failed to load notifications' }), { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const user = await getServerUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const body = await req.json();
    const { notificationId, read, markAllRead } = body;

    const supabase = await createServerClient();

    if (markAllRead) {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!notificationId) {
      return new Response(JSON.stringify({ error: 'notificationId required' }), { status: 400 });
    }

    const { error } = await supabase
      .from('notifications')
      .update({ read: read !== false })
      .eq('id', notificationId)
      .eq('user_id', user.id);

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Failed to update notification' }), { status: 500 });
  }
}
