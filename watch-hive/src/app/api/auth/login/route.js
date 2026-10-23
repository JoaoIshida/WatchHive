import { NextResponse } from 'next/server';
import { createAuthClient, createServerClient } from '../../../lib/supabase-server';

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Signs in and writes the Supabase session cookies onto this response. The browser client
    // reads the same cookies, so Realtime works without a separate session handoff.
    const authClient = await createAuthClient();
    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData?.user) {
      return NextResponse.json(
        { error: 'Invalid login credentials' },
        { status: 401 }
      );
    }

    // Note: profiles table doesn't have email - email is in auth.users
    const supabase = await createServerClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, display_name, preferences')
      .eq('id', authData.user.id)
      .single();

    return NextResponse.json({
      success: true,
      message: 'Login successful!',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        display_name: profile?.display_name || authData.user.email,
        role: 'user',
        // Same field /api/auth/me returns; without it Settings showed "Anyone" after login and
        // saving there silently made a private profile public.
        profile_visibility: profile?.preferences?.profile_visibility || 'anyone',
      },
      // The browser client already initialized without a session; it adopts this one via
      // setSession so Realtime subscribes as the user. Same tokens as the cookies just set.
      session: authData.session
        ? {
            access_token: authData.session.access_token,
            refresh_token: authData.session.refresh_token,
          }
        : null,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Error during login' },
      { status: 500 }
    );
  }
}
