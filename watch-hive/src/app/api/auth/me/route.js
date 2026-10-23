import { NextResponse } from 'next/server';
import { createServerClient, getServerUser } from '../../../lib/supabase-server';

export async function GET() {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Not signed in' },
        { status: 401 }
      );
    }

    // Note: profiles table doesn't have email column - email is in auth.users (session claims)
    const supabase = await createServerClient();
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, display_name, created_at, preferences')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          display_name: user.email,
        }
      });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: profile.id,
        email: user.email,
        role: user.role,
        display_name: profile.display_name || user.email,
        created_at: profile.created_at,
        profile_visibility: profile.preferences?.profile_visibility || 'anyone',
      }
    });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { error: 'Error checking authentication status' },
      { status: 500 }
    );
  }
}
