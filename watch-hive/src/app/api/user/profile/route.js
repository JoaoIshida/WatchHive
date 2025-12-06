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

export async function PUT(request) {
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

    const { display_name } = await request.json();

    if (!display_name || display_name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Display name is required' },
        { status: 400 }
      );
    }

    // Update user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ display_name: display_name.trim() })
      .eq('id', userPayload.userId)
      .select()
      .single();

    if (profileError) {
      // If profile doesn't exist, create it
      if (profileError.code === 'PGRST116') {
        const { data: newProfile, error: createError } = await supabaseAdmin
          .from('profiles')
          .insert({
            id: userPayload.userId,
            display_name: display_name.trim(),
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating profile:', createError);
          return NextResponse.json(
            { error: 'Error updating profile' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          user: {
            id: newProfile.id,
            email: userPayload.email,
            display_name: newProfile.display_name,
          }
        });
      }

      console.error('Error updating profile:', profileError);
      return NextResponse.json(
        { error: 'Error updating profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: profile.id,
        email: userPayload.email,
        display_name: profile.display_name,
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { error: 'Error updating profile' },
      { status: 500 }
    );
  }
}

