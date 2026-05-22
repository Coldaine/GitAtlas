import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface SimilarResult {
  id: string;
  name: string;
  reason: string;
  score: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      );
    }

    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Return cached results if available
    if (project.similarProjects) {
      const cached = JSON.parse(project.similarProjects);
      return NextResponse.json({
        projectId: project.id,
        projectName: project.name,
        similar: cached,
        cached: true,
      });
    }

    // Get all other projects by the same owner
    const allProjects = await db.project.findMany({
      where: {
        ownerLogin: project.ownerLogin,
        id: { not: project.id },
      },
      select: {
        id: true,
        name: true,
        fullName: true,
        language: true,
        tags: true,
        category: true,
        dependencies: true,
        deepSummary: true,
        codeSignature: true,
      },
    });

    // Parse source project data
    const sourceTags = project.tags ? project.tags.split(',').map(t => t.trim().toLowerCase()) : [];
    const sourceDeps: Record<string, string[]> = project.dependencies
      ? JSON.parse(project.dependencies)
      : {};
    const sourceLang = (project.language || '').toLowerCase();

    let sourceCodeSignature: Record<string, string[]> = {};
    if (project.codeSignature) {
      try {
        sourceCodeSignature = JSON.parse(project.codeSignature);
      } catch { /* ignore */ }
    }

    // Flatten all dep names from source
    const sourceAllDeps = new Set<string>();
    for (const names of Object.values(sourceDeps)) {
      for (const n of names) sourceAllDeps.add(n.toLowerCase());
    }

    // Score each project based on similarity heuristics
    const scored: SimilarResult[] = [];

    for (const other of allProjects) {
      let score = 0;
      const reasons: string[] = [];

      // Same language: +3
      if (other.language && other.language.toLowerCase() === sourceLang) {
        score += 3;
        reasons.push(`Same language: ${other.language}`);
      }

      // Shared tags: +2 per shared tag
      const otherTags = other.tags
        ? other.tags.split(',').map(t => t.trim().toLowerCase())
        : [];
      const sharedTags = sourceTags.filter(t => otherTags.includes(t));
      if (sharedTags.length > 0) {
        score += sharedTags.length * 2;
        reasons.push(`Shared tags: ${sharedTags.join(', ')}`);
      }

      // Same category: +2
      if (other.category && other.category === project.category) {
        score += 2;
        reasons.push(`Same category: ${other.category}`);
      }

      // Shared dependencies: +1 per shared dep (max +8)
      let otherDeps: Record<string, string[]> = {};
      if (other.dependencies) {
        try {
          otherDeps = JSON.parse(other.dependencies);
        } catch { /* ignore */ }
      }
      const otherAllDeps = new Set<string>();
      for (const names of Object.values(otherDeps)) {
        for (const n of names) otherAllDeps.add(n.toLowerCase());
      }
      const sharedDeps = [...sourceAllDeps].filter(d => otherAllDeps.has(d));
      if (sharedDeps.length > 0) {
        score += Math.min(sharedDeps.length, 8);
        reasons.push(`Shared deps: ${sharedDeps.slice(0, 5).join(', ')}${sharedDeps.length > 5 ? ` (+${sharedDeps.length - 5} more)` : ''}`);
      }

      // Shared frameworks from codeSignature: +2 per shared
      let otherCodeSignature: Record<string, string[]> = {};
      if (other.codeSignature) {
        try {
          otherCodeSignature = JSON.parse(other.codeSignature);
        } catch { /* ignore */ }
      }
      const sourceFrameworks = new Set(
        (sourceCodeSignature.frameworks || []).map((f: string) => f.toLowerCase())
      );
      const otherFrameworks = (otherCodeSignature.frameworks || []).map((f: string) => f.toLowerCase());
      const sharedFrameworks = otherFrameworks.filter((f: string) => sourceFrameworks.has(f));
      if (sharedFrameworks.length > 0) {
        score += sharedFrameworks.length * 2;
        reasons.push(`Shared frameworks: ${sharedFrameworks.join(', ')}`);
      }

      if (score > 0) {
        scored.push({
          id: other.id,
          name: other.name,
          reason: reasons.join('; '),
          score,
        });
      }
    }

    // Sort by score descending, take top 10
    const similar = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    // Cache results
    await db.project.update({
      where: { id: projectId },
      data: { similarProjects: JSON.stringify(similar) },
    });

    return NextResponse.json({
      projectId: project.id,
      projectName: project.name,
      similar,
      cached: false,
    });
  } catch (error: any) {
    console.error('Similar projects error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
