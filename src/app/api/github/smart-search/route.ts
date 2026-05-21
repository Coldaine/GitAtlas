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

    // Build context for LLM
    const projectList = projects.map((p) => ({
      id: p.id,
      name: p.name,
      fullName: p.fullName,
      description: p.description,
      language: p.language,
      summary: p.summary,
      tags: p.tags,
      category: p.category,
      topics: p.topics,
      stargazersCount: p.stargazersCount,
    }));

    const zai = await ZAI.create();

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a project matching assistant. Given a user's need/description and their list of projects, find which existing projects could fulfill that need or are closely related.

Return a JSON array of matches, each with:
- id: the project id
- name: the project name
- relevanceScore: 0-100 (how well it matches)
- reason: 1 sentence explaining why this project is relevant
- howToUse: 1 sentence suggesting how to use this project for the described need

Sort by relevanceScore descending. Include ALL projects that are even partially relevant (score > 30). Be generous - the user forgets what they have.

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
