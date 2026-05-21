import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

export async function POST(request: NextRequest) {
  try {
    const { username, query } = await request.json();
    if (!username || !query) {
      return NextResponse.json({ error: 'username and query are required' }, { status: 400 });
    }

    const projects = await db.project.findMany({
      where: { ownerLogin: username },
      orderBy: { githubUpdatedAt: 'desc' },
    });

    if (projects.length === 0) {
      return NextResponse.json({ results: [], message: 'No projects found for this user' });
    }

    // Build context for LLM — include deep analysis data for better matching
    const projectList = projects.map((p) => {
      let codeSignature: any = null;
      let dependencies: any = null;
      try {
        if (p.codeSignature) codeSignature = JSON.parse(p.codeSignature);
      } catch { /* ignore */ }
      try {
        if (p.dependencies) dependencies = JSON.parse(p.dependencies);
      } catch { /* ignore */ }

      return {
        id: p.id,
        name: p.name,
        fullName: p.fullName,
        description: p.description,
        language: p.language,
        summary: p.summary,
        deepSummary: p.deepSummary,  // Much richer — based on actual code reading
        tags: p.tags,
        category: p.category,
        topics: p.topics,
        stargazersCount: p.stargazersCount,
        codeSignature,  // Frameworks, patterns, architecture
        dependencies,   // Actual runtime/dev deps
        isFork: p.isFork,
        isArchived: p.isArchived,
      };
    });

    const zai = await ZAI.create();

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a project matching assistant. Given a user's need/description and their list of projects, find which existing projects could fulfill that need or are closely related.

Use ALL available data: descriptions, summaries, deep summaries (which are based on actual code reading), code signatures (detected frameworks and patterns), and dependencies. This gives you a much richer understanding of what each project ACTUALLY does.

Return a JSON array of matches, each with:
- id: the project id
- name: the project name
- relevanceScore: 0-100 (how well it matches)
- reason: 1-2 sentences explaining why this project is relevant, referencing specific features if the deep summary reveals them
- howToUse: 1 sentence suggesting how to use this project for the described need

Sort by relevanceScore descending. Include ALL projects that are even partially relevant (score > 25). Be generous - the user forgets what they have. If a project seems unfinished but still relevant, mention that.

Respond with ONLY the JSON array, no other text.`,
        },
        {
          role: 'user',
          content: `Need: "${query}"\n\nMy projects:\n${JSON.stringify(projectList, null, 2)}`,
        },
      ],
      thinking: { type: 'disabled' },
    });

    const content = completion.choices?.[0]?.message?.content || '[]';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    const matches = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    // Enrich results with full project data
    const results = matches.map((match: any) => {
      const project = projects.find((p) => p.id === match.id);
      if (!project) return null;
      return {
        ...project,
        topics: project.topics ? project.topics.split(',').filter(Boolean) : [],
        tags: project.tags ? project.tags.split(',').filter(Boolean) : [],
        fileTree: project.fileTree ? JSON.parse(project.fileTree) : null,
        dependencies: project.dependencies ? JSON.parse(project.dependencies) : null,
        codeSignature: project.codeSignature ? JSON.parse(project.codeSignature) : null,
        similarProjects: project.similarProjects ? JSON.parse(project.similarProjects) : null,
        keyFiles: project.keyFiles ? JSON.parse(project.keyFiles) : null,
        relevanceScore: match.relevanceScore || 50,
        reason: match.reason || '',
        howToUse: match.howToUse || '',
      };
    }).filter(Boolean);

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error('Smart search error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
