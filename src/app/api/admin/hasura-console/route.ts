import { NextResponse } from 'next/server';
import { isWorldAdmin } from '@/lib/auth-admin';

export async function GET() {
    const admin = await isWorldAdmin();
    if (!admin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const hasuraUrl = process.env.NEXT_PUBLIC_HASURA_URL ?? 'http://localhost:8080/v1/graphql';
    const adminSecret = process.env.HASURA_ADMIN_SECRET;

    if (!adminSecret) {
        return NextResponse.json({ error: 'HASURA_ADMIN_SECRET is not set' }, { status: 503 });
    }

    // Derive the console URL from the GraphQL endpoint:
    // e.g. http://localhost:8080/v1/graphql → http://localhost:8080/console
    const consoleUrl = new URL(hasuraUrl);
    consoleUrl.pathname = '/console';

    return NextResponse.json({ consoleUrl: consoleUrl.toString(), adminSecret });
}
