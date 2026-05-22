'use client';

import { useAtlasStore } from '@/lib/store';
import { LANGUAGE_COLORS, CATEGORY_COLORS } from '@/lib/types';
import { GitFork, Star, Code2, FolderOpen, Activity, Zap } from 'lucide-react';
import { useState } from 'react';
import { SmartSearchDialog } from '@/components/smart-search-dialog';
import { Button } from '@/components/ui/button';

export function StatsBar() {
  const { projects, username } = useAtlasStore();
  const [smartSearchOpen, setSmartSearchOpen] = useState(false);

  const totalStars = projects.reduce((sum, p) => sum + p.stargazersCount, 0);
  const totalForks = projects.reduce((sum, p) => sum + p.forksCount, 0);
  const languages = new Map<string, number>();
  const categories = new Map<string, number>();

  projects.forEach((p) => {
    if (p.language) languages.set(p.language, (languages.get(p.language) || 0) + 1);
    if (p.category) categories.set(p.category, (categories.get(p.category) || 0) + 1);
  });

  const topLanguages = [...languages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const analyzed = projects.filter((p) => p.summary).length;

  // Recently active (pushed in last 30 days)
  const recentlyActive = projects.filter((p) =>
    p.pushedAt && (Date.now() - new Date(p.pushedAt).getTime() < 30 * 24 * 60 * 60 * 1000)
  ).length;

  // Language distribution for mini bar
  const langTotal = [...languages.values()].reduce((a, b) => a + b, 0);

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border/20 bg-card/20 text-xs text-muted-foreground overflow-x-auto">
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
          <Activity className="w-3.5 h-3.5 text-rose-400" />
          <span>{recentlyActive} active</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Code2 className="w-3.5 h-3.5 text-violet-400" />
          <span>{analyzed}/{projects.length} analyzed</span>
        </div>

        {/* Language distribution mini-bar */}
        <div className="flex items-center gap-1.5 ml-1 shrink-0">
          <span className="text-muted-foreground/40">Lang:</span>
          <div className="flex h-3 w-32 rounded-full overflow-hidden bg-card/50">
            {topLanguages.map(([lang, count]) => (
              <div
                key={lang}
                className="h-full"
                style={{
                  width: `${(count / langTotal) * 100}%`,
                  backgroundColor: LANGUAGE_COLORS[lang] || '#8b8b8b',
                  opacity: 0.7,
                }}
                title={`${lang}: ${count}`}
              />
            ))}
          </div>
        </div>

        {/* Language labels */}
        <div className="flex items-center gap-1 shrink-0">
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

        {/* Smart search button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSmartSearchOpen(true)}
          className="ml-auto shrink-0 h-6 gap-1.5 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
        >
          <Zap className="w-3 h-3" />
          Do I have...?
        </Button>
      </div>

      <SmartSearchDialog
        open={smartSearchOpen}
        onOpenChange={setSmartSearchOpen}
        username={username}
      />
    </>
  );
}
