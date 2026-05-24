import { NextResponse } from 'next/server';
import {
  getTokenFromRequest,
  validateUserFromToken,
  isTokenExpired,
} from '../../../utils/jwt';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Mint a Supabase session for the logged-in user so Realtime subscriptions work
 * after a page reload (JWT cookie alone does not restore supabase-js auth).
 */
export async function GET(request) {
  try {
    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userPayload = validateUserFromToken(token);
    if (!userPayload || isTokenExpired(userPayload)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 },
      );
    }

    const res = await fetch(
      `${supabaseUrl}/auth/v1/admin/users/${userPayload.userId}/sessions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          apikey: supabaseServiceKey,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!res.ok) {
      const detail = await res.text();
      console.error('Supabase admin session failed:', res.status, detail);
      return NextResponse.json(
        { error: 'Could not create realtime session' },
        { status: 502 },
      );
    }

    const session = await res.json();
    return NextResponse.json({
      success: true,
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at ?? null,
      },
    });
  } catch (error) {
    console.error('Realtime session error:', error);
    return NextResponse.json(
      { error: 'Error creating realtime session' },
      { status: 500 },
    );
  }
}
