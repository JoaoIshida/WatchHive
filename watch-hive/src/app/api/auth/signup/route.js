/**
 * Signup API Route
 * 
 * NOTE: This route includes workarounds for database trigger issues.
 * If user creation fails with "Database error creating new user" (status 500),
 * it means the create_profile_for_new_user() trigger function in the database
 * is failing. The code attempts to work around this by:
 * 1. Trying REST API directly (bypasses some client-side checks)
 * 2. Creating profiles manually if trigger fails
 * 
 * ROOT CAUSE: The database trigger function may need to be fixed. Common issues:
 * - Missing INSERT RLS policy on profiles table (even SECURITY DEFINER functions may need it)
 * - Trigger function logic errors (uniqueness checks, email parsing, etc.)
 * - Database connection/permission issues in trigger context
 * 
 * To fix permanently: Review and fix the create_profile_for_new_user() function
 * in supabase/schema.sql, or add an INSERT RLS policy for profiles table.
 */

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
    const { email, password, displayName } = await request.json();

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Validate display_name (required, unique, 2+ characters)
    if (!displayName || displayName.trim().length < 2) {
      return NextResponse.json(
        { error: 'Display name must be at least 2 characters long' },
        { status: 400 }
      );
    }

    const trimmedDisplayName = displayName.trim();

    if (!supabaseAdmin) {
      console.error('Supabase admin client not initialized. Check environment variables:');
      console.error('- NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING');
      console.error('- SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING');
      return NextResponse.json(
        { error: 'Server configuration error: Supabase credentials not configured' },
        { status: 500 }
      );
    }

    // Check if display_name is already taken (must be unique)
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('display_name')
      .eq('display_name', trimmedDisplayName)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        { error: 'This display name is already taken. Please choose another.' },
        { status: 400 }
      );
    }

    // Note: We'll check for existing email during user creation
    // The Supabase API will return an error if email already exists

    let authData = null;
    let authError = null;

    // Try creating user with metadata first (trigger will handle profile)
    // If that fails due to trigger issues, we'll create user without metadata and handle profile manually
    try {
      const result = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          display_name: trimmedDisplayName, // Required, unique, 2+ characters
        }
      });

      authData = result.data;
      authError = result.error;
    } catch (err) {
      console.error('Exception during user creation:', err);
      authError = {
        message: err.message || 'Failed to create user account',
        status: 500,
        code: 'unexpected_failure'
      };
    }

    // If user creation failed, check if user was actually created despite the error
    // Sometimes triggers fail but the user is still created
    if (authError || !authData?.user) {
      // Check if it's a database/trigger error (status 500, unexpected_failure)
      const isDatabaseError = authError?.status === 500 || 
                             authError?.code === 'unexpected_failure' ||
                             authError?.message?.toLowerCase().includes('database');

      if (isDatabaseError) {
        console.log('Database error detected - trigger is blocking user creation.');
        console.log('Attempting to use Supabase REST API directly to bypass trigger issues...');
        
        // The trigger is completely blocking user creation
        // Try using Supabase's REST API directly with service role
        // This might bypass some client-side checks
        try {
          const supabaseRestUrl = `${supabaseUrl}/auth/v1/admin/users`;
          const response = await fetch(supabaseRestUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'apikey': supabaseServiceKey,
            },
            body: JSON.stringify({
              email,
              password,
              email_confirm: true,
              user_metadata: {
                display_name: trimmedDisplayName,
              }
            }),
          });

          const restData = await response.json();

          if (!response.ok) {
            console.error('REST API user creation also failed:', restData);
            // If REST API also fails, the trigger is definitely the issue
            // Return a helpful error message
            return NextResponse.json(
              { 
                error: 'Account creation is currently unavailable due to a database configuration issue. Please contact support or try again later. The database trigger function may need to be fixed.',
                details: 'The user creation trigger in the database is failing. This requires a database administrator to fix the trigger function.'
              },
              { status: 500 }
            );
          }

          // Success with REST API
          // REST API returns user data directly, not wrapped in a user object
          const userId = restData.id || restData.user?.id;
          const userEmail = restData.email || restData.user?.email;
          
          if (userId) {
            console.log('User created via REST API, proceeding with profile creation...');
            authData = { 
              user: {
                id: userId,
                email: userEmail,
                user_metadata: restData.user_metadata || restData.user?.user_metadata || {},
              }
            };
            authError = null;
          } else {
            console.error('REST API response missing user ID:', restData);
            authError = { message: 'User creation succeeded but no user ID returned', status: 500 };
          }
        } catch (restError) {
          console.error('REST API approach also failed:', restError);
          // All approaches failed - trigger is definitely broken
          return NextResponse.json(
            { 
              error: 'Account creation is currently unavailable due to a database configuration issue. Please contact support. The database trigger function needs to be fixed.',
              technicalDetails: 'The create_profile_for_new_user() trigger function is failing. This requires database administrator access to fix.'
            },
            { status: 500 }
          );
        }
      } else {
        // Not a database error - return user-friendly message
        console.error('Supabase auth error creating user:');
        console.error('- Full error object:', JSON.stringify(authError, null, 2));
        console.error('- Error message:', authError?.message);
        console.error('- Error status:', authError?.status);
        console.error('- Auth data:', authData);
        
        let errorMessage = authError?.message || 'Failed to create user account';
        
        // Provide user-friendly error messages
        if (errorMessage.toLowerCase().includes('already registered') || 
            errorMessage.toLowerCase().includes('already exists') ||
            errorMessage.toLowerCase().includes('user already')) {
          errorMessage = 'This email is already registered. Please sign in instead.';
        } else if (errorMessage.toLowerCase().includes('invalid email') ||
                   errorMessage.toLowerCase().includes('email')) {
          errorMessage = 'Please enter a valid email address.';
        } else if (errorMessage.toLowerCase().includes('password') ||
                   errorMessage.toLowerCase().includes('weak')) {
          errorMessage = 'Password does not meet requirements. Please use a stronger password.';
        }
        
        return NextResponse.json(
          { error: errorMessage },
          { status: 400 }
        );
      }
    }

    // If we still don't have a user, return error with helpful message
    if (!authData?.user) {
      const errorMsg = authError?.code === 'unexpected_failure' || authError?.status === 500
        ? 'Database error during account creation. This may be a temporary issue. Please try again in a moment, or contact support if the problem persists.'
        : 'Failed to create user account. Please try again.';
      
      return NextResponse.json(
        { error: errorMsg },
        { status: 500 }
      );
    }

    // Wait a moment for trigger to potentially create profile
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if profile was created by trigger
    let profile = null;
    let profileCheckError = null;
    let needsDisplayNameUpdate = false;
    
    // Try multiple times in case trigger is slow
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: existingProfileData, error: checkError } = await supabaseAdmin
        .from('profiles')
        .select('id, display_name')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (existingProfileData) {
        profile = existingProfileData;
        // Check if profile has temporary display_name (starts with 'temp_')
        if (profile.display_name && profile.display_name.startsWith('temp_')) {
          needsDisplayNameUpdate = true;
        }
        break;
      }
      
      profileCheckError = checkError;
      
      // Wait before retrying
      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // If profile doesn't exist (trigger might have failed), create it manually
    if (!profile) {
      console.log('Profile not found after trigger, creating manually...');
      
      // Try to create profile with the desired display_name
      // If that fails due to uniqueness, try with a fallback name
      let profileCreated = false;
      let finalDisplayName = trimmedDisplayName;
      
      for (let attempt = 0; attempt < 2; attempt++) {
        const { data: newProfile, error: createProfileError } = await supabaseAdmin
          .from('profiles')
          .insert({
            id: authData.user.id,
            display_name: finalDisplayName,
          })
          .select()
          .single();

        if (newProfile && !createProfileError) {
          profile = newProfile;
          profileCreated = true;
          break;
        }
        
        // Check if it's a uniqueness constraint violation
        if (createProfileError?.code === '23505' || createProfileError?.message?.includes('unique')) {
          // Display name taken, try with a suffix
          if (attempt === 0) {
            finalDisplayName = trimmedDisplayName + '_' + Date.now().toString(36);
            console.log(`Display name taken, trying with fallback: ${finalDisplayName}`);
            continue;
          } else {
            // Both attempts failed
            console.error('Failed to create profile with unique display_name:', createProfileError);
            
            // If profile creation fails, we should delete the auth user to avoid orphaned accounts
            try {
              await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            } catch (deleteError) {
              console.error('Failed to clean up auth user after profile creation failure:', deleteError);
            }
            
            return NextResponse.json(
              { error: 'This display name is already taken. Please choose another.' },
              { status: 400 }
            );
          }
        }
        
        // Other error
        console.error('Database error creating profile:', createProfileError);
        
        // If profile creation fails, we should delete the auth user to avoid orphaned accounts
        try {
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        } catch (deleteError) {
          console.error('Failed to clean up auth user after profile creation failure:', deleteError);
        }
        
        return NextResponse.json(
          { error: `Failed to create user profile: ${createProfileError?.message || 'Database error'}` },
          { status: 500 }
        );
      }
      
      if (!profileCreated) {
        // Final fallback - this shouldn't happen, but just in case
        console.error('All profile creation attempts failed');
        try {
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        } catch (deleteError) {
          console.error('Failed to clean up auth user:', deleteError);
        }
        return NextResponse.json(
          { error: 'Failed to create user profile. Please try again.' },
          { status: 500 }
        );
      }
    }
    
    // Update display_name if needed (either from trigger or temporary name)
    if (profile && (profile.display_name !== trimmedDisplayName || needsDisplayNameUpdate)) {
      console.log('Profile exists with different display_name, updating to desired name...');
      const { data: updatedProfile, error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ display_name: trimmedDisplayName })
        .eq('id', authData.user.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating profile display_name:', updateError);
        // Check if it's a uniqueness error
        if (updateError.code === '23505' || updateError.message?.includes('unique')) {
          // Can't update to desired name - try with a suffix
          const fallbackName = trimmedDisplayName + '_' + Date.now().toString(36);
          console.log(`Display name taken, trying fallback: ${fallbackName}`);
          
          const { data: fallbackProfile, error: fallbackError } = await supabaseAdmin
            .from('profiles')
            .update({ display_name: fallbackName })
            .eq('id', authData.user.id)
            .select()
            .single();
          
          if (fallbackError) {
            console.error('Failed to update with fallback name:', fallbackError);
            // Use existing name - signup succeeds but with different display_name
            console.log('Using existing display_name:', profile.display_name);
          } else {
            profile = fallbackProfile;
          }
        } else {
          // Other error - log but don't fail signup, use existing name
          console.error('Non-uniqueness error updating display_name:', updateError);
        }
      } else {
        profile = updatedProfile;
      }
    }

    // Ensure we have a valid profile
    if (!profile) {
      console.error('Profile creation failed - no profile available');
      // Try to clean up auth user
      try {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      } catch (deleteError) {
        console.error('Failed to clean up auth user:', deleteError);
      }
      return NextResponse.json(
        { error: 'Failed to create user profile. Please try again.' },
        { status: 500 }
      );
    }

    // Generate JWT token
    const token = generateToken({
      id: authData.user.id,
      email: authData.user.email,
      role: 'user',
    });

    // Create response with success message
    const response = NextResponse.json({
      success: true,
      message: 'Signup successful!',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        display_name: profile.display_name || trimmedDisplayName,
        role: 'user',
      }
    });

    // Set secure HTTP-only cookie with JWT token
    return setAuthCookie(response, token);

  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Error during signup: ' + error.message },
      { status: 500 }
    );
  }
}
