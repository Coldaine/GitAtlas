import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json(
        { error: 'username is required' },
        { status: 400 }
      );
    }

    const projects = await db.project.findMany({
      where: {
        ownerLogin: username,
        NOT: { dependencies: null },
      },
      select: {
        id: true,
        name: true,
        fullName: true,
        language: true,
        dependencies: true,
      },
    });

    // Parse all dependencies
    const projectDeps = projects.map(p => ({
      id: p.id,
      name: p.name,
      fullName: p.fullName,
      language: p.language,
      dependencies: p.dependencies ? JSON.parse(p.dependencies) : {},
    }));

    // Compute shared dependencies across projects
    const depMap = new Map<string, { dep: string; projects: string[] }>();

    for (const p of projectDeps) {
      const allDeps: string[] = [];
      const deps = p.dependencies as Record<string, string[]>;
      for (const [, names] of Object.entries(deps)) {
        allDeps.push(...names);
      }

      for (const dep of allDeps) {
        const key = dep.toLowerCase();
        if (!depMap.has(key)) {
          depMap.set(key, { dep, projects: [] });
        }
        depMap.get(key)!.projects.push(p.id);
      }
    }

    // Only include deps shared by 2+ projects
    const shared = Array.from(depMap.values())
      .filter(entry => entry.projects.length >= 2)
      .sort((a, b) => b.projects.length - a.projects.length);

    return NextResponse.json({
      projects: projectDeps,
      shared,
    });
  } catch (error: any) {
    console.error('Dependencies error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
