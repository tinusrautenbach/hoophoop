import { NextResponse } from 'next/server';
import { db } from '@/db';
import { teamMemberships, athletes, playerHistory } from '@/db/schema';
import { auth } from '@/lib/auth-server';
import { eq, and, isNull } from 'drizzle-orm';

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string; memberId: string }> }
) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { memberId } = await params;

    try {
        const body = await request.json();
        const { number, notes } = body;

        const membership = await db.query.teamMemberships.findFirst({
            where: eq(teamMemberships.id, memberId),
            with: { athlete: true },
        });

        if (!membership) {
            return NextResponse.json({ error: 'Membership not found' }, { status: 404 });
        }

        const previousNumber = membership.number;

        const [updated] = await db.update(teamMemberships)
            .set({
                number: number !== undefined ? number?.toString() : membership.number,
                notes: notes !== undefined ? notes : membership.notes,
            })
            .where(eq(teamMemberships.id, memberId))
            .returning();

        if (number !== undefined && number?.toString() !== previousNumber) {
            await db.insert(playerHistory).values({
                athleteId: membership.athleteId,
                teamId: membership.teamId,
                action: 'number_changed',
                previousValue: previousNumber || null,
                newValue: number?.toString() || null,
                performedBy: userId,
                notes: 'Jersey number updated',
            });
        }

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Error updating membership:', error);
        return NextResponse.json({ error: 'Failed to update membership' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string; memberId: string }> }
) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { memberId } = await params;

    try {
        const membership = await db.query.teamMemberships.findFirst({
            where: eq(teamMemberships.id, memberId),
            with: { athlete: true },
        });

        if (!membership) {
            return NextResponse.json({ error: 'Membership not found' }, { status: 404 });
        }

        const today = new Date().toISOString().split('T')[0];

        await db.update(teamMemberships)
            .set({
                endDate: today,
                isActive: false,
            })
            .where(eq(teamMemberships.id, memberId));

        await db.insert(playerHistory).values({
            athleteId: membership.athleteId,
            teamId: membership.teamId,
            action: 'removed',
            previousValue: membership.number || null,
            performedBy: userId,
            notes: 'Player removed from team roster',
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error removing team member:', error);
        return NextResponse.json({ error: 'Failed to remove team member' }, { status: 500 });
    }
}
