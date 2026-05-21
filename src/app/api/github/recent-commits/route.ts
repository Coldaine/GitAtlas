import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { GITHUB_HEADERS } from '@/lib/github-token';

interface RecentCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  repo: string;
  repoFullName: string;
  url: string;
}

export async function GET(request: NextRequest) {
  try {
    const username = request.nextUrl.searchParams.get('username');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '30', 10);

    if (!username) {
      return NextResponse.json({ error: 'username is required' }, { status: 400 });
    }

    // Check cache
    try {
      const cached = await db.recentCommitsCache.findUnique({ where: { username } });
      if (cached) {
        const ageMs = Date.now() - cached.fetchedAt.getTime();
        if (ageMs < 10 * 60 * 1000) { // 10 minute cache
          const commits: RecentCommit[] = JSON.parse(cached.commitsJson);
          return NextResponse.json({
            commits: commits.slice(0, limit),
            total: commits.length,
            cached: true,
          });
        }
      }
    } catch {
      // Cache table might not exist yet — skip
    }

    // Get all repos for this user from DB
    const projects = await db.project.findMany({
      where: { ownerLogin: username },
      select: { fullName: true, name: true },
    });

    if (projects.length === 0) {
      return NextResponse.json({ error: 'No projects found for this user' }, { status: 404 });
    }

    const allCommits: RecentCommit[] = [];

    // Fetch recent commits per repo (in batches of 5)
    const batchSize = 5;
    for (let i = 0; i < projects.length; i += batchSize) {
      const batch = projects.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map(async (project) => {
          try {
            const res = await fetch(
              `https://api.github.com/repos/${project.fullName}/commits?per_page=10`,
              { headers: GITHUB_HEADERS }
            );
            if (!res.ok) return [];

            const data = await res.json();
            return (data || []).map((c: any) => ({
              sha: c.sha?.substring(0, 7) || '',
              message: (c.commit?.message || '').split('\n')[0].substring(0, 120),
              author: c.commit?.author?.name || c.author?.login || 'Unknown',
              date: c.commit?.author?.date || c.commit?.committer?.date || '',
              repo: project.name,
              repoFullName: project.fullName,
              url: c.html_url || `https://github.com/${project.fullName}/commit/${c.sha}`,
            }));
          } catch {
            return [];
          }
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          allCommits.push(...(result.value as RecentCommit[]));
        }
      }

      // Small delay between batches
      if (i + batchSize < projects.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    // Sort by date descending and take top limit
    allCommits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const topCommits = allCommits.slice(0, 100); // Cache up to 100

    // Upsert cache
    try {
      await db.recentCommitsCache.upsert({
        where: { username },
        update: {
          commitsJson: JSON.stringify(topCommits),
          fetchedAt: new Date(),
        },
        create: {
          username,
          commitsJson: JSON.stringify(topCommits),
          fetchedAt: new Date(),
        },
      });
    } catch {
      // Cache table might not exist yet — skip
    }

    return NextResponse.json({
      commits: topCommits.slice(0, limit),
      total: topCommits.length,
      cached: false,
    });
  } catch (error: any) {
    console.error('Recent commits error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
