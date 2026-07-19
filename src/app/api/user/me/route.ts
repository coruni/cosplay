import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser, toSafeUser } from '@/lib/user-auth';
import { getSubscriptionStatus } from '@/lib/subscription';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const subscription = await getSubscriptionStatus(user.id);
  return NextResponse.json({ ...user, subscription });
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { nickname, avatar } = body;

    const data: { nickname?: string | null; avatar?: string | null } = {};
    if (typeof nickname === 'string') {
      data.nickname = nickname.trim() || null;
    }
    if (typeof avatar === 'string') {
      data.avatar = avatar.trim() || null;
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data,
    });

    return NextResponse.json(toSafeUser(updated));
  } catch (error) {
    console.error('[Me API] PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
