'use client';

import { useAtlasStore } from '@/lib/store';
import { CATEGORY_COLORS, LANGUAGE_COLORS } from '@/lib/types';
import { ProjectGraph } from '@/components/project-graph';
import { ProjectGrid } from '@/components/project-grid';
import { TimelineView } from '@/components/timeline-view';
import { DetailPanel } from '@/components/detail-panel';
import { SmartSearchDialog } from '@/components/smart-search-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Star, GitFork, Activity, Zap, Search,
  Network, LayoutGrid, Flame, Clock, Loader2,
  FolderOpen, Code2, ChevronRight, X,
  Microscope, Calendar, FileText, Keyboard,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useState, useMemo, useCallback, useEffect } from 'react';

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
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

  // Recently pushed projects (for activity feed)
  const recentProjects = useMemo(() =>
    [...projects]
      .filter(p => p.pushedAt)
      .sort((a, b) => new Date(b.pushedAt!).getTime() - new Date(a.pushedAt!).getTime())
      .slice(0, 8),
    [projects]
  );

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
      // Small delay to avoid overwhelming the API
      await new Promise(r => setTimeout(r, 500));
    }

    // Refresh projects
    const projectsRes = await fetch(`/api/github/projects?username=${username}`);
    if (projectsRes.ok) {
      const projectsData = await projectsRes.json();
      setProjects(projectsData.projects || []);
    }

    setIsRewritingReadmes(false);
    setReadmeProgress(`Done! Generated ${completed} READMEs`);
    setTimeout(() => setReadmeProgress(''), 5000);
  }, [isRewritingReadmes, projects, username, setProjects]);

  // Deep Analyze All handler
  const handleDeepAnalyzeAll = useCallback(async () => {
    if (isDeepAnalyzing) return;
    setDeepAnalyzing(true);
    setDeepAnalyzeCount(0);
    const totalToAnalyze = projects.length;
    setDeepAnalyzeProgress(`Starting deep analysis of ${totalToAnalyze} repos...`);

    try {
      const res = await fetch('/api/github/deep-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      if (res.ok) {
        const data = await res.json();
        setDeepAnalyzeCount(data.results?.length || totalToAnalyze);
        setDeepAnalyzeProgress(`Deep analyzed ${data.results?.length || totalToAnalyze} repos`);

        // Refresh all projects
        const projectsRes = await fetch(`/api/github/projects?username=${username}`);
        if (projectsRes.ok) {
          const projectsData = await projectsRes.json();
          setProjects(projectsData.projects || []);
        }
      } else {
        setDeepAnalyzeProgress('Deep analysis failed');
      }
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
  }, [isDeepAnalyzing, projects.length, username, setDeepAnalyzing, setDeepAnalyzeProgress, setProjects]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Top bar — minimal, dense */}
      <header className="flex items-center gap-3 px-4 py-2 border-b border-border/20 bg-card/30 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-bold tracking-tight">Git Atlas</span>
        </div>

        <div className="h-4 w-px bg-border/20" />

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">{username}</span>
          <span className="text-muted-foreground/30">•</span>
          <span>{projects.length} repos</span>
          <span className="text-muted-foreground/30">•</span>
          <Star className="w-3 h-3 text-amber-400" />{totalStars}
          <span className="text-muted-foreground/30">•</span>
          <GitFork className="w-3 h-3 text-blue-400" />{totalForks}
          <span className="text-muted-foreground/30">•</span>
          <Activity className="w-3 h-3 text-emerald-400" />{recentlyActive} active
          {deepAnalyzedCount > 0 && (
            <>
              <span className="text-muted-foreground/30">•</span>
              <Microscope className="w-3 h-3 text-emerald-400" />{deepAnalyzedCount} deep
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
              <span className="text-emerald-400 animate-pulse flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> {deepAnalyzeProgress}
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
          {/* Search */}
          <div className="relative w-40">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/40" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter..."
              className="h-7 pl-7 text-xs bg-card/30 border-border/20 placeholder:text-muted-foreground/30"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-1.5 top-1/2 -translate-y-1/2">
                <X className="w-3 h-3 text-muted-foreground/40 hover:text-foreground" />
              </button>
            )}
          </div>

          {/* Smart search */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSmartSearchOpen(true)}
            className="h-7 gap-1 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10 px-2"
          >
            <Zap className="w-3 h-3" />Do I have...?
          </Button>

          {/* Deep Analyze All */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDeepAnalyzeAll}
            disabled={isDeepAnalyzing}
            className="h-7 gap-1 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 px-2"
          >
            {isDeepAnalyzing ? (
              <><Loader2 className="w-3 h-3 animate-spin" /> Analyzing...</>
            ) : (
              <><Microscope className="w-3 h-3" /> Deep Analyze</>
            )}
          </Button>

          {/* Rewrite All READMEs */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleBatchRewriteReadmes}
            disabled={isRewritingReadmes || isDeepAnalyzing}
            className="h-7 gap-1 text-xs border-violet-500/30 text-violet-400 hover:bg-violet-500/10 px-2"
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
            title="Keyboard shortcuts"
          >
            <Keyboard className="w-3.5 h-3.5" />
          </button>

          {/* View toggle */}
          <div className="flex bg-card/30 rounded border border-border/20 p-0.5">
            <button
              onClick={() => setViewMode('graph')}
              className={`p-1 rounded text-xs flex items-center gap-1 ${viewMode === 'graph' ? 'bg-emerald-600/20 text-emerald-400' : 'text-muted-foreground hover:text-foreground'}`}
              title="Graph View"
            >
              <Network className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1 rounded text-xs flex items-center gap-1 ${viewMode === 'grid' ? 'bg-emerald-600/20 text-emerald-400' : 'text-muted-foreground hover:text-foreground'}`}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`p-1 rounded text-xs flex items-center gap-1 ${viewMode === 'timeline' ? 'bg-emerald-600/20 text-emerald-400' : 'text-muted-foreground hover:text-foreground'}`}
              title="Timeline View"
            >
              <Calendar className="w-3.5 h-3.5" />
            </button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetailGrid(!showDetailGrid)}
            className={`h-7 gap-1 text-xs ${showDetailGrid ? 'text-emerald-400' : 'text-muted-foreground'}`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            {showDetailGrid ? 'Hide' : 'Show'} Cards
          </Button>
        </div>
      </header>

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
                    <div key={l.name} className="flex items-center gap-2 text-[10px]">
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
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-all ${
                        activeTags.includes(tag)
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-card/40 text-muted-foreground/60 border border-border/10 hover:border-border/30 hover:text-foreground/80'
                      }`}
                    >
                      {tag} <span className="opacity-40">{count}</span>
                    </motion.button>
                  ))}
                </div>
              </div>

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
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] transition-all ${
                        activeTags.includes(c.name)
                          ? 'text-white border'
                          : 'bg-card/30 text-muted-foreground/60 border border-border/10 hover:border-border/30'
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
        <div className="flex-1 overflow-hidden relative">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center h-full">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-3"
              >
                <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
                <div className="text-center">
                  <p className="text-sm text-foreground/80 font-medium">Loading your project universe...</p>
                  <p className="text-xs text-muted-foreground/40 mt-1">Fetching repos from GitHub</p>
                </div>
              </motion.div>
            </div>
          ) : viewMode === 'graph' ? (
            <ProjectGraph projects={filteredProjects} />
          ) : viewMode === 'timeline' ? (
            <TimelineView projects={filteredProjects} />
          ) : (
            <ProjectGrid projects={filteredProjects} />
          )}

          {/* Floating stats pill at bottom of graph */}
          {!isLoading && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-1.5 rounded-full bg-card/80 backdrop-blur-md border border-border/20 text-[10px] text-muted-foreground/60">
              <span>{filteredProjects.length} of {projects.length} projects</span>
              {activeTags.length > 0 && <span>Filtered by {activeTags.length} tags</span>}
              {searchQuery && <span>Matching &quot;{searchQuery}&quot;</span>}
              {deepAnalyzedCount > 0 && <span>{deepAnalyzedCount} deep analyzed</span>}
            </div>
          )}
        </div>

        {/* RIGHT PANEL — Activity feed */}
        <div className="w-56 shrink-0 border-l border-border/15 bg-card/10 flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-border/10">
            <h3 className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider">Recent Activity</h3>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {recentProjects.map((p, i) => {
                const catColor = p.category ? CATEGORY_COLORS[p.category] : '#64748b';
                const isActive = p.pushedAt && (Date.now() - new Date(p.pushedAt).getTime() < 7 * 24 * 60 * 60 * 1000);

                return (
                  <motion.button
                    key={p.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => setSelectedProject(p)}
                    className="w-full text-left p-2 rounded-md hover:bg-card/40 transition-colors group"
                  >
                    <div className="flex items-start gap-2">
                      <div className="relative mt-0.5">
                        <span className="w-2 h-2 rounded-full block" style={{ backgroundColor: catColor }} />
                        {isActive && (
                          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-foreground/80 truncate group-hover:text-foreground transition-colors">
                          {p.name}
                        </p>
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
                              {formatDistanceToNow(new Date(p.pushedAt), { addSuffix: true })}
                            </span>
                          )}
                          {p.deepAnalyzedAt && (
                            <Microscope className="w-2.5 h-2.5 text-emerald-400/50" />
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

          {/* Top starred */}
          <div className="border-t border-border/10 px-3 py-2">
            <h3 className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider mb-1.5">Most Starred</h3>
            {[...projects].sort((a, b) => b.stargazersCount - a.stargazersCount).slice(0, 4).map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedProject(p)}
                className="w-full flex items-center gap-2 py-1 text-left hover:bg-card/30 rounded px-1 transition-colors"
              >
                <Star className="w-3 h-3 text-amber-400/60" />
                <span className="text-[10px] text-foreground/60 truncate flex-1">{p.name}</span>
                <span className="text-[10px] text-amber-400/50 font-medium">{p.stargazersCount}</span>
              </button>
            ))}
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
