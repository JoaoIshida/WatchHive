/**
 * Supabase Server Client Helper
 * - createServerClient(): service-role client for database operations in API routes.
 * - createAuthClient(): anon client bound to the request's Supabase session cookies (sign in/out).
 * - getServerUser(): the signed-in user from the Supabase session cookie, or null.
 */

import { createClient } from '@supabase/supabase-js';
import { createServerClient as createSsrClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables.');
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
 * Anon client that reads/writes the Supabase auth cookies for this request. Used to sign in,
 * sign out and read the session. Never use it for privileged queries.
 */
export async function createAuthClient() {
  const cookieStore = await cookies();
  return createSsrClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components can't set cookies; the middleware refreshes the session instead.
        }
      },
    },
  });
}

/**
 * Get the authenticated user from the Supabase session cookie.
 * getClaims() verifies the access token (locally with asymmetric signing keys, otherwise
 * against Supabase Auth), so a forged cookie is rejected.
 * Returns { id, email, role } or null.
 */
export async function getServerUser() {
  try {
    const supabase = await createAuthClient();
    const { data, error } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (error || !claims?.sub) return null;
    return {
      id: claims.sub,
      email: claims.email ?? null,
      role: 'user',
    };
  } catch (error) {
    console.error('Error getting server user:', error);
    return null;
  }
}

/**
 * PostgREST returns at most 1000 rows per request, silently. Page through a select until a short
 * page comes back. `buildQuery` must return a fresh, ordered query each call.
 * @param {() => any} buildQuery
 */
export async function selectAllPages(buildQuery, pageSize = 1000) {
  const all = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < pageSize) return all;
  }
}
