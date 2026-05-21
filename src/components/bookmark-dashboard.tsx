'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { Project, CATEGORY_COLORS, LANGUAGE_COLORS } from '@/lib/types';
import { useAtlasStore } from '@/lib/store';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bookmark, ExternalLink, X, Star, GitFork, Clock,
  ShieldCheck, Package, ChevronDown, Download,
  BookOpen, ArrowUpDown,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';

// --- Bookmark persistence helpers (same as project-grid) ---
const BOOKMARK_KEY = 'git-atlas-bookmarks';

function getBookmarks(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(BOOKMARK_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveBookmarks(bookmarks: Set<string>) {
  try {
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify([...bookmarks]));
  } catch { /* ignore */ }
}

// --- Health score computation ---
function computeHealth(p: Project): number {
  if (p.isArchived) return 15;
  if (!p.pushedAt) return 10;
  const daysSincePush = (Date.now() - new Date(p.pushedAt).getTime()) / (1000 * 60 * 60 * 24);
  let score = 50;
  if (daysSincePush < 7) score += 30;
  else if (daysSincePush < 30) score += 20;
  else if (daysSincePush < 90) score += 10;
  else if (daysSincePush > 365) score -= 20;
  if (p.stargazersCount > 5) score += 10;
  if (p.stargazersCount > 20) score += 5;
  if (p.forksCount > 2) score += 5;
  return Math.max(0, Math.min(100, score));
}

function healthColor(score: number): string {
  if (score >= 70) return '#10b981';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

// --- Framework color map ---
const FW_COLORS: Record<string, string> = {
  'Next.js': '#3178c6', 'React': '#61dafb', 'TypeScript': '#3178c6',
  'Tailwind': '#38bdf8', 'Python': '#3572A5', 'FastAPI': '#009688',
  'Flask': '#ffffff', 'Django': '#092e20', 'LangChain': '#1c3c3c',
  'OpenAI': '#10a37f', 'Anthropic': '#d4a574', 'Prisma': '#5a67d8',
  'Rust': '#dea584', 'Actix': '#0a0a0a', 'Tokio': '#ff6600',
  'Click': '#ffcc00', 'Rich': '#9b59b6', 'Pydantic': '#e8553a',
  'SQLAlchemy': '#333333', 'MCP': '#10b981', 'CLI': '#f59e0b',
  'REST API': '#ec4899', 'AI/LLM': '#8b5cf6',
};

function getFwColor(fw: string): string {
  return FW_COLORS[fw] || '#64748b';
}

// --- Health Ring SVG ---
function HealthRing({ score, size = 32 }: { score: number; size?: number }) {
  const color = healthColor(score);
  const r = (size - 4) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - score / 100);

  return (
    <svg width={size} height={size} className="shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={2.5}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size * 0.28}
        fill={color}
        fontWeight={600}
      >
        {score}
      </text>
    </svg>
  );
}

// --- Sort type ---
type SortMode = 'name' | 'health' | 'pushed' | 'stars';

// --- Main Component ---
interface BookmarkDashboardProps {
  projects: Project[];
  onProjectClick?: (project: Project) => void;
}

export function BookmarkDashboard({ projects, onProjectClick }: BookmarkDashboardProps) {
  const { setSelectedProject } = useAtlasStore();
  const [bookmarkIds, setBookmarkIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    return getBookmarks();
  });
  const [sortMode, setSortMode] = useState<SortMode>('name');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const loaded = typeof window !== 'undefined';

  // Filter bookmarked projects
  const bookmarkedProjects = useMemo(() => {
    if (!loaded) return [];
    return projects.filter(p => bookmarkIds.has(p.id));
  }, [projects, bookmarkIds, loaded]);

  // Sort bookmarked projects
  const sortedProjects = useMemo(() => {
    const sorted = [...bookmarkedProjects];
    switch (sortMode) {
      case 'name':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'health':
        return sorted.sort((a, b) => computeHealth(b) - computeHealth(a));
      case 'pushed':
        return sorted.sort((a, b) =>
          new Date(b.pushedAt || 0).getTime() - new Date(a.pushedAt || 0).getTime()
        );
      case 'stars':
        return sorted.sort((a, b) => b.stargazersCount - a.stargazersCount);
      default:
        return sorted;
    }
  }, [bookmarkedProjects, sortMode]);

  // Stats
  const avgHealth = useMemo(() => {
    if (bookmarkedProjects.length === 0) return 0;
    const total = bookmarkedProjects.reduce((s, p) => s + computeHealth(p), 0);
    return Math.round(total / bookmarkedProjects.length);
  }, [bookmarkedProjects]);

  // Remove a bookmark
  const removeBookmark = useCallback((id: string) => {
    const bm = getBookmarks();
    bm.delete(id);
    saveBookmarks(bm);
    setBookmarkIds(new Set(bm));
  }, []);

  // Export bookmarks as list
  const handleExport = useCallback(() => {
    const lines = bookmarkedProjects.map(p =>
      `- ${p.name} (${p.language || 'unknown'}): ${p.htmlUrl}`
    );
    const text = `# Git Atlas - Bookmarked Projects\n\n${lines.join('\n')}`;
    navigator.clipboard.writeText(text).catch(() => {/* ignore */});
  }, [bookmarkedProjects]);

  // Sort labels
  const sortLabels: Record<SortMode, string> = {
    name: 'By Name',
    health: 'By Health',
    pushed: 'By Last Push',
    stars: 'By Stars',
  };

  // Empty state
  if (loaded && bookmarkedProjects.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-card/30 border border-border/15 flex items-center justify-center">
            <Bookmark className="w-8 h-8 text-muted-foreground/20" />
          </div>
          <h3 className="text-lg font-semibold text-foreground/70 mb-2">No Bookmarks Yet</h3>
          <p className="text-sm text-muted-foreground/40 leading-relaxed">
            Click the bookmark icon on any project card or detail panel to save it here.
            Your bookmarked projects will appear in this dashboard for quick access.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground/30">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Look for the bookmark icon in grid view or detail panels</span>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-4">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h2 className="text-lg font-bold text-foreground/90 flex items-center gap-2">
              <Bookmark className="w-5 h-5 text-amber-400" />
              Bookmark Dashboard
            </h2>
            <p className="text-xs text-muted-foreground/50 mt-0.5">
              Your saved projects for quick access
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Export button */}
            {bookmarkedProjects.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                className="h-7 gap-1 text-xs border-border/20 text-muted-foreground/60 hover:text-foreground hover:border-border/40 transition-all"
              >
                <Download className="w-3 h-3" /> Export
              </Button>
            )}

            {/* Sort dropdown */}
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSortMenu(!showSortMenu)}
                className="h-7 gap-1 text-xs border-border/20 text-muted-foreground/60 hover:text-foreground hover:border-border/40 transition-all"
              >
                <ArrowUpDown className="w-3 h-3" />
                {sortLabels[sortMode]}
                <ChevronDown className="w-3 h-3" />
              </Button>
              <AnimatePresence>
                {showSortMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute right-0 top-full mt-1 z-20 bg-card/95 border border-border/30 rounded-lg shadow-xl py-1 min-w-[140px]"
                  >
                    {(Object.keys(sortLabels) as SortMode[]).map(mode => (
                      <button
                        key={mode}
                        onClick={() => { setSortMode(mode); setShowSortMenu(false); }}
                        className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                          sortMode === mode
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : 'text-muted-foreground/60 hover:text-foreground hover:bg-card/40'
                        }`}
                      >
                        {sortLabels[mode]}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* Stats Bar */}
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-4 px-4 py-2.5 rounded-lg bg-card/30 border border-border/15"
        >
          <div className="flex items-center gap-2 text-xs">
            <Bookmark className="w-3.5 h-3.5 text-amber-400/60" />
            <span className="text-foreground/70 font-medium">{bookmarkedProjects.length}</span>
            <span className="text-muted-foreground/40">bookmarked projects</span>
          </div>
          <div className="h-3 w-px bg-border/20" />
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground/40">Average health:</span>
            <HealthRing score={avgHealth} size={22} />
          </div>
        </motion.div>

        {/* Project Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sortedProjects.map((project, i) => (
            <BookmarkCard
              key={project.id}
              project={project}
              index={i}
              onRemove={removeBookmark}
              onProjectClick={onProjectClick || setSelectedProject}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Bookmark Card ---
interface BookmarkCardProps {
  project: Project;
  index: number;
  onRemove: (id: string) => void;
  onProjectClick: (project: Project) => void;
}

function BookmarkCard({ project, index, onRemove, onProjectClick }: BookmarkCardProps) {
  const catColor = project.category ? CATEGORY_COLORS[project.category] : '#64748b';
  const langColor = project.language ? LANGUAGE_COLORS[project.language] : '#8b8b8b';
  const health = computeHealth(project);
  const depCount = project.dependencies
    ? (project.dependencies.runtime?.length || 0) + (project.dependencies.dev?.length || 0)
    : 0;

  // Activity status
  const daysSincePush = project.pushedAt
    ? (Date.now() - new Date(project.pushedAt).getTime()) / (1000 * 60 * 60 * 24)
    : 999;
  const activityLabel = daysSincePush < 7 ? 'hot' : daysSincePush < 30 ? 'warm' : daysSincePush < 180 ? 'cool' : 'cold';
  const activityColor = daysSincePush < 7 ? '#ef4444' : daysSincePush < 30 ? '#f59e0b' : daysSincePush < 180 ? '#10b981' : '#64748b';

  // Top frameworks
  const topFrameworks = (project.codeSignature?.frameworks || []).slice(0, 5);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      whileHover={{ scale: 1.01, y: -2 }}
      className="group relative"
    >
      {/* Gradient border */}
      <div
        className="absolute -inset-px rounded-xl opacity-30 group-hover:opacity-60 transition-opacity duration-300"
        style={{
          background: `linear-gradient(135deg, ${catColor}50, transparent 40%, transparent 60%, ${catColor}30)`,
        }}
      />

      <div
        className="relative rounded-xl overflow-hidden cursor-pointer"
        style={{ background: 'var(--card)' }}
        onClick={() => onProjectClick(project)}
      >
        {/* Hover gradient */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{ background: `radial-gradient(circle at 50% 50%, ${catColor}08, transparent 70%)` }}
        />

        {/* Top accent */}
        <div className="h-1 w-full" style={{ backgroundColor: catColor, opacity: 0.6 }} />

        <div className="p-5">
          {/* Header: Health ring + Name + Remove */}
          <div className="flex items-start gap-3 mb-3">
            <HealthRing score={health} size={36} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-[15px] font-semibold text-foreground truncate group-hover:text-foreground transition-colors">
                  {project.name}
                </h3>
                {project.deepAnalyzedAt && (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400/60 shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground/40">
                {project.language && (
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: langColor }} />
                    {project.language}
                  </span>
                )}
                {project.category && (
                  <span
                    className="px-1.5 py-0 rounded-full text-[9px] font-medium"
                    style={{ backgroundColor: catColor + '15', color: catColor }}
                  >
                    {project.category}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(project.id); }}
              className="p-1.5 rounded-md text-amber-400/60 hover:text-amber-400 hover:bg-amber-400/10 transition-all"
              title="Remove bookmark"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Deep Summary */}
          {project.deepSummary ? (
            <p className="text-xs text-foreground/75 mb-3 line-clamp-3 leading-relaxed bg-emerald-500/5 border border-emerald-500/10 rounded-md px-3 py-2">
              {project.deepSummary.slice(0, 200)}{project.deepSummary.length > 200 ? '...' : ''}
            </p>
          ) : project.summary ? (
            <p className="text-xs text-muted-foreground/70 mb-3 line-clamp-3 leading-relaxed">
              {project.summary}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground/30 mb-3 line-clamp-2 italic">
              {project.description || 'No description'}
            </p>
          )}

          {/* Top Frameworks */}
          {topFrameworks.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {topFrameworks.map(fw => (
                <span
                  key={fw}
                  className="text-[9px] px-2 py-0.5 rounded-full font-medium border"
                  style={{
                    backgroundColor: getFwColor(fw) + '12',
                    color: getFwColor(fw) + 'cc',
                    borderColor: getFwColor(fw) + '25',
                  }}
                >
                  {fw}
                </span>
              ))}
            </div>
          )}

          {/* Metadata Row */}
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground/50 pt-2 border-t border-border/10">
            <span className="flex items-center gap-0.5">
              <Star className="w-3 h-3 text-amber-400/50" /> {project.stargazersCount}
            </span>
            <span className="flex items-center gap-0.5">
              <GitFork className="w-3 h-3" /> {project.forksCount}
            </span>
            {depCount > 0 && (
              <span className="flex items-center gap-0.5 text-blue-400/50">
                <Package className="w-3 h-3" /> {depCount}
              </span>
            )}
            {project.pushedAt && (
              <span
                className="flex items-center gap-0.5 ml-auto"
                style={{ color: activityColor, opacity: 0.6 }}
              >
                <Clock className="w-3 h-3" />
                {formatDistanceToNow(new Date(project.pushedAt), { addSuffix: true })}
              </span>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/5">
            <button
              onClick={(e) => { e.stopPropagation(); onProjectClick(project); }}
              className="flex-1 text-[10px] py-1.5 rounded-md bg-card/40 border border-border/10 text-muted-foreground/50 hover:text-foreground hover:bg-card/60 hover:border-border/25 transition-all text-center"
            >
              View Details
            </button>
            <a
              href={project.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex-1 text-[10px] py-1.5 rounded-md bg-card/40 border border-border/10 text-muted-foreground/50 hover:text-foreground hover:bg-card/60 hover:border-border/25 transition-all text-center flex items-center justify-center gap-1"
            >
              <ExternalLink className="w-3 h-3" /> GitHub
            </a>
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(project.id); }}
              className="text-[10px] py-1.5 px-2 rounded-md bg-card/40 border border-border/10 text-amber-400/40 hover:text-amber-400 hover:bg-amber-400/10 hover:border-amber-500/20 transition-all"
              title="Remove bookmark"
            >
              <Bookmark className="w-3 h-3 fill-current" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
