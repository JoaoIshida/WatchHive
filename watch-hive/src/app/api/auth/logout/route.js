import { NextResponse } from 'next/server';
import { clearAuthCookie } from '../../../utils/jwt';

export async function POST(request) {
  try {
    // Create response with success message
    const response = NextResponse.json({
      success: true,
      message: 'Logout successful!'
    });

    // Clear the authentication cookie
    return clearAuthCookie(response);

  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Error during logout: ' + error.message },
      { status: 500 }
    );
  }
}
