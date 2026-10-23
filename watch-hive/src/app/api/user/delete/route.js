import { NextResponse } from 'next/server';
import { getTokenFromRequest, validateUserFromToken, isTokenExpired } from '../../../utils/jwt';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Create Supabase admin client for server-side operations
const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

export async function DELETE(request) {
  try {
    // Extract JWT token from request
    const token = getTokenFromRequest(request);

    if (!token) {
      return NextResponse.json(
        { error: 'No authentication token found' },
        { status: 401 }
      );
    }

    // Validate JWT token
    const userPayload = validateUserFromToken(token);

    if (!userPayload) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }

    // Check if token is expired
    if (isTokenExpired(userPayload)) {
      return NextResponse.json(
        { error: 'Authentication token expired' },
        { status: 401 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const userId = userPayload.userId;

    // Deleting the auth user cascades: profiles -> auth.users ON DELETE CASCADE, and every user
    // table -> profiles ON DELETE CASCADE. Deleting tables first (errors ignored) wiped the data
    // even when the auth delete then failed, leaving an empty account behind.
    // Delete auth user (this requires admin privileges)
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      console.error('Error deleting auth user:', deleteAuthError);
      return NextResponse.json(
        { error: 'Error deleting account' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Account deleted successfully'
    });

  } catch (error) {
    console.error('Account deletion error:', error);
    return NextResponse.json(
      { error: 'Error deleting account' },
      { status: 500 }
    );
  }
}

