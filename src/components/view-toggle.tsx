'use client';

import { useAtlasStore } from '@/lib/store';
import { ViewMode } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Network, LayoutGrid, Clock } from 'lucide-react';

const views: { mode: ViewMode; icon: typeof Network; label: string }[] = [
  { mode: 'graph', icon: Network, label: 'Graph' },
  { mode: 'grid', icon: LayoutGrid, label: 'Grid' },
];

export function ViewToggle() {
  const { viewMode, setViewMode } = useAtlasStore();

  return (
    <div className="flex items-center bg-card/30 rounded-md border border-border/20 p-0.5">
      {views.map(({ mode, icon: Icon, label }) => (
        <Button
          key={mode}
          variant="ghost"
          size="sm"
          onClick={() => setViewMode(mode)}
          className={`h-7 px-2 text-xs gap-1 ${
            viewMode === mode
              ? 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Icon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{label}</span>
        </Button>
      ))}
    </div>
  );
}
