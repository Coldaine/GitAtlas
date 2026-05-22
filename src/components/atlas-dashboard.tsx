'use client';

import { useAtlasStore } from '@/lib/store';
import { StatsBar } from '@/components/stats-bar';
import { TagSidebar } from '@/components/tag-sidebar';
import { SearchBar } from '@/components/search-bar';
import { ViewToggle } from '@/components/view-toggle';
import { ProjectGraph } from '@/components/project-graph';
import { ProjectGrid } from '@/components/project-grid';
import { DetailPanel } from '@/components/detail-panel';
import { LoadingOverlay } from '@/components/loading-overlay';
import { Button } from '@/components/ui/button';
import { Github, PanelLeftClose, PanelLeft, Sparkles } from 'lucide-react';

export function AtlasDashboard() {
  const {
    username,
    projects,
    isLoading,
    isAnalyzing,
    viewMode,
    sidebarOpen,
    fetchProgress,
    analyzeProgress,
    setSidebarOpen,
  } = useAtlasStore();

  const filteredProjects = useFilteredProjects();

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border/30 bg-card/30 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-400" />
          <h1 className="text-lg font-semibold tracking-tight">
            Git Atlas
          </h1>
        </div>

        <div className="flex items-center gap-2 ml-2 text-sm text-muted-foreground">
          <Github className="w-3.5 h-3.5" />
          <span>{username}</span>
          <span className="text-muted-foreground/40">•</span>
          <span>{projects.length} repos</span>
          {isAnalyzing && (
            <>
              <span className="text-muted-foreground/40">•</span>
              <span className="text-amber-400 text-xs animate-pulse">{analyzeProgress}</span>
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <SearchBar />
          <ViewToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
          </Button>
        </div>
      </header>

      {/* Stats */}
      <StatsBar />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        {sidebarOpen && (
          <TagSidebar projects={projects} />
        )}

        {/* View area */}
        <div className="flex-1 overflow-hidden relative">
          {isLoading ? (
            <LoadingOverlay progress={fetchProgress} />
          ) : viewMode === 'graph' ? (
            <ProjectGraph projects={filteredProjects} />
          ) : viewMode === 'grid' ? (
            <ProjectGrid projects={filteredProjects} />
          ) : (
            <ProjectGrid projects={filteredProjects} /> // timeline falls back to grid for now
          )}
        </div>
      </div>

      {/* Detail Panel */}
      <DetailPanel />
    </div>
  );
}

function useFilteredProjects() {
  const { projects, searchQuery, activeTags } = useAtlasStore();

  return projects.filter((p) => {
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const searchable = [
        p.name,
        p.fullName,
        p.description,
        p.summary,
        p.language,
        ...p.tags,
        ...p.topics,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!searchable.includes(q)) return false;
    }

    // Tag filter
    if (activeTags.length > 0) {
      const projectTags = [...p.tags, ...p.topics];
      if (!activeTags.some((t) => projectTags.includes(t))) return false;
    }

    return true;
  });
}
