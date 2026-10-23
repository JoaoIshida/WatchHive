import { NextResponse } from 'next/server';
import { createAuthClient } from '../../../lib/supabase-server';

export async function POST() {
  try {
    // Revokes the refresh token and clears the Supabase session cookies.
    const authClient = await createAuthClient();
    await authClient.auth.signOut();

    const response = NextResponse.json({
      success: true,
      message: 'Logout successful!'
    });
    // Clear the pre-Supabase-session cookie too, for browsers that still carry it.
    response.cookies.set('watchhive-token', '', { maxAge: 0, path: '/' });
    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Error during logout' },
      { status: 500 }
    );
  }
}
