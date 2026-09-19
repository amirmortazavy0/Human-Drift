/**
 * server/auth.ts
 * Authentication service and Express JWT middleware for Human Drift:
 * - Reads/writes user credentials to backend/data/users.json (completely isolated from human_drift.json)
 * - Password hashing and verification using bcrypt (compatible with Python bcrypt)
 * - Generates and validates standard 7-day HS256 JWT tokens (compatible with python-jose)
 * - Protects non-public API endpoints with 401 Unauthorized verification
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';

export interface StoredUser {
  username: string;
  password_hash: string;
  created_at: string;
}

interface UsersData {
  users: StoredUser[];
}

const JWT_SECRET = process.env.JWT_SECRET || 'human-drift-secret-key-change-in-production';
const ACCESS_TOKEN_EXPIRE_SECONDS = 7 * 24 * 60 * 60; // 7 days

// Locate users.json
function getUsersFilePath(): string {
  const primary = path.join(process.cwd(), 'backend', 'data', 'users.json');
  if (fs.existsSync(primary)) return primary;
  const secondary = path.join(process.cwd(), 'backend', 'users.json');
  if (fs.existsSync(secondary)) return secondary;
  return primary;
}

export function readUsers(): UsersData {
  const filePath = getUsersFilePath();
  if (!fs.existsSync(filePath)) {
    return { users: [] };
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed reading users.json:', err);
    return { users: [] };
  }
}

export function writeUsers(data: UsersData): void {
  const filePath = getUsersFilePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempPath, filePath);

  // Sync secondary path if exists
  const altPath = path.join(process.cwd(), 'backend', 'users.json');
  if (altPath !== filePath && fs.existsSync(altPath)) {
    try {
      fs.writeFileSync(`${altPath}.tmp`, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(`${altPath}.tmp`, altPath);
    } catch {
      // Ignore sync error
    }
  }
}

// Helpers for HS256 JWT
function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf-8');
}

export function createJwtToken(username: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: username,
    iat: now,
    exp: now + ACCESS_TOKEN_EXPIRE_SECONDS,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${data}.${signature}`;
}

export function verifyJwtToken(token: string): { username: string } | null {
  try {
    const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
    const parts = cleanToken.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const data = `${headerB64}.${payloadB64}`;

    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(data)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    // Constant-time comparison
    if (
      signatureB64.length !== expectedSig.length ||
      !crypto.timingSafeEqual(Buffer.from(signatureB64), Buffer.from(expectedSig))
    ) {
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(payloadB64));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }

    if (!payload.sub || typeof payload.sub !== 'string') {
      return null;
    }

    return { username: payload.sub };
  } catch (err) {
    return null;
  }
}

export async function signupUser(
  usernameRaw: string,
  passwordRaw: string
): Promise<{ token: string; username: string }> {
  const username = (usernameRaw || '').trim();
  const password = passwordRaw || '';

  if (!username) {
    throw new Error('Username cannot be empty');
  }
  if (!password) {
    throw new Error('Password cannot be empty');
  }

  const data = readUsers();
  const exists = data.users.some(
    (u) => u.username.toLowerCase() === username.toLowerCase()
  );

  if (exists) {
    throw new Error('Username already exists');
  }

  const saltRounds = 10;
  const password_hash = await bcrypt.hash(password, saltRounds);

  const newUser: StoredUser = {
    username,
    password_hash,
    created_at: new Date().toISOString(),
  };

  data.users.push(newUser);
  writeUsers(data);

  const token = createJwtToken(username);
  return { token, username };
}

export async function loginUser(
  usernameRaw: string,
  passwordRaw: string
): Promise<{ token: string; username: string }> {
  const username = (usernameRaw || '').trim();
  const password = passwordRaw || '';

  if (!username || !password) {
    throw new Error('Invalid username or password');
  }

  const data = readUsers();
  const user = data.users.find(
    (u) => u.username.toLowerCase() === username.toLowerCase()
  );

  if (!user) {
    throw new Error('Invalid username or password');
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw new Error('Invalid username or password');
  }

  const token = createJwtToken(user.username);
  return { token, username: user.username };
}

export interface AuthenticatedRequest extends Request {
  user?: { username: string };
}

export function expressAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const path = req.path;

  // Public paths whitelist
  const publicPaths = [
    '/auth/signup',
    '/auth/login',
    '/api/auth/signup',
    '/api/auth/login',
    '/api/health',
  ];

  if (publicPaths.includes(path) || req.method === 'OPTIONS') {
    return next();
  }

  // If this is an API route or auth/me route, enforce authentication
  if (path.startsWith('/api/') || path === '/auth/me' || path === '/api/auth/me') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ detail: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7).trim();
    const verified = verifyJwtToken(token);
    if (!verified) {
      return res.status(401).json({ detail: 'Could not validate credentials' });
    }

    req.user = verified;
    return next();
  }

  // Non-API paths (Vite assets, index.html, static files)
  return next();
}
