import { NextResponse } from 'next/server';
import { getTokenFromRequest, validateUserFromToken, isTokenExpired } from '../../../utils/jwt';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

export async function PUT(request) {
  try {
    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'No authentication token found' }, { status: 401 });
    }

    const userPayload = validateUserFromToken(token);
    if (!userPayload) {
      return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 });
    }
    if (isTokenExpired(userPayload)) {
      return NextResponse.json({ error: 'Authentication token expired' }, { status: 401 });
    }
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const body = await request.json();
    const { display_name, profile_visibility: profileVisibility } = body;

    if (display_name === undefined && profileVisibility === undefined) {
      return NextResponse.json(
        { error: 'Provide display_name and/or profile_visibility' },
        { status: 400 }
      );
    }

    const dbUpdates = {};

    if (display_name !== undefined) {
      if (!display_name || display_name.trim().length === 0) {
        return NextResponse.json({ error: 'Display name is required' }, { status: 400 });
      }
      dbUpdates.display_name = display_name.trim();
    }

    // profile_visibility is stored inside the existing JSONB `preferences` column
    if (profileVisibility !== undefined) {
      if (!['friends', 'anyone', 'no_one'].includes(profileVisibility)) {
        return NextResponse.json(
          { error: 'profile_visibility must be friends, anyone, or no_one' },
          { status: 400 }
        );
      }

      // Read current preferences so we merge rather than overwrite
      const { data: current } = await supabaseAdmin
        .from('profiles')
        .select('preferences')
        .eq('id', userPayload.userId)
        .single();

      const prefs = current?.preferences || {};
      dbUpdates.preferences = { ...prefs, profile_visibility: profileVisibility };
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(dbUpdates)
      .eq('id', userPayload.userId)
      .select()
      .single();

    if (profileError) {
      if (profileError.code === 'PGRST116') {
        const { data: newProfile, error: createError } = await supabaseAdmin
          .from('profiles')
          .insert({
            id: userPayload.userId,
            display_name: (dbUpdates.display_name ?? userPayload.email ?? 'User').trim(),
            ...(dbUpdates.preferences && { preferences: dbUpdates.preferences }),
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating profile:', createError);
          return NextResponse.json({ error: 'Error updating profile' }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          user: {
            id: newProfile.id,
            email: userPayload.email,
            display_name: newProfile.display_name,
            profile_visibility: newProfile.preferences?.profile_visibility || 'anyone',
          }
        });
      }

      console.error('Error updating profile:', profileError);
      return NextResponse.json({ error: 'Error updating profile' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: profile.id,
        email: userPayload.email,
        display_name: profile.display_name,
        profile_visibility: profile.preferences?.profile_visibility || 'anyone',
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ error: 'Error updating profile' }, { status: 500 });
  }
}
