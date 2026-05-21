import { NextRequest, NextResponse } from 'next/server';
import { GITHUB_HEADERS } from '@/lib/github-token';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');

  if (!owner || !repo) {
    return NextResponse.json({ error: 'owner and repo are required' }, { status: 400 });
  }

  try {
    // Fetch last 100 commits
    const commitsRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=100`,
      { headers: GITHUB_HEADERS }
    );

    if (!commitsRes.ok) {
      return NextResponse.json(
        { error: `GitHub API error: ${commitsRes.status}` },
        { status: commitsRes.status }
      );
    }

    const commitsData = await commitsRes.json();

    // Group by week for the chart (last 12 weeks)
    const now = Date.now();
    const weekBuckets: Map<string, number> = new Map();

    // Initialize all 12 weeks
    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date(now - i * 7 * 24 * 60 * 60 * 1000);
      const key = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-W${Math.ceil(weekStart.getDate() / 7)}`;
      weekBuckets.set(key, 0);
    }

    // Count commits per week and build recent commits list
    const recentCommits: { sha: string; message: string; date: string; author: string; authorAvatar?: string }[] = [];

    for (const commit of commitsData) {
      const date = commit.commit?.author?.date;
      if (!date) continue;

      const commitTime = new Date(date).getTime();
      const weekStart = new Date(commitTime);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const key = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-W${Math.ceil(weekStart.getDate() / 7)}`;

      if (weekBuckets.has(key)) {
        weekBuckets.set(key, (weekBuckets.get(key) || 0) + 1);
      }

      recentCommits.push({
        sha: commit.sha?.substring(0, 7) || '',
        message: commit.commit?.message?.split('\n')[0] || '',
        date: date,
        author: commit.commit?.author?.name || commit.author?.login || 'Unknown',
        authorAvatar: commit.author?.avatar_url,
      });
    }

    // Format weekly activity
    const weeklyActivity = Array.from(weekBuckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, count]) => ({ week, count }));

    // Build 90-day contribution heatmap data
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;
    const dayBuckets: Map<string, number> = new Map();
    for (const commit of commitsData) {
      const date = commit.commit?.author?.date;
      if (!date) continue;
      const commitTime = new Date(date).getTime();
      if (commitTime < ninetyDaysAgo) continue;

      const dayKey = date.split('T')[0];
      dayBuckets.set(dayKey, (dayBuckets.get(dayKey) || 0) + 1);
    }

    const heatmapData = Array.from(dayBuckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    return NextResponse.json({
      weeklyActivity,
      recentCommits: recentCommits.slice(0, 20),
      heatmapData,
      totalCommits: commitsData.length,
    });
  } catch (error) {
    console.error('Repo commits error:', error);
    return NextResponse.json({ error: 'Failed to fetch repo commits' }, { status: 500 });
  }
}
