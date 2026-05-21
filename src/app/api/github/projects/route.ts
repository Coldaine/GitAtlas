import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const username = request.nextUrl.searchParams.get('username');
    if (!username) {
      return NextResponse.json({ error: 'username is required' }, { status: 400 });
    }

    const projects = await db.project.findMany({
      where: {
        OR: [
          { ownerLogin: username },
        ],
      },
      orderBy: { githubUpdatedAt: 'desc' },
    });

    const analysisJob = await db.analysisJob.findFirst({
      where: { username },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      projects: projects.map(p => ({
        ...p,
        topics: p.topics ? p.topics.split(',').filter(Boolean) : [],
        tags: p.tags ? p.tags.split(',').filter(Boolean) : [],
      })),
      analysisJob,
    });
  } catch (error: any) {
    console.error('Projects error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
