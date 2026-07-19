import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  hashPassword,
  signJWT,
  setUserCookie,
  toSafeUser,
} from '@/lib/user-auth';

export async function POST(request: NextRequest) {
  try {
    const { email, username, password, nickname } = await request.json();

    // Validate input
    if (!email || !username || !password) {
      return NextResponse.json(
        { error: 'Email, username and password are required' },
        { status: 400 }
      );
    }

    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    if (typeof username !== 'string' || username.trim().length < 2) {
      return NextResponse.json(
        { error: 'Username must be at least 2 characters' },
        { status: 400 }
      );
    }

    if (typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Check for existing email / username
    const existingByEmail = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });
    if (existingByEmail) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    const existingByUsername = await prisma.user.findUnique({
      where: { username: username.trim() },
      select: { id: true },
    });
    if (existingByUsername) {
      return NextResponse.json(
        { error: 'Username already taken' },
        { status: 409 }
      );
    }

    // Create user
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        username: username.trim(),
        passwordHash,
        nickname: nickname?.trim() || null,
      },
    });

    // Issue JWT + set cookie
    const token = await signJWT(user.id);
    const response = NextResponse.json(toSafeUser(user), { status: 201 });
    response.headers.set('Set-Cookie', setUserCookie(token));
    return response;
  } catch (error) {
    console.error('[Register API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to register' },
      { status: 500 }
    );
  }
}
