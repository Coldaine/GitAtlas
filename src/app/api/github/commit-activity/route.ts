import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { GITHUB_HEADERS } from '@/lib/github-token';

interface CommitDay {
  date: string;
  count: number;
  repos: string[];
}

export async function GET(request: NextRequest) {
  try {
    const username = request.nextUrl.searchParams.get('username');
    if (!username) {
      return NextResponse.json({ error: 'username is required' }, { status: 400 });
    }

    // Check cache first — return if less than 1 hour old
    try {
      const cached = await db.commitActivityCache.findUnique({ where: { username } });
      if (cached) {
        const ageMs = Date.now() - cached.fetchedAt.getTime();
        if (ageMs < 60 * 60 * 1000) {
          const activity: CommitDay[] = JSON.parse(cached.activityJson);
          return NextResponse.json({
            activity,
            totalCommits: cached.totalCommits,
            activeDays: cached.activeDays,
            cached: true,
          });
        }
      }
    } catch {
      // Cache table might not exist yet — skip caching
    }

    // Get all repos for this user from DB
    const projects = await db.project.findMany({
      where: { ownerLogin: username },
      select: { fullName: true, name: true },
    });

    if (projects.length === 0) {
      return NextResponse.json({ error: 'No projects found for this user' }, { status: 404 });
    }

    // Build a date map for the last 365 days
    const now = new Date();
    const dateMap = new Map<string, { count: number; repos: Set<string> }>();

    for (let i = 0; i < 365; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      dateMap.set(key, { count: 0, repos: new Set() });
    }

    let totalCommits = 0;

    // Fetch commits for each repo (in batches of 5 to respect rate limits)
    const batchSize = 5;
    for (let i = 0; i < projects.length; i += batchSize) {
      const batch = projects.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map(async (project) => {
          try {
            const res = await fetch(
              `https://api.github.com/repos/${project.fullName}/commits?per_page=100`,
              { headers: GITHUB_HEADERS }
            );
            if (!res.ok) return { name: project.name, commits: [] as string[] };

            const data = await res.json();
            const dates = (data || [])
              .map((c: any) => c.commit?.author?.date || c.commit?.committer?.date)
              .filter(Boolean)
              .map((d: string) => new Date(d).toISOString().split('T')[0]);

            return { name: project.name, commits: dates };
          } catch {
            return { name: project.name, commits: [] as string[] };
          }
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { name, commits } = result.value;
          for (const date of commits) {
            const entry = dateMap.get(date);
            if (entry) {
              entry.count++;
              entry.repos.add(name);
              totalCommits++;
            }
          }
        }
      }

      // Small delay between batches
      if (i + batchSize < projects.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Build the activity array, only including days with commits
    const activity: CommitDay[] = [];
    for (const [date, data] of dateMap) {
      activity.push({
        date,
        count: data.count,
        repos: Array.from(data.repos),
      });
    }

    // Sort by date ascending
    activity.sort((a, b) => a.date.localeCompare(b.date));

    const activeDays = activity.filter(d => d.count > 0).length;

    // Upsert cache (ignore errors if table doesn't exist yet)
    try {
      await db.commitActivityCache.upsert({
        where: { username },
        update: {
          activityJson: JSON.stringify(activity),
          totalCommits,
          activeDays,
          fetchedAt: new Date(),
        },
        create: {
          username,
          activityJson: JSON.stringify(activity),
          totalCommits,
          activeDays,
          fetchedAt: new Date(),
        },
      });
    } catch {
      // Cache table might not exist yet — skip caching
    }

    return NextResponse.json({
      activity,
      totalCommits,
      activeDays,
      cached: false,
    });
  } catch (error: any) {
    console.error('Commit activity error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
