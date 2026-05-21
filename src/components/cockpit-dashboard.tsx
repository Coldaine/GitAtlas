'use client';

import { useAtlasStore } from '@/lib/store';
import { CATEGORY_COLORS, LANGUAGE_COLORS } from '@/lib/types';
import { ProjectGraph } from '@/components/project-graph';
import { ProjectGrid } from '@/components/project-grid';
import { TimelineView } from '@/components/timeline-view';
import { StatsOverview } from '@/components/stats-overview';
import { DetailPanel } from '@/components/detail-panel';
import { SmartSearchDialog } from '@/components/smart-search-dialog';
import { CompareDialog } from '@/components/compare-dialog';
import { ExportDialog } from '@/components/export-dialog';
import { DependencyNetwork } from '@/components/dependency-network';
import { ActivityHeatmap } from '@/components/activity-heatmap';
import { OnboardingTour } from '@/components/onboarding-tour';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Star, GitFork, Activity, Zap, Search,
  Network, LayoutGrid, Flame, Clock, Loader2,
  FolderOpen, ChevronRight, X,
  Microscope, Calendar, FileText, Keyboard,
  ShieldCheck, AlertTriangle, Archive, GitCompare,
  Building2, BarChart3, RefreshCw, Microscope as DeepAnalyzeIcon,
  Download, Share2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';

// --- AnimatedCounter: counts from 0 to target on mount ---
function AnimatedCounter({ target, duration = 800 }: { target: number; duration?: number }) {
  const [value, setValue] = useState(0);
  const ref = useRef<ReturnType<typeof requestAnimationFrame>>();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) {
        ref.current = requestAnimationFrame(animate);
      }
    };
    ref.current = requestAnimationFrame(animate);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [target, duration]);

  return <>{value}</>;
}

type ActivityFilter = 'all' | 'active' | 'stale' | 'analyzed';

export function CockpitDashboard() {
  const {
    username, projects, isLoading, isAnalyzing, viewMode,
    selectedProject, searchQuery, activeTags, analyzeProgress,
    setViewMode, setSelectedProject, setSearchQuery, toggleTag, setActiveTags,
    setProjects, isDeepAnalyzing, deepAnalyzeProgress,
    setDeepAnalyzing, setDeepAnalyzeProgress, updateProject,
  } = useAtlasStore();

  const [smartSearchOpen, setSmartSearchOpen] = useState(false);
  const [showDetailGrid, setShowDetailGrid] = useState(false);
  const [deepAnalyzeCount, setDeepAnalyzeCount] = useState(0);
  const [isRewritingReadmes, setIsRewritingReadmes] = useState(false);
  const [readmeProgress, setReadmeProgress] = useState('');
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [isLoadingOrgRepos, setIsLoadingOrgRepos] = useState(false);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  // Check if org repos are already loaded
  const hasOrgRepos = useMemo(() => projects.some(p => p.ownerType === 'Organization'), [projects]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setSmartSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setSmartSearchOpen(false);
        setShowKeyboardHelp(false);
      }
      if (e.key === '1' && e.metaKey) {
        e.preventDefault();
        setViewMode('graph');
      }
      if (e.key === '2' && e.metaKey) {
        e.preventDefault();
        setViewMode('grid');
      }
      if (e.key === '3' && e.metaKey) {
        e.preventDefault();
        setViewMode('timeline');
      }
      if (e.key === '4' && e.metaKey) {
        e.preventDefault();
        setViewMode('stats');
      }
      if (e.key === '5' && e.metaKey) {
        e.preventDefault();
        setViewMode('network');
      }
      if (e.key === '?' && e.shiftKey) {
        e.preventDefault();
        setShowKeyboardHelp(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setViewMode]);

  // Computed data
  const totalStars = useMemo(() => projects.reduce((s, p) => s + p.stargazersCount, 0), [projects]);
  const totalForks = useMemo(() => projects.reduce((s, p) => s + p.forksCount, 0), [projects]);
  const recentlyActive = useMemo(() =>
    projects.filter(p => p.pushedAt && (Date.now() - new Date(p.pushedAt).getTime() < 30 * 24 * 60 * 60 * 1000)).length,
    [projects]
  );
  const deepAnalyzedCount = useMemo(() => projects.filter(p => p.deepAnalyzedAt).length, [projects]);
  const hasUnanalyzedRepos = useMemo(() => projects.some(p => !p.deepAnalyzedAt), [projects]);

  // Language chart data
  const langData = useMemo(() => {
    const map = new Map<string, number>();
    projects.forEach(p => { if (p.language) map.set(p.language, (map.get(p.language) || 0) + 1); });
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({
        name,
        value,
        color: LANGUAGE_COLORS[name] || '#8b8b8b',
      }));
  }, [projects]);

  // Category chart data
  const catData = useMemo(() => {
    const map = new Map<string, number>();
    projects.forEach(p => { if (p.category) map.set(p.category, (map.get(p.category) || 0) + 1); });
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({
        name,
        value,
        color: CATEGORY_COLORS[name] || '#64748b',
      }));
  }, [projects]);

  // Tag cloud data
  const tagData = useMemo(() => {
    const map = new Map<string, number>();
    projects.forEach(p => {
      [...p.tags, ...p.topics].forEach(t => { if (t) map.set(t, (map.get(t) || 0) + 1); });
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [projects]);

  // Activity timeline (by month)
  const activityData = useMemo(() => {
    const months = new Map<string, number>();
    projects.forEach(p => {
      if (p.pushedAt) {
        const d = new Date(p.pushedAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        months.set(key, (months.get(key) || 0) + 1);
      }
    });
    return [...months.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([month, count]) => ({ month, count }));
  }, [projects]);

  // Recently pushed projects (for activity feed) — with filter
  const recentProjects = useMemo(() => {
    const sorted = [...projects]
      .filter(p => p.pushedAt)
      .sort((a, b) => new Date(b.pushedAt!).getTime() - new Date(a.pushedAt!).getTime());

    switch (activityFilter) {
      case 'active':
        return sorted.filter(p => (Date.now() - new Date(p.pushedAt!).getTime() < 30 * 24 * 60 * 60 * 1000)).slice(0, 10);
      case 'stale':
        return sorted.filter(p => (Date.now() - new Date(p.pushedAt!).getTime() > 180 * 24 * 60 * 60 * 1000) || p.isArchived).slice(0, 10);
      case 'analyzed':
        return sorted.filter(p => p.deepAnalyzedAt).slice(0, 10);
      default:
        return sorted.slice(0, 8);
    }
  }, [projects, activityFilter]);

  // Filtered projects — include deep analysis data in search
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const searchable = [
          p.name, p.fullName, p.description, p.summary, p.deepSummary, p.language,
          ...p.tags, ...p.topics,
          ...(p.codeSignature?.frameworks || []),
          ...(p.codeSignature?.patterns || []),
          p.codeSignature?.architecture || '',
          ...(p.dependencies?.runtime || []),
        ].filter(Boolean).join(' ').toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      if (activeTags.length > 0) {
        const projectTags = [...p.tags, ...p.topics];
        if (p.category) projectTags.push(p.category);
        if (!activeTags.some(t => projectTags.includes(t))) return false;
      }
      return true;
    });
  }, [projects, searchQuery, activeTags]);

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const projectsRes = await fetch(`/api/github/projects?username=${username}`);
      if (projectsRes.ok) {
        const projectsData = await projectsRes.json();
        setProjects(projectsData.projects || []);
      }
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [username, setProjects]);

  // Batch Rewrite READMEs handler
  const handleBatchRewriteReadmes = useCallback(async () => {
    if (isRewritingReadmes) return;
    const deepAnalyzedProjects = projects.filter(p => p.deepAnalyzedAt && !p.proposedReadme);
    if (deepAnalyzedProjects.length === 0) {
      setReadmeProgress('No eligible projects (need deep analysis first)');
      setTimeout(() => setReadmeProgress(''), 3000);
      return;
    }
    setIsRewritingReadmes(true);
    setReadmeProgress(`Generating READMEs for ${deepAnalyzedProjects.length} repos...`);

    let completed = 0;
    for (const project of deepAnalyzedProjects) {
      try {
        const res = await fetch('/api/github/rewrite-readme', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: project.id }),
        });
        if (res.ok) {
          completed++;
          setReadmeProgress(`Generated ${completed}/${deepAnalyzedProjects.length} READMEs`);
        }
      } catch { /* skip failed */ }
      await new Promise(r => setTimeout(r, 500));
    }

    const projectsRes = await fetch(`/api/github/projects?username=${username}`);
    if (projectsRes.ok) {
      const projectsData = await projectsRes.json();
      setProjects(projectsData.projects || []);
    }

    setIsRewritingReadmes(false);
    setReadmeProgress(`Done! Generated ${completed} READMEs`);
    setTimeout(() => setReadmeProgress(''), 5000);
  }, [isRewritingReadmes, projects, username, setProjects]);

  // Deep Analyze All handler — progressive mode
  const handleDeepAnalyzeAll = useCallback(async () => {
    if (isDeepAnalyzing) return;
    setDeepAnalyzing(true);
    setDeepAnalyzeCount(0);

    const unanalyzed = projects.filter(p => !p.deepAnalyzedAt);
    const total = unanalyzed.length;

    if (total === 0) {
      setDeepAnalyzeProgress('All repos already analyzed!');
      setDeepAnalyzing(false);
      setTimeout(() => setDeepAnalyzeProgress(''), 3000);
      return;
    }

    setDeepAnalyzeProgress(`Starting deep analysis of ${total} repos...`);
    let nextIndex = 0;
    let completed = 0;

    try {
      while (nextIndex !== -1 && nextIndex < total) {
        const res = await fetch('/api/github/deep-analyze?progress=true', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, repoIndex: nextIndex }),
        });

        if (!res.ok) {
          setDeepAnalyzeProgress('Deep analysis failed');
          break;
        }

        const data = await res.json();
        completed = data.completed || completed;
        const repoName = data.result?.name || `repo ${completed}`;
        setDeepAnalyzeProgress(`Analyzing ${repoName}... (${completed}/${total})`);
        setDeepAnalyzeCount(completed);

        const projectsRes = await fetch(`/api/github/projects?username=${username}`);
        if (projectsRes.ok) {
          const projectsData = await projectsRes.json();
          setProjects(projectsData.projects || []);
        }

        nextIndex = data.nextIndex;
        if (nextIndex === -1 || nextIndex >= total) break;
      }

      setDeepAnalyzeProgress(`Done! Deep analyzed ${completed} repos`);
    } catch (err) {
      console.error('Deep analyze all error:', err);
      setDeepAnalyzeProgress('Deep analysis failed');
    } finally {
      setDeepAnalyzing(false);
      setTimeout(() => {
        setDeepAnalyzeProgress('');
        setDeepAnalyzeCount(0);
      }, 5000);
    }
  }, [isDeepAnalyzing, projects, username, setDeepAnalyzing, setDeepAnalyzeProgress, setProjects]);

  // Fetch Org Repos handler
  const handleFetchOrgRepos = useCallback(async () => {
    if (isLoadingOrgRepos || hasOrgRepos) return;
    setIsLoadingOrgRepos(true);
    try {
      const res = await fetch('/api/github/org-repos?org=ProjectBroadside');
      if (res.ok) {
        const projectsRes = await fetch(`/api/github/projects?username=${username}`);
        if (projectsRes.ok) {
          const projectsData = await projectsRes.json();
          setProjects(projectsData.projects || []);
        }
      }
    } catch (err) {
      console.error('Fetch org repos error:', err);
    } finally {
      setIsLoadingOrgRepos(false);
    }
  }, [isLoadingOrgRepos, hasOrgRepos, username, setProjects]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden page-load-animation">
      {/* Onboarding Tour */}
      <OnboardingTour />

      {/* Top bar — glassmorphism with animated gradient */}
      <header
        className="flex items-center gap-3 px-4 py-2 shrink-0 relative backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_1px_3px_rgba(0,0,0,0.2)]"
        style={{
          background: 'linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(20,20,25,0.8) 30%, rgba(20,20,25,0.85) 70%, rgba(245,158,11,0.04) 100%)',
          animation: 'headerGradient 8s ease-in-out infinite alternate',
        }}
      >
        <style>{`
          @keyframes headerGradient {
            0% { background: linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(20,20,25,0.8) 30%, rgba(20,20,25,0.85) 70%, rgba(245,158,11,0.04) 100%); }
            100% { background: linear-gradient(135deg, rgba(245,158,11,0.04) 0%, rgba(20,20,25,0.85) 30%, rgba(20,20,25,0.8) 70%, rgba(16,185,129,0.06) 100%); }
          }
        `}</style>
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-bold tracking-tight">Git Atlas</span>
        </div>

        <div className="h-4 w-px bg-border/20" />

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">{username}</span>
          <span className="text-muted-foreground/30">•</span>
          <span><AnimatedCounter target={projects.length} /> repos</span>
          <span className="text-muted-foreground/30">•</span>
          <Star className="w-3 h-3 text-amber-400" /><AnimatedCounter target={totalStars} />
          <span className="text-muted-foreground/30">•</span>
          <GitFork className="w-3 h-3 text-blue-400" /><AnimatedCounter target={totalForks} />
          <span className="text-muted-foreground/30">•</span>
          <Activity className="w-3 h-3 text-emerald-400" /><AnimatedCounter target={recentlyActive} /> active
          {deepAnalyzedCount > 0 && (
            <>
              <span className="text-muted-foreground/30">•</span>
              <Microscope className="w-3 h-3 text-emerald-400" /><AnimatedCounter target={deepAnalyzedCount} /> deep
            </>
          )}
          {isAnalyzing && (
            <>
              <span className="text-muted-foreground/30">•</span>
              <span className="text-amber-400 animate-pulse flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> {analyzeProgress}
              </span>
            </>
          )}
          {isDeepAnalyzing && (
            <>
              <span className="text-muted-foreground/30">•</span>
              {/* Pulsing emerald ring around progress */}
              <span className="relative flex items-center gap-1">
                <span className="absolute -inset-1 rounded-full border border-emerald-400/30 animate-ping" style={{ animationDuration: '2s' }} />
                <span className="relative text-emerald-400 animate-pulse flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> {deepAnalyzeProgress}
                </span>
              </span>
            </>
          )}
          {isRewritingReadmes && (
            <>
              <span className="text-muted-foreground/30">•</span>
              <span className="text-violet-400 animate-pulse flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> {readmeProgress}
              </span>
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Search with animated width on focus */}
          <div className="relative w-40 focus-within:w-56 transition-all duration-300">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/40" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter..."
              className="h-7 pl-7 text-xs bg-card/30 border-border/20 placeholder:text-muted-foreground/30 focus:border-emerald-500/30 focus:shadow-[0_0_8px_rgba(16,185,129,0.1)] transition-all duration-300"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-1.5 top-1/2 -translate-y-1/2">
                <X className="w-3 h-3 text-muted-foreground/40 hover:text-foreground" />
              </button>
            )}
          </div>

          {/* Smart search — tour target */}
          <div id="tour-smart-search">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSmartSearchOpen(true)}
              className="h-7 gap-1 text-xs border-amber-500/30 text-amber-400 hover:bg-gradient-to-r hover:from-amber-500/10 hover:to-amber-600/5 hover:shadow-[0_0_10px_rgba(245,158,11,0.1)] hover:border-amber-500/50 transition-all px-2"
              title="Smart Search: Ask if you already have a tool for X"
            >
              <Zap className="w-3 h-3" />Do I have...?
            </Button>
          </div>

          {/* Compare */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCompareOpen(true)}
            className="h-7 gap-1 text-xs border-cyan-500/30 text-cyan-400 hover:bg-gradient-to-r hover:from-cyan-500/10 hover:to-cyan-600/5 hover:shadow-[0_0_10px_rgba(6,182,212,0.1)] hover:border-cyan-500/50 transition-all px-2"
            title="Compare two projects side-by-side"
          >
            <GitCompare className="w-3 h-3" />Compare
          </Button>

          {/* Export */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExportOpen(true)}
            className="h-7 gap-1 text-xs border-emerald-500/30 text-emerald-400 hover:bg-gradient-to-r hover:from-emerald-500/10 hover:to-emerald-600/5 hover:shadow-[0_0_10px_rgba(16,185,129,0.1)] hover:border-emerald-500/50 transition-all px-2"
            title="Export portfolio as Markdown or JSON"
          >
            <Download className="w-3 h-3" />Export
          </Button>

          {/* Org Repos */}
          {!hasOrgRepos && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleFetchOrgRepos}
              disabled={isLoadingOrgRepos}
              className="h-7 gap-1 text-xs border-orange-500/30 text-orange-400 hover:bg-gradient-to-r hover:from-orange-500/10 hover:to-orange-600/5 hover:shadow-[0_0_10px_rgba(249,115,22,0.1)] hover:border-orange-500/50 transition-all px-2"
              title="Load ProjectBroadside organization repos"
            >
              {isLoadingOrgRepos ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> Loading...</>
              ) : (
                <><Building2 className="w-3 h-3" /> Org Repos</>
              )}
            </Button>
          )}

          {/* Deep Analyze All — with shimmer when unanalyzed repos exist */}
          <div id="tour-deep-analyze">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeepAnalyzeAll}
              disabled={isDeepAnalyzing}
              className={`h-7 gap-1 text-xs border-emerald-500/30 text-emerald-400 hover:bg-gradient-to-r hover:from-emerald-500/10 hover:to-emerald-600/5 hover:shadow-[0_0_10px_rgba(16,185,129,0.1)] hover:border-emerald-500/50 transition-all px-2 ${hasUnanalyzedRepos && !isDeepAnalyzing ? 'shimmer-button' : ''}`}
              title="Deep analyze all repos with AI"
            >
              {isDeepAnalyzing ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> Analyzing...</>
              ) : (
                <><Microscope className="w-3 h-3" /> Deep Analyze</>
              )}
            </Button>
          </div>

          {/* Rewrite All READMEs */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleBatchRewriteReadmes}
            disabled={isRewritingReadmes || isDeepAnalyzing}
            className="h-7 gap-1 text-xs border-violet-500/30 text-violet-400 hover:bg-gradient-to-r hover:from-violet-500/10 hover:to-violet-600/5 hover:shadow-[0_0_10px_rgba(139,92,246,0.1)] hover:border-violet-500/50 transition-all px-2"
            title="Generate AI READMEs for all deep-analyzed repos"
          >
            {isRewritingReadmes ? (
              <><Loader2 className="w-3 h-3 animate-spin" /> {readmeProgress}</>
            ) : (
              <><FileText className="w-3 h-3" /> Rewrite READMEs</>
            )}
          </Button>

          {/* Keyboard help */}
          <button
            onClick={() => setShowKeyboardHelp(prev => !prev)}
            className="h-7 w-7 flex items-center justify-center text-muted-foreground/40 hover:text-foreground/60 rounded transition-colors"
            title="Keyboard shortcuts (? )"
          >
            <Keyboard className="w-3.5 h-3.5" />
          </button>

          {/* View toggle */}
          <div className="flex bg-card/30 rounded border border-border/20 p-0.5">
            <button
              onClick={() => setViewMode('graph')}
              className={`p-1 rounded text-xs flex items-center gap-1 ${viewMode === 'graph' ? 'bg-emerald-600/20 text-emerald-400' : 'text-muted-foreground hover:text-foreground'}`}
              title="Graph View (⌘1)"
            >
              <Network className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1 rounded text-xs flex items-center gap-1 ${viewMode === 'grid' ? 'bg-emerald-600/20 text-emerald-400' : 'text-muted-foreground hover:text-foreground'}`}
              title="Grid View (⌘2)"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`p-1 rounded text-xs flex items-center gap-1 ${viewMode === 'timeline' ? 'bg-emerald-600/20 text-emerald-400' : 'text-muted-foreground hover:text-foreground'}`}
              title="Timeline View (⌘3)"
            >
              <Calendar className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('stats')}
              className={`p-1 rounded text-xs flex items-center gap-1 ${viewMode === 'stats' ? 'bg-emerald-600/20 text-emerald-400' : 'text-muted-foreground hover:text-foreground'}`}
              title="Stats Overview (⌘4)"
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('network')}
              className={`p-1 rounded text-xs flex items-center gap-1 ${viewMode === 'network' ? 'bg-emerald-600/20 text-emerald-400' : 'text-muted-foreground hover:text-foreground'}`}
              title="Dependency Network (⌘5)"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetailGrid(!showDetailGrid)}
            className={`h-7 gap-1 text-xs ${showDetailGrid ? 'text-emerald-400' : 'text-muted-foreground'}`}
            title="Toggle card strip at bottom"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            {showDetailGrid ? 'Hide' : 'Show'} Cards
          </Button>
        </div>
      </header>
      {/* Subtle emerald glow line below header */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

      {/* Main cockpit: left panels + center graph + right feed */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANEL — Charts & Tags */}
        <div className="w-64 shrink-0 border-r border-border/15 bg-card/10 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-4">

              {/* Language donut */}
              <div>
                <h3 className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider mb-2">Languages</h3>
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={langData}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={55}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {langData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} fillOpacity={0.7} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: 'rgba(20,20,20,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 11 }}
                        itemStyle={{ color: '#e2e8f0' }}
                        formatter={(value: number, name: string) => [`${value} repos`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1 mt-1">
                  {langData.slice(0, 6).map(l => (
                    <div key={l.name} className="flex items-center gap-2 text-[10px] px-1.5 py-0.5 rounded hover:bg-card/40 transition-colors">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                      <span className="text-foreground/70 flex-1">{l.name}</span>
                      <span className="text-muted-foreground/40">{l.value}</span>
                      <div className="w-12 h-1.5 rounded-full bg-card/50 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(l.value / projects.length) * 100}%`, backgroundColor: l.color, opacity: 0.6 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section divider */}
              <div className="h-px bg-gradient-to-r from-transparent via-border/20 to-transparent" />

              {/* Category bar chart */}
              <div>
                <h3 className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider mb-2">Categories</h3>
                <div className="h-28">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={catData} layout="vertical" margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: 'rgba(20,20,20,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 11 }}
                        itemStyle={{ color: '#e2e8f0' }}
                        formatter={(value: number) => [`${value} repos`]}
                      />
                      <Bar dataKey="value" radius={3}>
                        {catData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} fillOpacity={0.6} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Activity timeline */}
              {activityData.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider mb-2">Activity</h3>
                  <div className="h-20">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={activityData} margin={{ left: 0, right: 0, top: 2, bottom: 0 }}>
                        <XAxis dataKey="month" tick={{ fontSize: 7, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ background: 'rgba(20,20,20,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 11 }}
                          itemStyle={{ color: '#e2e8f0' }}
                        />
                        <Bar dataKey="count" fill="#10b981" fillOpacity={0.5} radius={2} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Section divider */}
              <div className="h-px bg-gradient-to-r from-transparent via-border/20 to-transparent" />

              {/* Commit Heatmap */}
              <div>
                <h3 className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider mb-2">Commit Heatmap</h3>
                <ActivityHeatmap username={username} />
              </div>

              {/* Section divider */}
              <div className="h-px bg-gradient-to-r from-transparent via-border/20 to-transparent" />

              {/* Tag cloud */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider">Tags</h3>
                  {activeTags.length > 0 && (
                    <button onClick={() => setActiveTags([])} className="text-[10px] text-muted-foreground/40 hover:text-foreground">
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {tagData.slice(0, 30).map(([tag, count]) => (
                    <motion.button
                      key={tag}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleTag(tag)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-all ${
                        activeTags.includes(tag)
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-card/40 text-muted-foreground/60 border border-border/10 hover:border-border/30 hover:text-foreground/80 hover:bg-card/60'
                      }`}
                    >
                      {tag} <span className="opacity-40">{count}</span>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Section divider */}
              <div className="h-px bg-gradient-to-r from-transparent via-border/20 to-transparent" />

              {/* Category filter */}
              <div>
                <h3 className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider mb-2">Categories</h3>
                <div className="flex flex-wrap gap-1">
                  {catData.map(c => (
                    <motion.button
                      key={c.name}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleTag(c.name)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] transition-all ${
                        activeTags.includes(c.name)
                          ? 'text-white border'
                          : 'bg-card/30 text-muted-foreground/60 border border-border/10 hover:border-border/30 hover:bg-card/50'
                      }`}
                      style={activeTags.includes(c.name) ? { backgroundColor: c.color + '30', borderColor: c.color + '50', color: c.color } : {}}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.color }} />
                      {c.name} <span className="opacity-40">{c.value}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* CENTER — Main visualization */}
        <div className="flex-1 overflow-hidden relative" id="tour-graph-area">
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="flex-1 flex items-center justify-center h-full"
              >
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" style={{ animationDuration: '1.5s' }} />
                  <div className="text-center">
                    <p className="text-sm text-foreground/80 font-medium">Loading your project universe...</p>
                    <p className="text-xs text-muted-foreground/40 mt-1">Fetching repos from GitHub</p>
                  </div>
                </div>
              </motion.div>
            ) : viewMode === 'graph' ? (
              <motion.div
                key="graph"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="h-full"
              >
                <ProjectGraph projects={filteredProjects} />
              </motion.div>
            ) : viewMode === 'timeline' ? (
              <motion.div
                key="timeline"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="h-full"
              >
                <TimelineView projects={filteredProjects} />
              </motion.div>
            ) : viewMode === 'stats' ? (
              <motion.div
                key="stats"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="h-full"
              >
                <StatsOverview projects={filteredProjects} />
              </motion.div>
            ) : viewMode === 'network' ? (
              <motion.div
                key="network"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="h-full"
              >
                <DependencyNetwork projects={filteredProjects} onProjectClick={(p) => setSelectedProject(p)} />
              </motion.div>
            ) : (
              <motion.div
                key="grid"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="h-full"
              >
                <ProjectGrid projects={filteredProjects} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Floating stats pill — glass morphism, more informative */}
          {!isLoading && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-1.5 rounded-full bg-card/60 backdrop-blur-xl border border-border/20 text-[10px] text-muted-foreground/60 shadow-lg shadow-black/10">
              <span>{filteredProjects.length} of {projects.length} projects</span>
              {activeTags.length > 0 && <span>Filtered by {activeTags.length} tags</span>}
              {searchQuery && <span>Matching &quot;{searchQuery}&quot;</span>}
              {deepAnalyzedCount > 0 && (
                <span className="flex items-center gap-1 text-emerald-400/60">
                  <ShieldCheck className="w-3 h-3" /> {deepAnalyzedCount} deep analyzed
                </span>
              )}
            </div>
          )}
        </div>

        {/* RIGHT PANEL — Activity feed + Insights */}
        <div className="w-60 shrink-0 border-l border-border/15 bg-card/10 flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-border/10 flex items-center justify-between">
            <h3 className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider">Recent Activity</h3>
            <button
              onClick={handleRefresh}
              className="text-muted-foreground/30 hover:text-foreground/60 transition-colors"
              title="Refresh project data"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-0.5 px-2 py-1.5 border-b border-border/5">
            {(['all', 'active', 'stale', 'analyzed'] as const).map(f => (
              <button
                key={f}
                onClick={() => setActivityFilter(f)}
                className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${
                  activityFilter === f
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                    : 'text-muted-foreground/30 border border-transparent hover:text-muted-foreground/60'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {recentProjects.map((p, i) => {
                const catColor = p.category ? CATEGORY_COLORS[p.category] : '#64748b';
                const isActive = p.pushedAt && (Date.now() - new Date(p.pushedAt).getTime() < 7 * 24 * 60 * 60 * 1000);
                const isDeepAnalyzed = !!p.deepAnalyzedAt;

                return (
                  <motion.button
                    key={p.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => setSelectedProject(p)}
                    id={i === 0 ? 'tour-detail-panel' : undefined}
                    className="w-full text-left p-2 rounded-md hover:bg-card/40 transition-all group border-l-2 border-transparent hover:border-emerald-500/40"
                  >
                    <div className="flex items-start gap-2">
                      <div className="relative mt-0.5">
                        <span className="w-2 h-2 rounded-full block" style={{ backgroundColor: catColor }} />
                        {isActive && (
                          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        )}
                        {isDeepAnalyzed && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400/60 deep-analyze-pulse" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <p className="text-[11px] font-medium text-foreground/80 truncate group-hover:text-foreground transition-colors">
                            {p.name}
                          </p>
                          {isDeepAnalyzed && (
                            <ShieldCheck className="w-2.5 h-2.5 text-emerald-400/50 shrink-0" />
                          )}
                        </div>
                        {p.summary && (
                          <p className="text-[9px] text-muted-foreground/40 line-clamp-2 leading-tight mt-0.5">
                            {p.summary}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1 text-[9px] text-muted-foreground/30">
                          {p.language && <span>{p.language}</span>}
                          {p.pushedAt && (
                            <span className="flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              {formatRelativeTime(new Date(p.pushedAt))}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-3 h-3 text-muted-foreground/20 group-hover:text-foreground/40 transition-colors mt-1 shrink-0" />
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </ScrollArea>

          {/* Deep Analysis Progress */}
          <div className="border-t border-border/10 px-3 py-2">
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider flex items-center gap-1">
                <Microscope className="w-2.5 h-2.5" /> Deep Analysis
                {isDeepAnalyzing && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </h3>
              <span className="text-[9px] text-emerald-400/50">{deepAnalyzedCount}/{projects.length}</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-card/50 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500/60 transition-all duration-500"
                style={{ width: `${(deepAnalyzedCount / Math.max(projects.length, 1)) * 100}%` }}
              />
            </div>
            {deepAnalyzedCount < projects.length && (
              <p className="text-[9px] text-muted-foreground/30 mt-1">
                {projects.length - deepAnalyzedCount} repos awaiting analysis
              </p>
            )}
          </div>

          {/* Needs Attention */}
          {projects.filter(p => p.isArchived || (p.pushedAt && (Date.now() - new Date(p.pushedAt).getTime() > 180 * 24 * 60 * 60 * 1000))).length > 0 && (
            <div className="border-t border-border/10 px-3 py-2 bg-orange-500/5">
              <h3 className="text-[10px] font-medium text-orange-400/60 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <AlertTriangle className="w-2.5 h-2.5" /> Needs Attention
              </h3>
              {projects
                .filter(p => p.isArchived || (p.pushedAt && (Date.now() - new Date(p.pushedAt).getTime() > 180 * 24 * 60 * 60 * 1000)))
                .slice(0, 4)
                .map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProject(p)}
                    className="w-full flex items-center gap-2 py-1 text-left hover:bg-orange-500/10 rounded px-1 transition-colors"
                  >
                    {p.isArchived ? (
                      <Archive className="w-3 h-3 text-orange-400/60" />
                    ) : (
                      <Clock className="w-3 h-3 text-muted-foreground/30" />
                    )}
                    <span className="text-[10px] text-foreground/50 truncate flex-1">{p.name}</span>
                    <span className="text-[8px] text-orange-400/50 font-medium">
                      {p.isArchived ? 'archived' : '6mo+'}
                    </span>
                  </button>
                ))}
            </div>
          )}

          {/* Top Starred */}
          <div className="border-t border-border/10 px-3 py-2">
            <h3 className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider mb-1.5">Most Starred</h3>
            {[...projects].sort((a, b) => b.stargazersCount - a.stargazersCount).slice(0, 4).map(p => {
              const starTrend = p.stargazersCount > 0 ? Math.min(p.stargazersCount / 5, 20) : 0;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedProject(p)}
                  className="w-full flex items-center gap-2 py-1 text-left hover:bg-card/30 rounded px-1 transition-colors"
                >
                  <Star className="w-3 h-3 text-amber-400/60" />
                  <span className="text-[10px] text-foreground/60 truncate flex-1">{p.name}</span>
                  <svg width="24" height="12" className="shrink-0">
                    <rect x="0" y={8 - starTrend * 0.3} width="3" height={starTrend * 0.3 + 2} rx="1" fill="rgba(245,158,11,0.2)" />
                    <rect x="5" y={6 - starTrend * 0.4} width="3" height={starTrend * 0.4 + 2} rx="1" fill="rgba(245,158,11,0.3)" />
                    <rect x="10" y={4 - starTrend * 0.5} width="3" height={starTrend * 0.5 + 2} rx="1" fill="rgba(245,158,11,0.4)" />
                    <rect x="15" y={2 - starTrend * 0.6} width="3" height={starTrend * 0.6 + 2} rx="1" fill="rgba(245,158,11,0.5)" />
                    <rect x="20" y={0} width="3" height={starTrend * 0.7 + 2} rx="1" fill="rgba(245,158,11,0.6)" />
                  </svg>
                  <span className="text-[10px] text-amber-400/50 font-medium">{p.stargazersCount}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom card strip (togglable) */}
      <AnimatePresence>
        {showDetailGrid && !isLoading && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 180, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="border-t border-border/15 bg-card/10 overflow-hidden shrink-0"
          >
            <ScrollArea className="h-full">
              <div className="flex gap-2 p-3">
                {filteredProjects.map(p => {
                  const catColor = p.category ? CATEGORY_COLORS[p.category] : '#64748b';
                  const langColor = p.language ? LANGUAGE_COLORS[p.language] : '#8b8b8b';
                  return (
                    <motion.button
                      key={p.id}
                      whileHover={{ scale: 1.02, y: -2 }}
                      onClick={() => setSelectedProject(p)}
                      className="shrink-0 w-52 p-3 rounded-lg border border-border/15 bg-card/30 hover:bg-card/50 hover:border-border/30 transition-all text-left"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: catColor }} />
                        <span className="text-xs font-semibold truncate flex-1">{p.name}</span>
                        {p.deepAnalyzedAt && (
                          <Microscope className="w-3 h-3 text-emerald-400/40" />
                        )}
                      </div>
                      {p.summary ? (
                        <p className="text-[10px] text-muted-foreground/60 line-clamp-2 leading-tight mb-1.5">{p.summary}</p>
                      ) : (
                        <p className="text-[10px] text-muted-foreground/30 line-clamp-2 italic mb-1.5">{p.description || 'No description'}</p>
                      )}
                      <div className="flex items-center gap-2 text-[9px] text-muted-foreground/30">
                        {p.language && (
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: langColor }} />
                            {p.language}
                          </span>
                        )}
                        <span className="flex items-center gap-0.5"><Star className="w-2.5 h-2.5" />{p.stargazersCount}</span>
                        {p.category && (
                          <span className="px-1 rounded text-[8px]" style={{ backgroundColor: catColor + '15', color: catColor }}>
                            {p.category}
                          </span>
                        )}
                      </div>
                      {p.tags.length > 0 && (
                        <div className="flex flex-wrap gap-0.5 mt-1.5">
                          {p.tags.slice(0, 3).map(t => (
                            <span key={t} className="text-[8px] px-1 py-0 rounded bg-amber-500/10 text-amber-400/50">{t}</span>
                          ))}
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail panel */}
      <DetailPanel />

      {/* Smart search dialog */}
      <SmartSearchDialog open={smartSearchOpen} onOpenChange={setSmartSearchOpen} username={username} />

      {/* Compare dialog */}
      <CompareDialog open={compareOpen} onOpenChange={setCompareOpen} />

      {/* Export dialog */}
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />

      {/* Keyboard shortcuts overlay */}
      <AnimatePresence>
        {showKeyboardHelp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center"
            onClick={() => setShowKeyboardHelp(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card/95 border border-border/30 rounded-xl p-6 max-w-sm shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-sm font-bold text-foreground/90 mb-4 flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-emerald-400" />
                Keyboard Shortcuts
              </h3>
              <div className="space-y-2.5 text-xs">
                <ShortcutItem keys="/" description="Open &quot;Do I have...?&quot; search" />
                <ShortcutItem keys="⌘1" description="Graph view" />
                <ShortcutItem keys="⌘2" description="Grid view" />
                <ShortcutItem keys="⌘3" description="Timeline view" />
                <ShortcutItem keys="⌘4" description="Stats overview" />
                <ShortcutItem keys="⌘5" description="Dependency network" />
                <ShortcutItem keys="?" description="Show this help" />
                <ShortcutItem keys="Esc" description="Close dialogs" />
              </div>
              <p className="text-[10px] text-muted-foreground/30 mt-4 text-center">Click anywhere to close</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ShortcutItem({ keys, description }: { keys: string; description: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground/60">{description}</span>
      <kbd className="px-2 py-0.5 rounded bg-background/50 border border-border/20 text-foreground/50 font-mono text-[10px]">
        {keys}
      </kbd>
    </div>
  );
}

// More granular relative time formatting
function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
  return `${years} year${years > 1 ? 's' : ''} ago`;
}
