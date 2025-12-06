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

    // Delete all user data from related tables (cascade should handle this, but being explicit)
    // Note: Supabase handles cascading deletes if foreign keys are set up correctly
    // We'll delete from all related tables first, then delete the auth user

    // Delete watched content
    await supabaseAdmin
      .from('watched_content')
      .delete()
      .eq('user_id', userId);

    // Delete wishlist
    await supabaseAdmin
      .from('wishlist')
      .delete()
      .eq('user_id', userId);

    // Delete series progress
    await supabaseAdmin
      .from('series_progress')
      .delete()
      .eq('user_id', userId);

    // Delete custom lists (and their items via cascade)
    await supabaseAdmin
      .from('custom_lists')
      .delete()
      .eq('user_id', userId);

    // Delete profile
    await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId);

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

