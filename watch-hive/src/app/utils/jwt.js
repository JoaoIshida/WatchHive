import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';

const JWT_EXPIRES_IN = '30d'; // 30 days

/**
 * A public fallback secret lets anyone forge a session for any user id, so production refuses
 * to sign or accept tokens without JWT_SECRET (logins fail, public pages still render).
 */
function jwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET is not set');
  return 'watchhive-dev-only-secret';
}

/**
 * Generate JWT token for user
 */
export function generateToken(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role || 'user',
  };

  return jwt.sign(payload, jwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, jwtSecret());
    return decoded;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

/**
 * Set secure HTTP-only cookie with JWT token
 */
export function setAuthCookie(response, token) {
  response.cookies.set('watchhive-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60, // 30 days (seconds)
    path: '/',
  });

  return response;
}

/**
 * Clear authentication cookie
 */
export function clearAuthCookie(response) {
  response.cookies.set('watchhive-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });

  return response;
}

/**
 * Extract JWT token from request cookies
 */
export function getTokenFromRequest(request) {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {});

  return cookies['watchhive-token'] || null;
}

/**
 * Validate user from JWT token
 */
export function validateUserFromToken(token) {
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Check if token is expired
 */
export function isTokenExpired(payload) {
  if (!payload || !payload.exp) return true;
  return Date.now() >= payload.exp * 1000;
}
