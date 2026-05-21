import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { GITHUB_HEADERS } from '@/lib/github-token';

const SKIP_DIRS = new Set([
  'node_modules', '.git', '__pycache__', '.next', 'dist', 'build',
  '.cache', 'vendor', 'target', '.venv', 'venv', 'env', '.tox',
  'coverage', '.nyc_output', 'out', '.output', '.nuxt',
]);

function shouldSkipPath(path: string): boolean {
  return path.split('/').some(part => SKIP_DIRS.has(part));
}

interface GitHubTreeEntry {
  path: string;
  type: 'blob' | 'tree';
}

async function fetchTreeFromGitHub(owner: string, repo: string, branch: string) {
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  const res = await fetch(url, { headers: GITHUB_HEADERS });
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status}`);
  }
  const data = await res.json();
  const entries: { path: string; type: string }[] = (data.tree || [])
    .filter((e: GitHubTreeEntry) => !shouldSkipPath(e.path))
    .slice(0, 500);
  return entries.map((e: { path: string; type: string }) => ({ path: e.path, type: e.type }));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const fullName = searchParams.get('fullName');

    if (!projectId && !fullName) {
      return NextResponse.json(
        { error: 'projectId or fullName is required' },
        { status: 400 }
      );
    }

    // Find the project
    const project = projectId
      ? await db.project.findUnique({ where: { id: projectId } })
      : await db.project.findFirst({ where: { fullName: fullName! } });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Return cached tree if available
    if (project.fileTree) {
      const tree = JSON.parse(project.fileTree);
      return NextResponse.json({
        projectId: project.id,
        fullName: project.fullName,
        tree,
        cached: true,
      });
    }

    // Fetch from GitHub if not cached
    const [owner] = project.fullName.split('/');
    const tree = await fetchTreeFromGitHub(owner, project.name, project.defaultBranch);

    // Cache in DB
    await db.project.update({
      where: { id: project.id },
      data: { fileTree: JSON.stringify(tree) },
    });

    return NextResponse.json({
      projectId: project.id,
      fullName: project.fullName,
      tree,
      cached: false,
    });
  } catch (error: any) {
    console.error('File tree error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
