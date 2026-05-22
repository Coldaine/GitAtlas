import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

export async function POST(request: NextRequest) {
  try {
    const { jobId } = await request.json();
    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const job = await db.analysisJob.findUnique({ where: { id: jobId } });
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Get unanalyzed projects
    const projects = await db.project.findMany({
      where: {
        ownerLogin: job.username,
        summary: null,
      },
    });

    if (projects.length === 0) {
      await db.analysisJob.update({
        where: { id: jobId },
        data: { status: 'completed' },
      });
      return NextResponse.json({ status: 'completed', message: 'All projects already analyzed' });
    }

    // Update job status
    await db.analysisJob.update({
      where: { id: jobId },
      data: { status: 'processing' },
    });

    const zai = await ZAI.create();
    let processed = 0;

    // Process in batches of 5
    const batchSize = 5;
    for (let i = 0; i < projects.length; i += batchSize) {
      const batch = projects.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map(async (project) => {
          try {
            const context = [
              `Repo: ${project.fullName}`,
              `Name: ${project.name}`,
              `Language: ${project.language || 'Unknown'}`,
              `Description: ${project.description || 'No description'}`,
              `Topics: ${project.topics || 'None'}`,
              `Is Fork: ${project.isFork}`,
              `Is Archived: ${project.isArchived}`,
              `Stars: ${project.stargazersCount}`,
              project.readmeContent ? `README excerpt: ${project.readmeContent.slice(0, 2000)}` : 'No README',
            ].join('\n');

            const completion = await zai.chat.completions.create({
              messages: [
                {
                  role: 'system',
                  content: `You are a project analyst. Given GitHub repo metadata, generate:
1. A concise 1-2 sentence SUMMARY describing what the project IS (not aspirational — what it actually does based on the code and description)
2. 3-7 semantic TAGS describing the project's purpose (use tags like: cli-tool, automation, library, api, template, experiment, config, learning, starter, monitoring, agent, ai, visualization, game, mobile, desktop, web-app, mcp, vscode-extension, data-pipeline, knowledge-graph, voice, iot, robotics, finance)
3. One CATEGORY: tool, library, application, template, experiment, config, documentation, learning, or archive

Respond in this exact JSON format:
{"summary": "...", "tags": ["tag1", "tag2", ...], "category": "..."}

Be honest and concrete. If the project seems unfinished or experimental, say so.`
                },
                {
                  role: 'user',
                  content: context,
                },
              ],
              thinking: { type: 'disabled' },
            });

            const content = completion.choices?.[0]?.message?.content || '';
            // Extract JSON from response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              return {
                id: project.id,
                summary: parsed.summary || 'No summary generated',
                tags: Array.isArray(parsed.tags) ? parsed.tags.join(',') : '',
                category: parsed.category || 'experiment',
              };
            }
            return null;
          } catch (err) {
            console.error(`Error analyzing ${project.fullName}:`, err);
            return null;
          }
        })
      );

      // Update projects with results
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          await db.project.update({
            where: { id: result.value.id },
            data: {
              summary: result.value.summary,
              tags: result.value.tags,
              category: result.value.category,
              analyzedAt: new Date(),
            },
          });
          processed++;
        }
      }

      // Update job progress
      await db.analysisJob.update({
        where: { id: jobId },
        data: { processedRepos: processed },
      });
    }

    // Mark job as completed
    await db.analysisJob.update({
      where: { id: jobId },
      data: { status: 'completed', processedRepos: processed },
    });

    return NextResponse.json({
      status: 'completed',
      processed,
      total: projects.length,
    });
  } catch (error: any) {
    console.error('Analyze error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
