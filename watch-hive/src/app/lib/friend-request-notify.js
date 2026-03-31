import { sendWebPushPayloadToUser } from './push-notify';

const HOUR_MS = 60 * 60 * 1000;

/**
 * In-app notification + optional Web Push.
 * At most one in-app row + one push burst per sender→receiver per hour (unified throttle).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function notifyFriendRequestReceived(supabase, { senderId, receiverId }) {
  const { data: throttle, error: throttleErr } = await supabase
    .from('friend_request_notify_throttle')
    .select('last_notified_at')
    .eq('sender_id', senderId)
    .eq('receiver_id', receiverId)
    .maybeSingle();

  if (throttleErr) {
    console.error('friend-request-notify: throttle read', throttleErr);
  } else {
    const last = throttle?.last_notified_at
      ? new Date(throttle.last_notified_at).getTime()
      : 0;
    if (last && Date.now() - last < HOUR_MS) return;
  }

  const { data: sender, error: pErr } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', senderId)
    .maybeSingle();

  if (pErr) console.error('friend-request-notify: profile', pErr);

  const name = sender?.display_name?.trim() || 'Someone';

  const { error: nErr } = await supabase.from('notifications').insert({
    user_id: receiverId,
    type: 'friend_request',
    title: 'Friend request',
    message: `${name} sent you a friend request.`,
    link: '/profile/friends',
    read: false,
  });

  if (nErr) {
    console.error('friend-request-notify: insert notification', nErr);
    return;
  }

  const { error: upErr } = await supabase.from('friend_request_notify_throttle').upsert(
    {
      sender_id: senderId,
      receiver_id: receiverId,
      last_notified_at: new Date().toISOString(),
    },
    { onConflict: 'sender_id,receiver_id' },
  );
  if (upErr) console.error('friend-request-notify: throttle upsert', upErr);

  const { data: pref } = await supabase
    .from('notification_preferences')
    .select('push_enabled, push_friends')
    .eq('user_id', receiverId)
    .maybeSingle();

  if (pref?.push_enabled === false) return;
  if (pref && pref.push_friends === false) return;

  await sendWebPushPayloadToUser(supabase, receiverId, {
    title: 'Friend request',
    body: `${name} wants to connect on WatchHive.`,
    url: '/profile/friends',
  });
}
