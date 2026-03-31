import { getServerUser, createServerClient } from '../../../lib/supabase-server';
import {
  legacyDefaultReminderKind,
  normalizeReminderKindsInput,
  validateReminderKindsAndCustom,
} from '../../../../lib/notificationPreferences';

const DEFAULTS = {
  timezone: 'America/Toronto',
  default_reminder_kind: 'release_day',
  default_reminder_kinds: ['release_day'],
  custom_days_before: null,
  push_enabled: false,
  push_friends: true,
  push_catchup: true,
  push_releases: true,
};

function coercePreferencesRow(row) {
  if (!row) return { ...DEFAULTS };
  let kinds = row.default_reminder_kinds;
  if (!Array.isArray(kinds) || kinds.length === 0) {
    kinds = row.default_reminder_kind ? [row.default_reminder_kind] : ['release_day'];
  }
  return {
    ...DEFAULTS,
    ...row,
    default_reminder_kinds: kinds,
    default_reminder_kind: row.default_reminder_kind || legacyDefaultReminderKind(kinds),
    push_friends: row.push_friends !== false,
    push_catchup: row.push_catchup !== false,
    push_releases: row.push_releases !== false,
  };
}

export async function GET() {
  try {
    const user = await getServerUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;

    return new Response(
      JSON.stringify({
        preferences: coercePreferencesRow(data || { user_id: user.id, ...DEFAULTS }),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Failed to load preferences' }), { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const user = await getServerUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const body = await req.json();
    const supabase = await createServerClient();
    const { data: existing } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const existingCoerced = coercePreferencesRow(existing);
    const patch = {};

    if (body.timezone !== undefined) {
      patch.timezone = String(body.timezone).trim() || DEFAULTS.timezone;
    }
    if (body.push_enabled !== undefined) {
      patch.push_enabled = !!body.push_enabled;
    }
    if (body.push_friends !== undefined) {
      patch.push_friends = !!body.push_friends;
    }
    if (body.push_catchup !== undefined) {
      patch.push_catchup = !!body.push_catchup;
    }
    if (body.push_releases !== undefined) {
      patch.push_releases = !!body.push_releases;
    }

    let kinds = normalizeReminderKindsInput(body.default_reminder_kinds);
    if (kinds == null && body.default_reminder_kind !== undefined) {
      kinds = normalizeReminderKindsInput([String(body.default_reminder_kind)]);
    }

    if (kinds != null) {
      const customForVal =
        body.custom_days_before !== undefined
          ? body.custom_days_before
          : existingCoerced.custom_days_before;
      const v = validateReminderKindsAndCustom(kinds, customForVal);
      if (!v.ok) {
        return new Response(JSON.stringify({ error: v.error }), { status: 400 });
      }
      patch.default_reminder_kinds = kinds;
      patch.default_reminder_kind = legacyDefaultReminderKind(kinds);
    }

    if (body.custom_days_before !== undefined) {
      if (body.custom_days_before === null) {
        patch.custom_days_before = null;
      } else {
        const n = Number(body.custom_days_before);
        if (n < 1 || n > 30) {
          return new Response(JSON.stringify({ error: 'custom_days_before must be 1–30' }), {
            status: 400,
          });
        }
        patch.custom_days_before = n;
      }
    }

    const mergedKinds = patch.default_reminder_kinds ?? existingCoerced.default_reminder_kinds;
    const mergedCustom =
      patch.custom_days_before !== undefined
        ? patch.custom_days_before
        : existingCoerced.custom_days_before;

    if (mergedKinds.includes('custom')) {
      const c = mergedCustom;
      if (c == null || c < 1 || c > 30) {
        return new Response(
          JSON.stringify({ error: 'Choose how many days before (1–30) for the custom reminder.' }),
          { status: 400 },
        );
      }
    }

    const merged = {
      ...DEFAULTS,
      ...existingCoerced,
      user_id: user.id,
      ...patch,
      updated_at: new Date().toISOString(),
    };

    if (!merged.default_reminder_kinds?.length) {
      merged.default_reminder_kinds = ['release_day'];
    }
    merged.default_reminder_kind = legacyDefaultReminderKind(merged.default_reminder_kinds);

    const { data, error } = await supabase
      .from('notification_preferences')
      .upsert(
        {
          user_id: merged.user_id,
          timezone: merged.timezone,
          default_reminder_kind: merged.default_reminder_kind,
          default_reminder_kinds: merged.default_reminder_kinds,
          custom_days_before: merged.custom_days_before,
          push_enabled: merged.push_enabled,
          push_friends: merged.push_friends !== false,
          push_catchup: merged.push_catchup !== false,
          push_releases: merged.push_releases !== false,
          updated_at: merged.updated_at,
        },
        { onConflict: 'user_id' },
      )
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ preferences: coercePreferencesRow(data) }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Failed to save preferences' }), { status: 500 });
  }
}
