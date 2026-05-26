import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'node:crypto';

/**
 * POST /api/webhooks/github
 *
 * Why this exists:
 *   Polling refresh (`/api/sync/refresh`) is fine for a 15-minute cadence, but
 *   if the user wires GitHub webhooks to GitAtlas the dashboard can reflect
 *   pushes within seconds. This endpoint takes a `push`, `repository`, or
 *   `create` event and marks the affected repo stale so the enrich worker
 *   re-runs analysis on its next tick.
 *
 * Security:
 *   GitHub signs every delivery with HMAC-SHA256 using GITHUB_WEBHOOK_SECRET.
 *   We verify the signature in constant time before touching the DB.
 *   If the secret env var is missing we reject all requests (fail closed) so
 *   the endpoint can never be abused as an unauthenticated DB writer.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    // Fail closed: better a 503 than an open writer.
    return NextResponse.json(
      { error: 'GITHUB_WEBHOOK_SECRET not configured' },
      { status: 503 },
    );
  }

  const signature = request.headers.get('x-hub-signature-256') || '';
  const event = request.headers.get('x-github-event') || '';
  const raw = await request.text();

  const expected =
    'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex');

  // Constant-time compare to avoid timing leaks.
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let payload: any = {};
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  // Events we react to. Anything else gets a 200 noop so GitHub keeps delivering.
  if (!['push', 'repository', 'create'].includes(event)) {
    return NextResponse.json({ ok: true, ignored: event });
  }

  const repo = payload.repository;
  if (!repo?.id) {
    return NextResponse.json({ ok: true, ignored: 'no repository in payload' });
  }

  // Why null both fields: lets the enrich worker re-analyze on its next tick
  // instead of duplicating the AI calls inline here (keeps the webhook fast).
  try {
    await db.project.update({
      where: { githubId: repo.id },
      data: {
        analyzedAt: null,
        deepAnalyzedAt: null,
        githubUpdatedAt: repo.updated_at ? new Date(repo.updated_at) : new Date(),
        pushedAt: repo.pushed_at ? new Date(repo.pushed_at) : new Date(),
      },
    });
    return NextResponse.json({ ok: true, marked: repo.full_name, event });
  } catch (err: any) {
    // The repo might not exist locally yet; that's fine \u2014 the next /api/sync/refresh
    // will pick it up. Don't 500, just acknowledge.
    return NextResponse.json({ ok: true, missing: true, error: err?.message });
  }
}
