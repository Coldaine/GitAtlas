'use client';

import { useAtlasStore } from '@/lib/store';
import { LANGUAGE_COLORS } from '@/lib/types';
import { GitFork, Star, Code2, FolderOpen } from 'lucide-react';

export function StatsBar() {
  const { projects } = useAtlasStore();

  const totalStars = projects.reduce((sum, p) => sum + p.stargazersCount, 0);
  const totalForks = projects.reduce((sum, p) => sum + p.forksCount, 0);
  const languages = new Map<string, number>();
  projects.forEach((p) => {
    if (p.language) {
      languages.set(p.language, (languages.get(p.language) || 0) + 1);
    }
  });
  const topLanguages = [...languages.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const analyzed = projects.filter((p) => p.summary).length;

  return (
    <div className="flex items-center gap-4 px-4 py-2 border-b border-border/20 bg-card/20 text-xs text-muted-foreground overflow-x-auto">
      <div className="flex items-center gap-1.5 shrink-0">
        <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
        <span>{projects.length} repos</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Star className="w-3.5 h-3.5 text-amber-400" />
        <span>{totalStars} stars</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <GitFork className="w-3.5 h-3.5 text-blue-400" />
        <span>{totalForks} forks</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Code2 className="w-3.5 h-3.5 text-violet-400" />
        <span>{analyzed}/{projects.length} analyzed</span>
      </div>

      {/* Language breakdown */}
      <div className="flex items-center gap-1.5 ml-2 shrink-0">
        <span className="text-muted-foreground/50">Languages:</span>
        {topLanguages.map(([lang, count]) => (
          <span
            key={lang}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-card/50"
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: LANGUAGE_COLORS[lang] || '#8b8b8b' }}
            />
            {lang} {count}
          </span>
        ))}
      </div>
    </div>
  );
}
