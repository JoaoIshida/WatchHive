import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production-watchhive';
const JWT_EXPIRES_IN = '30d'; // 30 days

/**
 * Generate JWT token for user
 */
export function generateToken(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role || 'user',
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
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
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
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
