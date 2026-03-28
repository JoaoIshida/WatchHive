import { getServerUser, createServerClient } from '../../lib/supabase-server';

export async function GET(req) {
  try {
    const user = await getServerUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { searchParams } = new URL(req.url, 'http://localhost');
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '40', 10)));

    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, title, message, link, read, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

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
