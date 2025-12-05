import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateToken, setAuthCookie } from '../../../utils/jwt';

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

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Verify credentials using Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData?.user) {
      return NextResponse.json(
        { error: 'Invalid login credentials' },
        { status: 401 }
      );
    }

    // Get user profile from profiles table
    // Note: profiles table doesn't have email - email is in auth.users
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, display_name')
      .eq('id', authData.user.id)
      .single();

    // Generate JWT token
    const token = generateToken({
      id: authData.user.id,
      email: authData.user.email,
      role: 'user', // Default role, can be extended later
    });

    // Create response with success message
    const response = NextResponse.json({
      success: true,
      message: 'Login successful!',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        display_name: profile?.display_name || authData.user.email,
        role: 'user',
      }
    });

    // Set secure HTTP-only cookie with JWT token
    return setAuthCookie(response, token);

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Error during login: ' + error.message },
      { status: 500 }
    );
  }
}
