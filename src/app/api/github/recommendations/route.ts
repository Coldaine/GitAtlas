import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

// In-memory cache for 1 hour
interface CachedRecommendations {
  recommendations: any[];
  timestamp: number;
}
const cache = new Map<string, CachedRecommendations>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function POST(request: NextRequest) {
  try {
    const { username } = await request.json();
    if (!username) {
      return NextResponse.json({ error: 'username is required' }, { status: 400 });
    }

    // Check cache
    const cached = cache.get(username);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ recommendations: cached.recommendations, cached: true });
    }

    // Fetch all projects for the user
    const projects = await db.project.findMany({
      where: { ownerLogin: username },
      orderBy: { githubUpdatedAt: 'desc' },
    });

    if (projects.length === 0) {
      return NextResponse.json({ recommendations: [], message: 'No projects found for this user' });
    }

    // Analyze portfolio composition
    const categories = new Map<string, number>();
    const languages = new Map<string, number>();
    const frameworks = new Map<string, number>();
    const allTags = new Map<string, number>();
    const allTopics = new Set<string>();

    projects.forEach(p => {
      if (p.category) categories.set(p.category, (categories.get(p.category) || 0) + 1);
      if (p.language) languages.set(p.language, (languages.get(p.language) || 0) + 1);

      // Parse code signature for frameworks
      try {
        const sig = p.codeSignature ? (typeof p.codeSignature === 'string' ? JSON.parse(p.codeSignature) : p.codeSignature) : null;
        if (sig?.frameworks) {
          for (const fw of sig.frameworks as string[]) {
            frameworks.set(fw, (frameworks.get(fw) || 0) + 1);
          }
        }
      } catch { /* ignore */ }

      // Tags
      if (p.tags) {
        const tagList = typeof p.tags === 'string' ? p.tags.split(',').filter(Boolean) : p.tags;
        tagList.forEach((t: string) => allTags.set(t, (allTags.get(t) || 0) + 1));
      }
      if (p.topics) {
        const topicList = typeof p.topics === 'string' ? p.topics.split(',').filter(Boolean) : p.topics;
        topicList.forEach((t: string) => allTopics.add(t));
      }
    });

    // Identify gaps
    const knownCategories = ['tool', 'application', 'library', 'experiment', 'template', 'config', 'documentation', 'learning'];
    const missingCategories = knownCategories.filter(c => !categories.has(c));
    const underrepresentedCategories = [...categories.entries()]
      .filter(([, count]) => count <= 2)
      .map(([cat]) => cat);

    const knownLanguages = ['TypeScript', 'Python', 'Rust', 'Go', 'Java', 'Swift', 'Kotlin', 'C++', 'Ruby', 'Dart'];
    const missingLanguages = knownLanguages.filter(l => !languages.has(l));

    // Build portfolio overview for LLM
    const portfolioOverview = {
      totalProjects: projects.length,
      categories: Object.fromEntries([...categories.entries()].sort((a, b) => b[1] - a[1])),
      languages: Object.fromEntries([...languages.entries()].sort((a, b) => b[1] - a[1])),
      topFrameworks: Object.fromEntries([...frameworks.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)),
      topTags: Object.fromEntries([...allTags.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)),
      topics: [...allTopics].slice(0, 20),
      missingCategories,
      underrepresentedCategories,
      missingLanguages,
      projectNames: projects.map(p => p.name),
    };

    // Build project summaries
    const projectSummaries = projects.map(p => {
      let sig: any = null;
      let deps: any = null;
      try {
        if (p.codeSignature) sig = typeof p.codeSignature === 'string' ? JSON.parse(p.codeSignature) : p.codeSignature;
      } catch { /* ignore */ }
      try {
        if (p.dependencies) deps = typeof p.dependencies === 'string' ? JSON.parse(p.dependencies) : p.dependencies;
      } catch { /* ignore */ }

      return {
        name: p.name,
        description: p.description || '',
        language: p.language,
        category: p.category,
        frameworks: sig?.frameworks || [],
        patterns: sig?.patterns || [],
        runtimeDeps: deps?.runtime?.slice(0, 10) || [],
        tags: p.tags ? (typeof p.tags === 'string' ? p.tags.split(',').filter(Boolean) : p.tags) : [],
        isArchived: p.isArchived,
        stars: p.stargazersCount,
      };
    });

    const zai = await ZAI.create();

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a software portfolio advisor. Given a developer's existing projects, identify gaps in their portfolio and suggest 5 specific, actionable project recommendations that would fill those gaps and strengthen their portfolio.

Each recommendation must be:
1. A concrete, buildable project (not vague)
2. Fills a specific identified gap
3. Leverages their existing skills where possible
4. Different enough from existing projects to add value

Return a JSON array of exactly 5 recommendations, each with:
- name: string (catchy project name)
- description: string (2-3 sentences describing the project)
- rationale: string (why this fills a gap - be specific about what's missing)
- techStack: string[] (3-6 technologies to use, including languages and frameworks they already know)
- relatedProjects: string[] (1-3 existing project names this relates to)
- gapFilled: string (short label like "Missing: DevOps", "Missing: Mobile", "Underrepresented: Library", etc.)

Respond with ONLY the JSON array, no other text.`,
        },
        {
          role: 'user',
          content: `Portfolio Overview:
${JSON.stringify(portfolioOverview, null, 2)}

Project Details:
${JSON.stringify(projectSummaries, null, 2)}`,
        },
      ],
      thinking: { type: 'disabled' },
    });

    const content = completion.choices?.[0]?.message?.content || '[]';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    const recommendations = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    // Cache the result
    cache.set(username, { recommendations, timestamp: Date.now() });

    return NextResponse.json({ recommendations, cached: false });
  } catch (error: any) {
    console.error('Recommendations error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
