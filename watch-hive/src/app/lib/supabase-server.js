/**
 * Supabase Server Client Helper
 * Creates a Supabase client for server-side use (API routes, Server Components)
 * Uses JWT token authentication with service role key for database operations
 */

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken, isTokenExpired } from '../utils/jwt';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env.local file.');
}

/**
 * Get Supabase admin client for server-side database operations
 * Uses service role key for full database access
 * Use this in API routes for database queries
 */
export async function createServerClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

/**
 * Get authenticated user from cookies (validates JWT token)
 * Returns user object with id, email, role if valid, null otherwise
 * Use this in API routes to get the authenticated user
 */
export async function getServerUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('watchhive-token')?.value;

    if (!token) {
      return null;
    }

    // Validate JWT token
    const userPayload = verifyToken(token);

    if (!userPayload) {
      return null;
    }

    // Check if token is expired
    if (isTokenExpired(userPayload)) {
      return null;
    }

    // Return user object with consistent structure
    return {
      id: userPayload.userId || userPayload.id,
      email: userPayload.email,
      role: userPayload.role || 'user',
    };
  } catch (error) {
    console.error('Error getting server user:', error);
    return null;
  }
}
