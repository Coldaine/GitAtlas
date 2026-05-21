import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

export async function POST(request: NextRequest) {
  try {
    const { projectId } = await request.json();
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Require deep analysis first
    if (!project.deepAnalyzedAt) {
      return NextResponse.json(
        {
          error: 'Deep analysis required first. Run /api/github/deep-analyze before generating a README.',
          projectId: project.id,
        },
        { status: 400 }
      );
    }

    // Gather all deep analysis data
    const fileTree = project.fileTree ? JSON.parse(project.fileTree) : [];
    const keyFiles = project.keyFiles ? JSON.parse(project.keyFiles) : [];
    const dependencies = project.dependencies ? JSON.parse(project.dependencies) : {};
    const codeSignature = project.codeSignature ? JSON.parse(project.codeSignature) : {};

    // Build a tree overview for context
    const treeOverview = Array.isArray(fileTree)
      ? fileTree
          .filter((e: { type: string }) => e.type === 'blob')
          .map((e: { path: string }) => e.path)
          .slice(0, 60)
          .join('\n')
      : 'No file tree available';

    const keyFilesContext = Array.isArray(keyFiles)
      ? keyFiles
          .map((kf: { path: string; content: string; purpose: string }) =>
            `--- ${kf.path} (${kf.purpose}) ---\n${kf.content}`
          )
          .join('\n\n')
      : 'No key files available';

    const zai = await ZAI.create();

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a technical writer who generates accurate, useful README files based on actual source code analysis. Write a README that:

1. Describes what the project ACTUALLY does (based on the code, not aspirations)
2. Lists the technology stack clearly
3. Provides installation instructions based on the actual dependencies and config
4. Describes key features based on the actual code
5. Includes usage examples where the code makes it clear how to use it
6. Mentions any notable patterns or architecture decisions visible in the code

Write in clear, professional Markdown. Do NOT include placeholder sections. Only include sections where you have enough information from the code to write something accurate. If information is missing, skip that section rather than making things up.

The README should be honest — if the project is small or experimental, reflect that.`,
        },
        {
          role: 'user',
          content: [
            `Project: ${project.fullName}`,
            `Description: ${project.description || 'No description'}`,
            `Language: ${project.language || 'Unknown'}`,
            `Deep Summary: ${project.deepSummary || 'N/A'}`,
            `Code Signature: ${JSON.stringify(codeSignature)}`,
            `Dependencies: ${JSON.stringify(dependencies)}`,
            `Existing Tags: ${project.tags || 'None'}`,
            `Category: ${project.category || 'Unknown'}`,
            ``,
            `File Tree:`,
            treeOverview,
            ``,
            `Key Files:`,
            keyFilesContext,
          ].join('\n'),
        },
      ],
      thinking: { type: 'disabled' },
    });

    const proposedReadme = completion.choices?.[0]?.message?.content || '';

    if (!proposedReadme) {
      return NextResponse.json({ error: 'Failed to generate README' }, { status: 500 });
    }

    // Store the proposed README
    await db.project.update({
      where: { id: projectId },
      data: {
        proposedReadme,
        readmeGeneratedAt: new Date(),
      },
    });

    return NextResponse.json({
      projectId,
      proposedReadme,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Rewrite README error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
