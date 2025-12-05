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

export async function GET(request) {
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

    // Get fresh user data from database
    // Note: profiles table doesn't have email column - email is in auth.users
    // We'll get email from JWT payload (userPayload.email)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, display_name, created_at')
      .eq('id', userPayload.userId)
      .single();

    // If profile doesn't exist, return user from token
    if (profileError || !profile) {
      return NextResponse.json({
        success: true,
        user: {
          id: userPayload.userId,
          email: userPayload.email,
          role: userPayload.role || 'user',
          display_name: userPayload.email,
        }
      });
    }

    // Return user data (without sensitive information)
    // Email comes from JWT payload (auth.users), not from profiles table
    return NextResponse.json({
      success: true,
      user: {
        id: profile.id,
        email: userPayload.email, // Email from JWT (auth.users)
        role: userPayload.role || 'user',
        display_name: profile.display_name || userPayload.email,
        created_at: profile.created_at,
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
