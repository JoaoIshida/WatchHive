import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request) {
  const results = {
    supabaseUrl: supabaseUrl ? 'SET' : 'MISSING',
    supabaseServiceKey: supabaseServiceKey ? 'SET' : 'MISSING',
    connectionStatus: 'unknown',
    error: null,
  };

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({
      ...results,
      connectionStatus: 'failed',
      error: 'Missing environment variables',
    }, { status: 500 });
  }

  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Test connection by checking if we can access auth
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1
    });

    if (error) {
      results.connectionStatus = 'error';
      results.error = error.message;
    } else {
      results.connectionStatus = 'connected';
      results.userCount = data?.users?.length || 0;
    }

    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json({
      ...results,
      connectionStatus: 'error',
      error: error.message,
    }, { status: 500 });
  }
}

