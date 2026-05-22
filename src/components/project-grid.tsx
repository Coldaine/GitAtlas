'use client';

import { Project, CATEGORY_COLORS, LANGUAGE_COLORS } from '@/lib/types';
import { useAtlasStore } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Star, GitFork, Clock, Microscope, Package,
  ShieldCheck, Archive, ChevronRight, Bookmark,
  Timer, Flame, GitCommit, AlertCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// --- Bookmark persistence helpers ---
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

// --- Health score computation (matches detail panel) ---
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

// --- Lifespan indicator ---
function formatLifespan(p: Project): string | null {
  if (!p.githubCreatedAt || !p.pushedAt) return null;
  const created = new Date(p.githubCreatedAt);
  const lastPush = new Date(p.pushedAt);
  const diffMs = lastPush.getTime() - created.getTime();
  if (diffMs < 0) return null;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  const years = Math.floor(months / 12);
  const remainMonths = months % 12;
  return remainMonths > 0 ? `${years}y ${remainMonths}mo` : `${years}y`;
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

interface ProjectGridProps {
  projects: Project[];
}

export function ProjectGrid({ projects }: ProjectGridProps) {
  const { setSelectedProject } = useAtlasStore();

  if (projects.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        No projects match your filters
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {projects.map((project, i) => (
          <ProjectCard key={project.id} project={project} index={i} onClick={() => setSelectedProject(project)} />
        ))}
      </div>
    </div>
  );
}

interface ProjectCardProps {
  project: Project;
  index: number;
  onClick: () => void;
}

function ProjectCard({ project, index, onClick }: ProjectCardProps) {
  const catColor = project.category ? CATEGORY_COLORS[project.category] : '#64748b';
  const langColor = project.language ? LANGUAGE_COLORS[project.language] : '#8b8b8b';

  // Activity status
  const daysSincePush = project.pushedAt
    ? (Date.now() - new Date(project.pushedAt).getTime()) / (1000 * 60 * 60 * 24)
    : 999;
  const activityStatus = daysSincePush < 7 ? 'hot' : daysSincePush < 30 ? 'warm' : daysSincePush < 180 ? 'cool' : 'cold';

  // Dependency count
  const depCount = project.dependencies
    ? (project.dependencies.runtime?.length || 0) + (project.dependencies.dev?.length || 0)
    : 0;

  // Framework count
  const fwCount = project.codeSignature?.frameworks?.length || 0;

  // Health score
  const health = computeHealth(project);
  const hColor = healthColor(health);

  // Lifespan
  const lifespan = formatLifespan(project);

  // Bookmark state
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarksLoaded, setBookmarksLoaded] = useState(false);

  useEffect(() => {
    setIsBookmarked(getBookmarks().has(project.id));
    setBookmarksLoaded(true);
  }, [project.id]);

  const toggleBookmark = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const bm = getBookmarks();
    if (bm.has(project.id)) {
      bm.delete(project.id);
    } else {
      bm.add(project.id);
    }
    saveBookmarks(bm);
    setIsBookmarked(bm.has(project.id));
  }, [project.id]);

  // Bookmark pulse animation
  const [bookmarkPulse, setBookmarkPulse] = useState(false);
  const prevBookmarked = useRef(false);
  useEffect(() => {
    if (isBookmarked && !prevBookmarked.current) {
      setBookmarkPulse(true);
      const timer = setTimeout(() => setBookmarkPulse(false), 500);
      return () => clearTimeout(timer);
    }
    prevBookmarked.current = isBookmarked;
  }, [isBookmarked]);

  // Code signature patterns for badges
  const signatureBadges = [
    ...(project.codeSignature?.frameworks || []).slice(0, 4).map(fw => ({ label: fw, color: getFwColor(fw), type: 'fw' as const })),
    ...(project.codeSignature?.patterns || []).slice(0, 2).map(pat => ({ label: pat, color: getFwColor(pat), type: 'pat' as const })),
  ];

  // Activity sparkline data (5-bar mini chart from recent activity)
  const sparklineData = useMemo(() => {
    // Generate pseudo-activity based on project health + recency
    const base = health / 100;
    const bars: number[] = [];
    for (let i = 0; i < 5; i++) {
      const variation = Math.sin(i * 1.2 + project.name.length) * 0.3 + 0.5;
      bars.push(Math.max(0.1, Math.min(1, base * variation + (Math.random() * 0.2 - 0.1))));
    }
    return bars;
  }, [health, project.name]);

  // Tech stack colored dots for mini-bar
  const techStackDots = useMemo(() => {
    const dots: { color: string; label: string }[] = [];
    if (project.language) {
      dots.push({ color: langColor, label: project.language });
    }
    if (project.codeSignature?.frameworks) {
      project.codeSignature.frameworks.slice(0, 4).forEach(fw => {
        dots.push({ color: getFwColor(fw), label: fw });
      });
    }
    return dots.slice(0, 6);
  }, [project.language, project.codeSignature, langColor]);

  // Last commit relative time
  const lastCommitText = useMemo(() => {
    if (!project.pushedAt) return null;
    return formatDistanceToNow(new Date(project.pushedAt), { addSuffix: true });
  }, [project.pushedAt]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3 }}
      whileHover={{ scale: 1.03, y: -1 }}
      whileTap={{ scale: 0.98 }}
      className="group relative"
    >
      {/* Gradient border wrapper — pulses on hover with glow */}
      <div
        className="absolute -inset-px rounded-xl opacity-40 group-hover:opacity-80 transition-opacity duration-300 group-hover:glow-emerald"
        style={{
          background: `linear-gradient(135deg, ${catColor}60, transparent 40%, transparent 60%, ${catColor}40)`,
        }}
      />
      {/* Inner card with bg-card to create border effect — shadow grows on hover */}
      <div
        className="relative rounded-xl overflow-hidden shadow-sm group-hover:shadow-lg group-hover:shadow-black/20 transition-shadow duration-300"
        style={{ background: 'var(--card)' }}
        onClick={onClick}
      >
        {/* Diagonal stripe pattern (carbon fiber) — very subtle */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.015]"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, ${catColor} 0px, ${catColor} 1px, transparent 1px, transparent 6px)`,
          }}
        />
        {/* Radial gradient on hover with category color glow */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{ background: `radial-gradient(circle at 50% 80%, ${catColor}15, transparent 70%)` }}
        />

        {/* Top accent line — colored by category */}
        <div className="h-1 w-full" style={{ backgroundColor: catColor, opacity: 0.7 }} />

        {/* Animated health bar */}
        <div className="h-0.5 w-full bg-border/10">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${health}%` }}
            transition={{ delay: index * 0.03 + 0.2, duration: 0.8, ease: 'easeOut' }}
            className="h-full health-bar-animate"
            style={{ backgroundColor: hColor, opacity: 0.7 }}
          />
        </div>

        {/* Bookmark star — top right — with pulse animation on first bookmark */}
        <div className="absolute top-2 right-2 z-10">
          <button
            onClick={toggleBookmark}
            className={`p-1 rounded-md transition-all duration-200 ${
              isBookmarked
                ? 'text-amber-400 bg-amber-400/10 hover:bg-amber-400/20'
                : 'text-muted-foreground/20 hover:text-amber-400/60 hover:bg-card/60'
            } ${bookmarkPulse ? 'bookmark-pulse' : ''}`}
            title={isBookmarked ? 'Remove bookmark' : 'Bookmark this project'}
          >
            {isBookmarked ? (
              <Bookmark className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Bookmark className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Chevron indicator on hover */}
        <div className="absolute top-2 right-10 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-1 group-hover:translate-x-0">
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/20" />
        </div>

        <div className="p-4">
          {/* Header row */}
          <div className="flex items-start gap-2.5 mb-2.5">
            <div className="relative mt-0.5 shrink-0">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-base font-medium"
                style={{ backgroundColor: catColor + '18', color: catColor }}
              >
                {project.category === 'tool' ? '⚙' :
                 project.category === 'library' ? '📚' :
                 project.category === 'application' ? '🖥' :
                 project.category === 'experiment' ? '🧪' :
                 project.category === 'template' ? '📋' :
                 project.category === 'config' ? '🔧' : '●'}
              </div>
              {/* Deep analysis badge with glow */}
              {project.deepAnalyzedAt && (
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center ring-2 ring-card shadow-[0_0_8px_rgba(16,185,129,0.5)]" style={{ animationDuration: '3s' }}>
                  <ShieldCheck className="w-2.5 h-2.5 text-white" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-[15px] font-semibold text-foreground truncate group-hover:text-foreground transition-colors leading-tight">
                  {project.name}
                </h3>
                {project.isArchived && (
                  <Archive className="w-3 h-3 text-orange-400/60 shrink-0" />
                )}
                {/* "New" badge for projects created within the last 30 days */}
                {project.githubCreatedAt && (Date.now() - new Date(project.githubCreatedAt).getTime() < 30 * 24 * 60 * 60 * 1000) && (
                  <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-medium shrink-0">New</span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground/35 truncate mt-0.5">
                {project.fullName}
              </p>
            </div>
          </div>

          {/* Summary — prefer deep summary if available */}
          {project.deepSummary ? (
            <p className="text-xs text-foreground/75 mb-2.5 line-clamp-2 leading-relaxed bg-emerald-500/5 border border-emerald-500/10 rounded-md px-2.5 py-1.5">
              {project.deepSummary.slice(0, 150)}{project.deepSummary.length > 150 ? '...' : ''}
            </p>
          ) : project.summary ? (
            <p className="text-xs text-muted-foreground/80 mb-2.5 line-clamp-2 leading-relaxed">
              {project.summary}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground/40 mb-2.5 line-clamp-2 italic">
              {project.description || 'No description'}
            </p>
          )}

          {/* Code signature badges — colored pills */}
          {signatureBadges.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2.5">
              {signatureBadges.map((badge) => (
                <span
                  key={badge.label}
                  className="text-[9px] px-2 py-0.5 rounded-full font-medium border"
                  style={{
                    backgroundColor: badge.color + '12',
                    color: badge.color + 'cc',
                    borderColor: badge.color + '25',
                  }}
                >
                  {badge.label}
                </span>
              ))}
              {(project.codeSignature?.frameworks?.length || 0) + (project.codeSignature?.patterns?.length || 0) > 6 && (
                <span className="text-[9px] text-muted-foreground/30 px-1">
                  +{(project.codeSignature!.frameworks.length + project.codeSignature!.patterns.length) - 6}
                </span>
              )}
            </div>
          )}

          {/* Tags row */}
          {project.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {project.tags.slice(0, 4).map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-400/70 border-amber-500/15"
                >
                  {tag}
                </Badge>
              ))}
              {project.tags.length > 4 && (
                <span className="text-[10px] text-muted-foreground/35">+{project.tags.length - 4}</span>
              )}
            </div>
          )}

          {/* Enhanced metadata row */}
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50 pt-2 border-t border-border/10">
            {project.language && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: langColor }} />
                {project.language}
              </span>
            )}
            <span className="flex items-center gap-0.5">
              <Star className="w-3 h-3 text-amber-400/60" /> {project.stargazersCount}
            </span>
            <span className="flex items-center gap-0.5">
              <GitFork className="w-3 h-3" /> {project.forksCount}
            </span>
            {project.pushedAt && (
              <span className={`flex items-center gap-0.5 ml-auto ${
                activityStatus === 'hot' ? 'text-red-400/60' :
                activityStatus === 'warm' ? 'text-amber-400/60' :
                activityStatus === 'cool' ? 'text-emerald-400/40' : 'text-muted-foreground/30'
              }`}>
                <Clock className="w-3 h-3" />
                {formatDistanceToNow(new Date(project.pushedAt), { addSuffix: true })}
              </span>
            )}
          </div>

          {/* Second metadata row: deps, lifespan, health, category */}
          <div className="flex items-center gap-2 mt-1.5 text-[10px]">
            {/* Dependency count with mini bar */}
            {depCount > 0 && (
              <span className="flex items-center gap-1 text-blue-400/50">
                <Package className="w-3 h-3" />
                {depCount}
                <div className="w-8 h-1 rounded-full bg-blue-400/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-400/40"
                    style={{ width: `${Math.min(depCount / 30 * 100, 100)}%` }}
                  />
                </div>
              </span>
            )}

            {/* Lifespan indicator */}
            {lifespan && (
              <span className="flex items-center gap-0.5 text-muted-foreground/40">
                <Timer className="w-3 h-3" />
                {lifespan}
              </span>
            )}

            {/* Health dot indicator */}
            <span className="flex items-center gap-1 ml-auto">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: hColor, opacity: 0.7, boxShadow: `0 0 4px ${hColor}40` }}
              />
              <span className="text-[9px]" style={{ color: hColor, opacity: 0.7 }}>{health}</span>
            </span>

            {/* Category pill */}
            {project.category && (
              <span
                className="inline-block text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: catColor + '15', color: catColor }}
              >
                {project.category}
              </span>
            )}

            {/* Deep analysis verified label */}
            {project.deepAnalyzedAt && (
              <span className="text-[9px] text-emerald-400/50 flex items-center gap-0.5">
                <Microscope className="w-2.5 h-2.5" /> Verified
              </span>
            )}
          </div>

          {/* Open issues badge — if > 0 */}
          {project.openIssuesCount > 0 && (
            <div className="flex items-center gap-1 mt-1.5 text-[10px]">
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400/70 border border-orange-500/15">
                <AlertCircle className="w-2.5 h-2.5" /> {project.openIssuesCount} issue{project.openIssuesCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {/* Last commit indicator with GitCommit icon */}
          {lastCommitText && (
            <div className="flex items-center gap-1.5 mt-1.5 text-[9px]">
              <GitCommit className="w-2.5 h-2.5 text-muted-foreground/30" />
              <span className="text-muted-foreground/40">Last commit {lastCommitText}</span>
            </div>
          )}

          {/* Tech stack mini-bar — colored dots for each framework */}
          {techStackDots.length > 0 && (
            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/8">
              <span className="text-[8px] text-muted-foreground/25 uppercase tracking-wider mr-0.5">Stack</span>
              <div className="flex items-center gap-0.5 flex-wrap">
                {techStackDots.map((dot, i) => (
                  <span
                    key={i}
                    className="w-2 h-2 rounded-full tech-stack-dot cursor-default"
                    style={{ backgroundColor: dot.color, opacity: 0.7, boxShadow: `0 0 3px ${dot.color}30` }}
                    title={dot.label}
                  />
                ))}
              </div>
              <div className="ml-auto flex items-center gap-0.5">
                {/* Activity sparkline (5-bar mini chart) */}
                <div className="flex items-end gap-px h-3">
                  {sparklineData.map((val, i) => (
                    <div
                      key={i}
                      className="w-1 rounded-sm sparkline-bar"
                      style={{
                        height: `${Math.max(2, val * 12)}px`,
                        backgroundColor: catColor,
                        opacity: 0.4 + val * 0.3,
                        animationDelay: `${i * 60}ms`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
