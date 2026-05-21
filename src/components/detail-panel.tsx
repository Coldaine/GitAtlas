'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useAtlasStore } from '@/lib/store';
import { CATEGORY_COLORS, LANGUAGE_COLORS, FileTreeNode } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Star,
  GitFork,
  ExternalLink,
  Globe,
  GitBranch,
  AlertCircle,
  Clock,
  Archive,
  Tag,
  Layers,
  Activity,
  Flame,
  Folder,
  File,
  ChevronRight,
  ChevronDown,
  Package,
  Box,
  Cpu,
  Microscope,
  FileText,
  Sparkles,
  Loader2,
  ShieldCheck,
  Network,
  FolderTree,
  Copy,
  Check,
  GitCommit,
  Heart,
  Bookmark,
  Share2,
  Search,
  FileCode,
  FileJson,
  FileType,
  Terminal,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { formatDistanceToNow, format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';

// Framework color mapping for tech stack boxes
const FRAMEWORK_COLORS: Record<string, string> = {
  'React': '#61dafb',
  'Next.js': '#ffffff',
  'Vue': '#42b883',
  'Svelte': '#ff3e00',
  'Angular': '#dd0031',
  'Express': '#ffffff',
  'FastAPI': '#009688',
  'Flask': '#ffffff',
  'Django': '#092e20',
  'Tauri': '#ffc131',
  'Electron': '#47848f',
  'Click': '#ffffff',
  'Typer': '#ffffff',
  'Rich': '#ffffff',
  'Pydantic': '#e92063',
  'SQLAlchemy': '#d54634',
  'LangChain': '#1c3c3c',
  'OpenAI': '#412991',
  'Anthropic': '#d4a574',
  'Tokio': '#ffffff',
  'Actix': '#ffffff',
  'Axum': '#ffffff',
  'MCP': '#10b981',
  'TypeScript': '#3178c6',
  'JavaScript': '#f1e05a',
  'Python': '#3572A5',
  'Rust': '#dea584',
  'Tailwind': '#38bdf8',
  'Prisma': '#5a67d8',
};

// File extension icon mapping
const FILE_TYPE_ICONS: Record<string, { color: string; icon: typeof File }> = {
  '.ts': { color: '#3178c6', icon: FileCode },
  '.tsx': { color: '#3178c6', icon: FileCode },
  '.js': { color: '#f1e05a', icon: FileCode },
  '.jsx': { color: '#f1e05a', icon: FileCode },
  '.py': { color: '#3572A5', icon: Terminal },
  '.rs': { color: '#dea584', icon: FileCode },
  '.json': { color: '#f59e0b', icon: FileJson },
  '.md': { color: '#64748b', icon: FileType },
  '.yml': { color: '#ec4899', icon: FileJson },
  '.yaml': { color: '#ec4899', icon: FileJson },
  '.toml': { color: '#9333ea', icon: FileJson },
  '.css': { color: '#563d7c', icon: FileCode },
  '.html': { color: '#e34c26', icon: FileCode },
};

// Skill dot categories based on code signature patterns
interface SkillProfile {
  label: string;
  score: number; // 0-5
  color: string;
}

function computeSkillProfile(project: {
  codeSignature?: { frameworks: string[]; patterns: string[]; architecture: string } | null;
  language?: string | null;
  category?: string | null;
}): SkillProfile[] {
  const frameworks = project.codeSignature?.frameworks || [];
  const patterns = project.codeSignature?.patterns || [];
  const lang = project.language || '';
  const cat = project.category || '';

  const isFrontend = frameworks.some(f => ['React', 'Next.js', 'Vue', 'Svelte', 'Angular', 'Tailwind'].includes(f)) || ['JavaScript', 'TypeScript'].includes(lang);
  const isBackend = frameworks.some(f => ['Express', 'FastAPI', 'Flask', 'Django', 'Actix', 'Axum'].includes(f)) || ['Python', 'Go', 'Rust'].includes(lang);
  const isCLI = patterns.includes('CLI') || frameworks.some(f => ['Click', 'Typer', 'Rich'].includes(f)) || cat === 'tool';
  const isAI = patterns.includes('AI/LLM') || frameworks.some(f => ['LangChain', 'OpenAI', 'Anthropic', 'MCP'].includes(f));
  const isDesktop = frameworks.some(f => ['Tauri', 'Electron'].includes(f)) || cat === 'application';
  const isAPI = frameworks.some(f => ['FastAPI', 'Express', 'Actix', 'Axum', 'Django'].includes(f)) || patterns.includes('REST API');

  return [
    { label: 'Frontend', score: isFrontend ? (frameworks.filter(f => ['React', 'Next.js', 'Vue', 'Svelte', 'Angular'].includes(f)).length + 2) : 1, color: '#61dafb' },
    { label: 'Backend', score: isBackend ? (frameworks.filter(f => ['Express', 'FastAPI', 'Flask', 'Django'].includes(f)).length + 2) : 0, color: '#3572A5' },
    { label: 'CLI', score: isCLI ? 4 : 0, color: '#10b981' },
    { label: 'AI/ML', score: isAI ? 4 : 0, color: '#8b5cf6' },
    { label: 'Desktop', score: isDesktop ? 3 : 0, color: '#f59e0b' },
    { label: 'API', score: isAPI ? 3 : 0, color: '#ec4899' },
  ].map(s => ({ ...s, score: Math.min(5, s.score) }));
}

function computeHealthScore(project: {
  pushedAt?: string | null;
  openIssuesCount: number;
  isArchived: boolean;
  stargazersCount: number;
}): { score: number; label: string; color: string } {
  if (project.isArchived) return { score: 0, label: 'Archived', color: '#64748b' };

  let score = 50;

  if (project.pushedAt) {
    const daysSince = (Date.now() - new Date(project.pushedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 7) score += 30;
    else if (daysSince < 30) score += 20;
    else if (daysSince < 90) score += 10;
    else if (daysSince > 365) score -= 20;
  }

  if (project.stargazersCount > 10) score += 15;
  else if (project.stargazersCount > 3) score += 10;
  else if (project.stargazersCount > 0) score += 5;

  if (project.openIssuesCount > 20) score -= 5;
  else if (project.openIssuesCount > 5) score -= 2;

  score = Math.max(0, Math.min(100, score));

  if (score >= 70) return { score, label: 'Healthy', color: '#10b981' };
  if (score >= 40) return { score, label: 'Moderate', color: '#f59e0b' };
  return { score, label: 'Stale', color: '#ef4444' };
}

// Compute how many projects use each framework across all projects
function computeFrameworkUsage(projects: { codeSignature?: { frameworks: string[]; patterns: string[]; architecture: string } | null }[]) {
  const usageMap = new Map<string, number>();
  for (const p of projects) {
    if (p.codeSignature?.frameworks) {
      for (const fw of p.codeSignature.frameworks) {
        usageMap.set(fw, (usageMap.get(fw) || 0) + 1);
      }
    }
  }
  return usageMap;
}

// Bookmark helpers
const BOOKMARK_KEY = 'git-atlas-bookmarks';
function getBookmarks(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(BOOKMARK_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}
function setBookmarks(ids: string[]) {
  try {
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify(ids));
  } catch { /* ignore */ }
}

// Diff computation for README comparison
function computeDiff(original: string, proposed: string): { type: 'same' | 'added' | 'removed'; text: string }[] {
  const origLines = original.split('\n');
  const propLines = proposed.split('\n');
  const result: { type: 'same' | 'added' | 'removed'; text: string }[] = [];

  const origSet = new Set(origLines);
  const propSet = new Set(propLines);

  // Simple line-by-line diff
  const maxLen = Math.max(origLines.length, propLines.length);
  for (let i = 0; i < maxLen; i++) {
    const oLine = origLines[i];
    const pLine = propLines[i];

    if (oLine === pLine) {
      if (oLine !== undefined) result.push({ type: 'same', text: oLine });
    } else {
      if (oLine !== undefined && !propSet.has(oLine)) {
        result.push({ type: 'removed', text: oLine });
      } else if (oLine !== undefined) {
        result.push({ type: 'same', text: oLine });
      }
      if (pLine !== undefined && !origSet.has(pLine)) {
        result.push({ type: 'added', text: pLine });
      } else if (pLine !== undefined && oLine === undefined) {
        result.push({ type: 'added', text: pLine });
      }
    }
  }

  return result;
}

// Section animation variants for staggered reveal
const sectionVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.35, ease: 'easeOut' },
  }),
};

export function DetailPanel() {
  const { selectedProject, setSelectedProject, detailOpen, setDetailOpen, projects, updateProject, isDeepAnalyzing, deepAnalyzeProgress, setDeepAnalyzing, setDeepAnalyzeProgress } = useAtlasStore();

  // Local state
  const [isLocalAnalyzing, setIsLocalAnalyzing] = useState(false);
  const [isGeneratingReadme, setIsGeneratingReadme] = useState(false);
  const [isLoadingFileTree, setIsLoadingFileTree] = useState(false);
  const [isLoadingSimilar, setIsLoadingSimilar] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(['']));
  const [depFilter, setDepFilter] = useState<'all' | 'runtime' | 'dev'>('all');
  const [copied, setCopied] = useState(false);
  const [copiedReadme, setCopiedReadme] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [depSearch, setDepSearch] = useState('');
  const [readmeView, setReadmeView] = useState<'proposed' | 'original' | 'diff'>('proposed');
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [panelKey, setPanelKey] = useState(0);

  const { toast } = useToast();

  const project = selectedProject;
  const catColor = project?.category ? CATEGORY_COLORS[project.category] : '#64748b';
  const langColor = project?.language ? LANGUAGE_COLORS[project.language] : '#8b8b8b';

  // Track bookmark state
  useEffect(() => {
    if (project) {
      setIsBookmarked(getBookmarks().includes(project.id));
    }
  }, [project]);

  // Increment panel key for animation reset when project changes
  useEffect(() => {
    if (project) {
      setPanelKey(k => k + 1);
      setExpandedDirs(new Set(['']));
      setDepSearch('');
    }
  }, [project?.id]);

  // Health score
  const health = useMemo(() => {
    if (!project) return { score: 0, label: '', color: '#64748b' };
    return computeHealthScore(project);
  }, [project]);

  // Skill profile
  const skillProfile = useMemo(() => {
    if (!project) return [];
    return computeSkillProfile(project);
  }, [project]);

  // Build file tree structure from flat list
  const fileTreeStructure = useMemo(() => {
    if (!project?.fileTree || project.fileTree.length === 0) return [];
    return buildTree(project.fileTree);
  }, [project?.fileTree]);

  // File tree statistics
  const fileTreeStats = useMemo(() => {
    if (!project?.fileTree) return { files: 0, dirs: 0 };
    const files = project.fileTree.filter(f => f.type === 'file').length;
    const dirs = project.fileTree.filter(f => f.type === 'dir').length;
    return { files, dirs };
  }, [project?.fileTree]);

  // Compute dependency sharing counts and project names
  const depShareMap = useMemo(() => {
    if (!project?.dependencies) return new Map<string, number>();
    const allDeps = [...(project.dependencies.runtime || []), ...(project.dependencies.dev || [])];
    const shareMap = new Map<string, number>();
    for (const dep of allDeps) {
      let count = 0;
      for (const otherP of projects) {
        if (otherP.id === project.id) continue;
        if (otherP.dependencies) {
          const otherAll = [...(otherP.dependencies.runtime || []), ...(otherP.dependencies.dev || [])];
          if (otherAll.includes(dep)) count++;
        }
      }
      if (count > 0) shareMap.set(dep, count);
    }
    return shareMap;
  }, [project?.dependencies, project?.id, projects]);

  // Compute which projects share each dependency
  const depSharedProjects = useMemo(() => {
    if (!project?.dependencies) return new Map<string, string[]>();
    const allDeps = [...(project.dependencies.runtime || []), ...(project.dependencies.dev || [])];
    const shareMap = new Map<string, string[]>();
    for (const dep of allDeps) {
      const shared: string[] = [];
      for (const otherP of projects) {
        if (otherP.id === project.id) continue;
        if (otherP.dependencies) {
          const otherAll = [...(otherP.dependencies.runtime || []), ...(otherP.dependencies.dev || [])];
          if (otherAll.includes(dep)) shared.push(otherP.name);
        }
      }
      if (shared.length > 0) shareMap.set(dep, shared.slice(0, 5));
    }
    return shareMap;
  }, [project?.dependencies, project?.id, projects]);

  // Framework usage across projects
  const frameworkUsage = useMemo(() => computeFrameworkUsage(projects), [projects]);

  // Filtered dependencies based on search
  const filteredDeps = useMemo(() => {
    if (!project?.dependencies) return { runtime: [] as string[], dev: [] as string[] };
    const q = depSearch.toLowerCase();
    const filterFn = (d: string) => !q || d.toLowerCase().includes(q);
    return {
      runtime: (project.dependencies.runtime || []).filter(filterFn),
      dev: (project.dependencies.dev || []).filter(filterFn),
    };
  }, [project?.dependencies, depSearch]);

  // Diff between original and proposed README
  const readmeDiff = useMemo(() => {
    if (!project?.proposedReadme || !project?.readmeContent) return [];
    return computeDiff(project.readmeContent.slice(0, 5000), project.proposedReadme);
  }, [project?.proposedReadme, project?.readmeContent]);

  // Copy summary handler
  const handleCopySummary = useCallback(async () => {
    if (!project?.deepSummary) return;
    try {
      await navigator.clipboard.writeText(project.deepSummary);
      setCopied(true);
      toast({ title: 'Summary copied!', description: 'Deep analysis summary copied to clipboard.', duration: 2000 });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Copy failed', description: 'Could not copy to clipboard.', duration: 2000 });
    }
  }, [project?.deepSummary, toast]);

  // Copy README handler
  const handleCopyReadme = useCallback(async () => {
    if (!project?.proposedReadme) return;
    try {
      await navigator.clipboard.writeText(project.proposedReadme);
      setCopiedReadme(true);
      toast({ title: 'README copied!', description: 'Proposed README copied to clipboard.', duration: 2000 });
      setTimeout(() => setCopiedReadme(false), 2000);
    } catch {
      toast({ title: 'Copy failed', description: 'Could not copy to clipboard.', duration: 2000 });
    }
  }, [project?.proposedReadme, toast]);

  // Share handler
  const handleShare = useCallback(async () => {
    if (!project) return;
    const stack = project.codeSignature?.frameworks.join(', ') || project.language || 'N/A';
    const summary = project.deepSummary || project.summary || project.description || '';
    const md = `# ${project.name}\n\n**${project.fullName}**\n\n${summary ? summary + '\n\n' : ''}**Tech Stack:** ${stack}\n**Category:** ${project.category || 'N/A'}\n**Stars:** ${project.stargazersCount}\n**URL:** ${project.htmlUrl}`;
    try {
      await navigator.clipboard.writeText(md);
      setCopiedShare(true);
      toast({ title: 'Share summary copied!', description: 'Markdown summary copied to clipboard.', duration: 2000 });
      setTimeout(() => setCopiedShare(false), 2000);
    } catch {
      toast({ title: 'Copy failed', description: 'Could not copy to clipboard.', duration: 2000 });
    }
  }, [project, toast]);

  // Bookmark handler
  const handleBookmark = useCallback(() => {
    if (!project) return;
    const bookmarks = getBookmarks();
    const isCurrentlyBookmarked = bookmarks.includes(project.id);
    if (isCurrentlyBookmarked) {
      setBookmarks(bookmarks.filter(id => id !== project.id));
      setIsBookmarked(false);
      toast({ title: 'Bookmark removed', description: `${project.name} removed from bookmarks.`, duration: 1500 });
    } else {
      setBookmarks([...bookmarks, project.id]);
      setIsBookmarked(true);
      toast({ title: 'Bookmarked!', description: `${project.name} added to bookmarks.`, duration: 1500 });
    }
  }, [project, toast]);

  // Deep analyze handler
  const handleDeepAnalyze = useCallback(async () => {
    if (!project || isLocalAnalyzing || isDeepAnalyzing) return;
    setIsLocalAnalyzing(true);
    setDeepAnalyzing(true);
    setDeepAnalyzeProgress('Deep analyzing...');

    try {
      const res = await fetch('/api/github/deep-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, username: project.ownerLogin }),
      });

      if (res.ok) {
        setDeepAnalyzeProgress('Deep analysis complete!');
        const projectsRes = await fetch(`/api/github/projects?username=${project.ownerLogin}`);
        if (projectsRes.ok) {
          const projectsData = await projectsRes.json();
          const updated = projectsData.projects?.find((p: Record<string, unknown>) => p.id === project.id);
          if (updated) {
            updateProject(project.id, updated as Partial<typeof project>);
          }
        }
      } else {
        setDeepAnalyzeProgress('Deep analysis failed');
      }
    } catch (err) {
      console.error('Deep analyze error:', err);
      setDeepAnalyzeProgress('Deep analysis failed');
    } finally {
      setIsLocalAnalyzing(false);
      setDeepAnalyzing(false);
      setTimeout(() => setDeepAnalyzeProgress(''), 3000);
    }
  }, [project, isLocalAnalyzing, isDeepAnalyzing, setDeepAnalyzing, setDeepAnalyzeProgress, updateProject]);

  // Load file tree handler
  const handleLoadFileTree = useCallback(async () => {
    if (!project || isLoadingFileTree) return;
    setIsLoadingFileTree(true);
    try {
      const res = await fetch(`/api/github/file-tree?projectId=${project.id}`);
      if (res.ok) {
        const data = await res.json();
        updateProject(project.id, { fileTree: data.fileTree || [] });
      }
    } catch (err) {
      console.error('File tree error:', err);
    } finally {
      setIsLoadingFileTree(false);
    }
  }, [project, isLoadingFileTree, updateProject]);

  // Load similar projects handler
  const handleLoadSimilar = useCallback(async () => {
    if (!project || isLoadingSimilar) return;
    setIsLoadingSimilar(true);
    try {
      const res = await fetch(`/api/github/similar-projects?projectId=${project.id}`);
      if (res.ok) {
        const data = await res.json();
        updateProject(project.id, { similarProjects: data.similarProjects || [] });
      }
    } catch (err) {
      console.error('Similar projects error:', err);
    } finally {
      setIsLoadingSimilar(false);
    }
  }, [project, isLoadingSimilar, updateProject]);

  // Generate README handler
  const handleGenerateReadme = useCallback(async () => {
    if (!project || isGeneratingReadme) return;
    setIsGeneratingReadme(true);
    try {
      const res = await fetch('/api/github/rewrite-readme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id }),
      });
      if (res.ok) {
        const data = await res.json();
        updateProject(project.id, {
          proposedReadme: data.proposedReadme,
          readmeGeneratedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('README generation error:', err);
    } finally {
      setIsGeneratingReadme(false);
    }
  }, [project, isGeneratingReadme, updateProject]);

  const toggleDir = (path: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  // Activity score
  const getActivityLevel = () => {
    if (!project?.pushedAt) return { level: 'inactive', color: '#64748b', icon: Clock, text: 'No activity' };
    const daysSincePush = (Date.now() - new Date(project.pushedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSincePush < 7) return { level: 'hot', color: '#ef4444', icon: Flame, text: 'Active this week' };
    if (daysSincePush < 30) return { level: 'warm', color: '#f59e0b', icon: Activity, text: 'Active this month' };
    if (daysSincePush < 180) return { level: 'cool', color: '#10b981', icon: Activity, text: 'Active within 6 months' };
    return { level: 'cold', color: '#64748b', icon: Clock, text: 'Inactive for 6+ months' };
  };

  const activity = getActivityLevel();
  const ActivityIcon = activity.icon;

  if (!project) return null;

  // Section counter for staggered animation
  let sectionIdx = 0;
  const nextSectionIdx = () => sectionIdx++;

  return (
    <Sheet open={detailOpen} onOpenChange={(open) => {
      setDetailOpen(open);
      if (!open) setSelectedProject(null);
    }}>
      <SheetContent className="w-[560px] sm:max-w-[560px] bg-card/95 backdrop-blur-md border-border/30 p-0 overflow-hidden">
        {/* Enhanced gradient header bar - 3px with shimmer + glow + noise texture */}
        <div className="relative noise-texture">
          <div
            className="h-[3px] w-full relative overflow-hidden"
            style={{
              background: `linear-gradient(90deg, ${catColor}40, ${catColor}90, ${catColor}40)`,
            }}
          >
            {/* Shimmer animation */}
            <div
              className="absolute inset-0 shimmer-bar"
              style={{
                background: `linear-gradient(90deg, transparent 0%, ${catColor}cc 50%, transparent 100%)`,
                animation: 'shimmerSlide 3s ease-in-out infinite',
              }}
            />
          </div>
          {/* Glow below */}
          <div
            className="absolute top-[3px] left-0 right-0 h-4 pointer-events-none"
            style={{
              background: `linear-gradient(180deg, ${catColor}20, transparent)`,
            }}
          />
        </div>

        <SheetHeader className="px-6 pt-4 pb-4 border-b border-border/20">
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-xl mt-0.5 shrink-0 flex items-center justify-center text-lg"
              style={{ backgroundColor: catColor + '20', color: catColor }}
            >
              {project.category === 'tool' ? '⚙' :
               project.category === 'library' ? '📚' :
               project.category === 'application' ? '🖥' :
               project.category === 'experiment' ? '🧪' :
               project.category === 'template' ? '📋' :
               project.category === 'config' ? '🔧' : '●'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <SheetTitle className="text-xl font-bold truncate">
                  {project.name}
                </SheetTitle>
                {/* Enhanced health score - larger ring with label */}
                <div className="flex items-center gap-2 shrink-0" title={`Health: ${health.label} (${health.score}/100)`}>
                  <div className="relative w-8 h-8">
                    <svg viewBox="0 0 32 32" className="w-8 h-8 -rotate-90">
                      <circle cx="16" cy="16" r="13" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                      <circle
                        cx="16" cy="16" r="13" fill="none" stroke={health.color} strokeWidth="3"
                        strokeDasharray={`${(health.score / 100) * 81.68} 81.68`}
                        strokeLinecap="round"
                        opacity="0.85"
                        className="progress-ring-animate"
                        style={{ transition: 'stroke-dasharray 0.6s ease-out' }}
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold" style={{ color: health.color }}>
                      {health.score}
                    </span>
                    {/* Pulse animation for Healthy */}
                    {health.label === 'Healthy' && (
                      <circle
                        cx="16" cy="16" r="13" fill="none" stroke={health.color} strokeWidth="1"
                        className="health-pulse"
                        style={{ opacity: 0.3 }}
                      />
                    )}
                  </div>
                  <span
                    className="text-[10px] font-semibold tracking-wide uppercase"
                    style={{ color: health.color, opacity: 0.8 }}
                  >
                    {health.label}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground/60 truncate mt-0.5">
                {project.fullName}
              </p>
            </div>
            {/* Action buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Bookmark button */}
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0 border-amber-500/30 hover:bg-amber-500/10"
                onClick={handleBookmark}
                title={isBookmarked ? 'Remove bookmark' : 'Bookmark this project'}
              >
                {isBookmarked ? (
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                ) : (
                  <Star className="w-3.5 h-3.5 text-amber-400/40" />
                )}
              </Button>
              {/* Share button */}
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0 border-border/30 hover:bg-card/60"
                onClick={handleShare}
                title="Share project summary"
              >
                {copiedShare ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Share2 className="w-3.5 h-3.5 text-muted-foreground/50" />
                )}
              </Button>
              {/* GitHub button */}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                onClick={() => window.open(project.htmlUrl, '_blank')}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                GitHub
              </Button>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 h-[calc(100vh-140px)]">
          <div className="px-6 py-5 space-y-5" key={panelKey}>
            {/* Activity indicator */}
            <motion.div
              custom={nextSectionIdx()}
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-background/30 border border-border/10"
            >
              <div className="relative">
                <ActivityIcon className="w-4 h-4" style={{ color: activity.color }} />
                {activity.level === 'hot' && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: activity.color }} />
                )}
              </div>
              <span className="text-xs font-medium" style={{ color: activity.color }}>{activity.text}</span>
              <div className="ml-auto flex items-center gap-2">
                {project.openIssuesCount > 0 && (
                  <span className="text-[10px] text-muted-foreground/40">
                    {project.openIssuesCount} open issues
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground/30 flex items-center gap-1" style={{ color: health.color }}>
                  <Heart className="w-3 h-3" /> {health.label}
                </span>
              </div>
            </motion.div>

            {/* ===== SKILL DOTS / CHARACTERISTICS ===== */}
            {project.codeSignature && (
              <motion.div
                custom={nextSectionIdx()}
                variants={sectionVariants}
                initial="hidden"
                animate="visible"
                className="space-y-1.5"
              >
                <h4 className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider flex items-center gap-1">
                  <Cpu className="w-3 h-3" /> Project Profile
                </h4>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-3 py-2.5 rounded-lg bg-background/30 border border-border/10 shadow-sm">
                  {skillProfile.filter(s => s.score > 0).map(skill => (
                    <div key={skill.label} className="flex items-center gap-1.5" title={`${skill.label}: ${skill.score}/5 — ${skill.label === 'Frontend' ? 'UI/web development capability' : skill.label === 'Backend' ? 'Server/API development capability' : skill.label === 'CLI' ? 'Command-line tool capability' : skill.label === 'AI/ML' ? 'AI/ML integration capability' : skill.label === 'Desktop' ? 'Desktop application capability' : 'API design capability'}`}>
                      <span className="text-[10px] text-muted-foreground/60 w-14">{skill.label}</span>
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <span
                            key={i}
                            className="w-1.5 h-1.5 rounded-full"
                            style={{
                              backgroundColor: i < skill.score ? skill.color : 'rgba(255,255,255,0.06)',
                              opacity: i < skill.score ? 0.8 : 1,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ===== TECH STACK SECTION - Enhanced with watermark + tooltip ===== */}
            {project.codeSignature && project.codeSignature.frameworks.length > 0 && (
              <motion.div
                custom={nextSectionIdx()}
                variants={sectionVariants}
                initial="hidden"
                animate="visible"
              >
                <h4 className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Box className="w-3 h-3" /> Tech Stack
                </h4>
                <div className="flex flex-wrap gap-2">
                  {project.codeSignature.frameworks.map(fw => {
                    const fwColor = FRAMEWORK_COLORS[fw] || '#10b981';
                    const usageCount = frameworkUsage.get(fw) || 1;
                    return (
                      <div
                        key={fw}
                        className="relative flex items-center gap-2 px-3 py-2 rounded-lg border overflow-hidden group"
                        style={{
                          backgroundColor: fwColor + '10',
                          borderColor: fwColor + '25',
                        }}
                        title={`${usageCount} project${usageCount > 1 ? 's' : ''} use ${fw}`}
                      >
                        {/* Watermark letter */}
                        <span
                          className="absolute -right-1 -bottom-2 text-3xl font-black select-none pointer-events-none"
                          style={{ color: fwColor, opacity: 0.06 }}
                        >
                          {fw.charAt(0).toUpperCase()}
                        </span>
                        {/* Subtle background pattern */}
                        <div
                          className="absolute inset-0 opacity-[0.03]"
                          style={{
                            backgroundImage: `repeating-linear-gradient(45deg, ${fwColor} 0px, ${fwColor} 1px, transparent 1px, transparent 6px)`,
                          }}
                        />
                        <span
                          className="w-6 h-6 rounded flex items-center justify-center text-[11px] font-bold shrink-0 relative"
                          style={{ backgroundColor: fwColor + '30', color: fwColor }}
                        >
                          {fw.charAt(0).toUpperCase()}
                        </span>
                        <span className="text-xs font-medium relative" style={{ color: fwColor }}>{fw}</span>
                        {usageCount > 1 && (
                          <span className="text-[8px] text-muted-foreground/40 relative ml-0.5">
                            ×{usageCount}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* ===== DEEP SUMMARY SECTION ===== */}
            {project.deepSummary ? (
              <motion.div
                custom={nextSectionIdx()}
                variants={sectionVariants}
                initial="hidden"
                animate="visible"
                className="relative"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-xs font-medium text-emerald-400/80 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Code-Verified Summary
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-emerald-500/30 text-emerald-400 ml-1">
                      Deep Analyzed
                    </Badge>
                  </h4>
                  <button
                    onClick={handleCopySummary}
                    className="flex items-center gap-1 text-[10px] text-muted-foreground/40 hover:text-foreground/60 transition-colors px-1.5 py-0.5 rounded hover:bg-card/30"
                    title="Copy summary to clipboard"
                  >
                    {copied ? (
                      <><Check className="w-3 h-3 text-emerald-400" /> Copied</>
                    ) : (
                      <><Copy className="w-3 h-3" /> Copy</>
                    )}
                  </button>
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-3.5">
                  {project.deepSummary}
                </p>
                {project.deepAnalyzedAt && (
                  <p className="text-[9px] text-muted-foreground/30 mt-1 text-right">
                    Deep analyzed {formatDistanceToNow(new Date(project.deepAnalyzedAt), { addSuffix: true })}
                  </p>
                )}
              </motion.div>
            ) : (
              <motion.div
                custom={nextSectionIdx()}
                variants={sectionVariants}
                initial="hidden"
                animate="visible"
                className="flex flex-col items-center gap-2 p-4 rounded-lg border border-dashed border-border/30 bg-background/20"
              >
                <Microscope className="w-5 h-5 text-emerald-400/40" />
                <p className="text-xs text-muted-foreground/50 text-center">Deep analysis hasn&apos;t been run on this repo yet</p>
                <Button
                  size="sm"
                  className="h-7 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
                  onClick={handleDeepAnalyze}
                  disabled={isLocalAnalyzing || isDeepAnalyzing}
                >
                  {isLocalAnalyzing ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing...</>
                  ) : (
                    <><Sparkles className="w-3.5 h-3.5" /> Deep Analyze This Repo</>
                  )}
                </Button>
              </motion.div>
            )}

            {/* Regular AI Summary */}
            {project.summary && (
              <motion.div
                custom={nextSectionIdx()}
                variants={sectionVariants}
                initial="hidden"
                animate="visible"
              >
                <h4 className="text-xs font-medium text-amber-400/60 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  AI Summary
                </h4>
                <p className="text-sm text-foreground/80 leading-relaxed bg-amber-500/5 border border-amber-500/10 rounded-lg p-3">
                  {project.summary}
                </p>
              </motion.div>
            )}

            {/* ===== CODE SIGNATURE SECTION ===== */}
            {project.codeSignature && (
              <motion.div
                custom={nextSectionIdx()}
                variants={sectionVariants}
                initial="hidden"
                animate="visible"
              >
                <h4 className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Cpu className="w-3 h-3" /> Code Signature
                </h4>
                <div className="space-y-2">
                  {project.codeSignature.frameworks.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground/40 mb-1">Frameworks</p>
                      <div className="flex flex-wrap gap-1">
                        {project.codeSignature.frameworks.map(fw => (
                          <Badge key={fw} variant="secondary" className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                            {fw}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {project.codeSignature.patterns.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground/40 mb-1">Patterns</p>
                      <div className="flex flex-wrap gap-1">
                        {project.codeSignature.patterns.map(pat => (
                          <Badge key={pat} variant="secondary" className="text-xs px-2 py-0.5 bg-amber-500/10 text-amber-400 border-amber-500/20">
                            {pat}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {project.codeSignature.architecture && project.codeSignature.architecture !== 'Unknown' && (
                    <div>
                      <p className="text-[10px] text-muted-foreground/40 mb-1">Architecture</p>
                      <Badge variant="outline" className="text-xs px-2.5 py-0.5 border-blue-500/30 text-blue-400">
                        <Box className="w-3 h-3 mr-1" /> {project.codeSignature.architecture}
                      </Badge>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Description */}
            {project.description && (
              <motion.div
                custom={nextSectionIdx()}
                variants={sectionVariants}
                initial="hidden"
                animate="visible"
              >
                <h4 className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider mb-1.5">
                  Description
                </h4>
                <p className="text-sm text-foreground/70 leading-relaxed">
                  {project.description}
                </p>
              </motion.div>
            )}

            {/* Category */}
            {project.category && (
              <motion.div
                custom={nextSectionIdx()}
                variants={sectionVariants}
                initial="hidden"
                animate="visible"
              >
                <h4 className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Layers className="w-3 h-3" /> Category
                </h4>
                <span
                  className="inline-block text-sm px-3.5 py-1.5 rounded-lg font-medium border"
                  style={{ backgroundColor: catColor + '10', color: catColor, borderColor: catColor + '20' }}
                >
                  {project.category}
                </span>
              </motion.div>
            )}

            {/* Tags */}
            {project.tags.length > 0 && (
              <motion.div
                custom={nextSectionIdx()}
                variants={sectionVariants}
                initial="hidden"
                animate="visible"
              >
                <h4 className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Tag className="w-3 h-3" /> Tags
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {project.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="text-xs px-2.5 py-0.5 bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Topics */}
            {project.topics.length > 0 && (
              <motion.div
                custom={nextSectionIdx()}
                variants={sectionVariants}
                initial="hidden"
                animate="visible"
              >
                <h4 className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider mb-1.5">
                  GitHub Topics
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {project.topics.map((topic) => (
                    <Badge
                      key={topic}
                      variant="outline"
                      className="text-xs px-2 py-0.5 border-border/30"
                    >
                      {topic}
                    </Badge>
                  ))}
                </div>
              </motion.div>
            )}

            <Separator className="bg-border/10 section-divider-dotted" />

            {/* ===== ENHANCED FILE TREE SECTION ===== */}
            <motion.div
              custom={nextSectionIdx()}
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
            >
              <h4 className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider mb-2 flex items-center gap-1">
                <FolderTree className="w-3 h-3" /> File Tree
                {fileTreeStats.files > 0 && (
                  <span className="text-[9px] text-muted-foreground/30 font-normal ml-1">
                    {fileTreeStats.files} files in {fileTreeStats.dirs} directories
                  </span>
                )}
              </h4>
              {fileTreeStructure.length > 0 ? (
                <div className="max-h-64 overflow-y-auto rounded-lg border border-border/10 bg-background/30 p-2 text-xs custom-scrollbar">
                  {fileTreeStructure.map((node, idx) => (
                    <EnhancedFileTreeNodeItem
                      key={node.path}
                      node={node}
                      depth={0}
                      expandedDirs={expandedDirs}
                      toggleDir={toggleDir}
                      index={idx}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 p-3 rounded-lg border border-dashed border-border/20 bg-background/10">
                  <Folder className="w-4 h-4 text-muted-foreground/30" />
                  <p className="text-[10px] text-muted-foreground/40">No file tree loaded</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 gap-1 text-[10px] border-border/30"
                    onClick={handleLoadFileTree}
                    disabled={isLoadingFileTree}
                  >
                    {isLoadingFileTree ? (
                      <><Loader2 className="w-3 h-3 animate-spin" /> Loading...</>
                    ) : (
                      <><FolderTree className="w-3 h-3" /> Load File Tree</>
                    )}
                  </Button>
                </div>
              )}
            </motion.div>

            {/* ===== ENHANCED DEPENDENCIES SECTION ===== */}
            {project.dependencies && (
              <motion.div
                custom={nextSectionIdx()}
                variants={sectionVariants}
                initial="hidden"
                animate="visible"
              >
                <h4 className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Package className="w-3 h-3" /> Dependencies
                  <span className="text-[9px] text-muted-foreground/30 font-normal ml-1">
                    {((project.dependencies.runtime?.length || 0) + (project.dependencies.dev?.length || 0))} total
                  </span>
                </h4>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex gap-1">
                    {(['all', 'runtime', 'dev'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setDepFilter(f)}
                        className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                          depFilter === f
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'text-muted-foreground/40 border border-border/10 hover:border-border/30'
                        }`}
                      >
                        {f === 'all' ? 'All' : f === 'runtime' ? 'Runtime' : 'Dev'}
                      </button>
                    ))}
                  </div>
                  {/* Search/filter input */}
                  <div className="flex-1 relative">
                    <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-muted-foreground/30" />
                    <input
                      type="text"
                      value={depSearch}
                      onChange={e => setDepSearch(e.target.value)}
                      placeholder="Filter deps..."
                      className="w-full h-5 text-[10px] bg-background/40 border border-border/10 rounded pl-5 pr-2 text-foreground/60 placeholder:text-muted-foreground/25 focus:outline-none focus:border-emerald-500/30"
                    />
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border/10 bg-background/30 p-2 space-y-0.5 custom-scrollbar">
                  {(depFilter === 'all' || depFilter === 'runtime') && filteredDeps.runtime.map(dep => (
                    <EnhancedDepItem
                      key={`r-${dep}`}
                      name={dep}
                      sharedCount={depShareMap.get(dep)}
                      sharedProjects={depSharedProjects.get(dep)}
                      type="runtime"
                      allProjects={projects}
                    />
                  ))}
                  {(depFilter === 'all' || depFilter === 'dev') && filteredDeps.dev.map(dep => (
                    <EnhancedDepItem
                      key={`d-${dep}`}
                      name={dep}
                      sharedCount={depShareMap.get(dep)}
                      sharedProjects={depSharedProjects.get(dep)}
                      type="dev"
                      allProjects={projects}
                    />
                  ))}
                  {(!filteredDeps.runtime.length && !filteredDeps.dev.length) && (
                    <p className="text-[10px] text-muted-foreground/30 p-2 text-center">
                      {depSearch ? 'No matching dependencies' : 'No dependencies detected'}
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {/* ===== ENHANCED SIMILAR PROJECTS SECTION ===== */}
            <motion.div
              custom={nextSectionIdx()}
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
            >
              <h4 className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Network className="w-3 h-3" /> Similar Projects
              </h4>
              {project.similarProjects && project.similarProjects.length > 0 ? (
                <div className="space-y-1.5">
                  {project.similarProjects.map(sp => {
                    const spProject = projects.find(p => p.id === sp.id);
                    const spColor = spProject?.category ? CATEGORY_COLORS[spProject.category] : '#64748b';
                    return (
                      <motion.button
                        key={sp.id}
                        whileHover={{ scale: 1.01 }}
                        onClick={() => {
                          if (spProject) {
                            setSelectedProject(spProject);
                          }
                        }}
                        className="w-full text-left p-2.5 rounded-lg border border-border/15 bg-background/20 hover:bg-background/40 transition-colors group/similar"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {/* Colored category dot */}
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-white/10"
                            style={{ backgroundColor: spColor }}
                          />
                          <span className="text-xs font-medium text-foreground/80 flex-1 truncate">{sp.name}</span>
                          {/* Similarity bar */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="w-16 h-1.5 rounded-full bg-background/50 overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${sp.score}%`,
                                  backgroundColor: sp.score >= 70 ? '#10b981' : sp.score >= 40 ? '#f59e0b' : '#64748b',
                                  opacity: 0.7,
                                }}
                              />
                            </div>
                            <span className="text-[10px] font-bold text-emerald-400 w-7 text-right">{sp.score}%</span>
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground/40 line-clamp-1 group-hover/similar:text-muted-foreground/60 transition-colors">{sp.reason}</p>
                      </motion.button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 p-3 rounded-lg border border-dashed border-border/20 bg-background/10">
                  <Network className="w-4 h-4 text-muted-foreground/30" />
                  <p className="text-[10px] text-muted-foreground/40">No similar projects computed</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 gap-1 text-[10px] border-border/30"
                    onClick={handleLoadSimilar}
                    disabled={isLoadingSimilar}
                  >
                    {isLoadingSimilar ? (
                      <><Loader2 className="w-3 h-3 animate-spin" /> Loading...</>
                    ) : (
                      <><Network className="w-3 h-3" /> Find Similar</>
                    )}
                  </Button>
                </div>
              )}
            </motion.div>

            <Separator className="bg-border/10 section-divider-dotted" />

            {/* Stats Grid */}
            <motion.div
              custom={nextSectionIdx()}
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-2 gap-2.5"
            >
              {project.language && (
                <StatItem
                  icon={<span className="w-3 h-3 rounded-full" style={{ backgroundColor: langColor }} />}
                  label="Language"
                  value={project.language}
                />
              )}
              <StatItem
                icon={<Star className="w-3.5 h-3.5 text-amber-400" />}
                label="Stars"
                value={String(project.stargazersCount)}
              />
              <StatItem
                icon={<GitFork className="w-3.5 h-3.5 text-blue-400" />}
                label="Forks"
                value={String(project.forksCount)}
              />
              <StatItem
                icon={<AlertCircle className="w-3.5 h-3.5 text-orange-400" />}
                label="Open Issues"
                value={String(project.openIssuesCount)}
              />
              <StatItem
                icon={<GitBranch className="w-3.5 h-3.5 text-emerald-400" />}
                label="Branch"
                value={project.defaultBranch}
              />
              <StatItem
                icon={<Clock className="w-3.5 h-3.5 text-muted-foreground" />}
                label="Last Push"
                value={project.pushedAt
                  ? formatDistanceToNow(new Date(project.pushedAt), { addSuffix: true })
                  : 'Never'}
              />
            </motion.div>

            {/* Badges */}
            <motion.div
              custom={nextSectionIdx()}
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
              className="flex items-center gap-2 flex-wrap"
            >
              {project.isFork && (
                <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400">
                  Fork
                </Badge>
              )}
              {project.isArchived && (
                <Badge variant="outline" className="text-xs border-orange-500/30 text-orange-400">
                  <Archive className="w-3 h-3 mr-1" /> Archived
                </Badge>
              )}
              <Badge variant="outline" className="text-xs border-border/30">
                {project.visibility}
              </Badge>
              <Badge variant="outline" className="text-xs border-border/30">
                {project.ownerType}
              </Badge>
            </motion.div>

            {/* Homepage */}
            {project.homepage && (
              <motion.div
                custom={nextSectionIdx()}
                variants={sectionVariants}
                initial="hidden"
                animate="visible"
              >
                <h4 className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Globe className="w-3 h-3" /> Homepage
                </h4>
                <a
                  href={project.homepage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors"
                >
                  {project.homepage}
                </a>
              </motion.div>
            )}

            <Separator className="bg-border/10 section-divider-dotted" />

            {/* ===== ENHANCED README SECTION WITH DIFF VIEW ===== */}
            {(project.readmeContent || project.proposedReadme) && (
              <motion.div
                custom={nextSectionIdx()}
                variants={sectionVariants}
                initial="hidden"
                animate="visible"
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider flex items-center gap-1">
                    <FileText className="w-3 h-3" /> README
                  </h4>
                  {/* Copy README button */}
                  {project.proposedReadme && (
                    <button
                      onClick={handleCopyReadme}
                      className="flex items-center gap-1 text-[10px] text-muted-foreground/40 hover:text-foreground/60 transition-colors px-1.5 py-0.5 rounded hover:bg-card/30"
                      title="Copy proposed README to clipboard"
                    >
                      {copiedReadme ? (
                        <><Check className="w-3 h-3 text-emerald-400" /> Copied</>
                      ) : (
                        <><Copy className="w-3 h-3" /> Copy README</>
                      )}
                    </button>
                  )}
                </div>
                {project.proposedReadme ? (
                  <Tabs value={readmeView} onValueChange={(v) => setReadmeView(v as 'proposed' | 'original' | 'diff')} className="w-full">
                    <TabsList className="h-7 bg-background/30 p-0.5 relative">
                      <TabsTrigger value="proposed" className="text-[10px] h-6 px-2 data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400 relative data-[state=active]:tab-active-indicator">
                        <Sparkles className="w-3 h-3 mr-1" /> Generated
                      </TabsTrigger>
                      <TabsTrigger value="original" className="text-[10px] h-6 px-2 relative data-[state=active]:tab-active-indicator">
                        Original
                      </TabsTrigger>
                      <TabsTrigger value="diff" className="text-[10px] h-6 px-2 data-[state=active]:bg-amber-600/20 data-[state=active]:text-amber-400 relative data-[state=active]:tab-active-indicator">
                        Diff
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="proposed" className="mt-2">
                      <div className="text-xs text-foreground/70 leading-relaxed bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-4 max-h-80 overflow-y-auto prose prose-invert prose-sm max-w-none custom-scrollbar">
                        <ReactMarkdown>{project.proposedReadme}</ReactMarkdown>
                      </div>
                      {project.readmeGeneratedAt && (
                        <p className="text-[9px] text-muted-foreground/30 mt-1 text-right">
                          Generated {formatDistanceToNow(new Date(project.readmeGeneratedAt), { addSuffix: true })}
                        </p>
                      )}
                    </TabsContent>
                    <TabsContent value="original" className="mt-2">
                      <div className="text-xs text-foreground/70 leading-relaxed bg-background/50 rounded-lg p-4 border border-border/10 max-h-80 overflow-y-auto prose prose-invert prose-sm max-w-none custom-scrollbar">
                        <ReactMarkdown>{(project.readmeContent || '').slice(0, 5000)}</ReactMarkdown>
                      </div>
                    </TabsContent>
                    <TabsContent value="diff" className="mt-2">
                      <div className="text-xs leading-relaxed bg-background/50 rounded-lg p-4 border border-border/10 max-h-80 overflow-y-auto custom-scrollbar font-mono">
                        {readmeDiff.map((line, i) => (
                          <div
                            key={i}
                            className={`py-0.5 px-2 rounded-sm ${
                              line.type === 'added'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : line.type === 'removed'
                                ? 'bg-red-500/10 text-red-400'
                                : 'text-foreground/50'
                            }`}
                          >
                            <span className="mr-1 select-none opacity-40">
                              {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                            </span>
                            {line.text}
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  </Tabs>
                ) : project.readmeContent ? (
                  <div className="space-y-2">
                    <div className="text-xs text-foreground/70 leading-relaxed bg-background/50 rounded-lg p-4 border border-border/10 max-h-80 overflow-y-auto prose prose-invert prose-sm max-w-none custom-scrollbar">
                      <ReactMarkdown>{project.readmeContent.slice(0, 3000)}</ReactMarkdown>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 gap-1 text-[10px] border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 w-full"
                      onClick={handleGenerateReadme}
                      disabled={isGeneratingReadme}
                    >
                      {isGeneratingReadme ? (
                        <><Loader2 className="w-3 h-3 animate-spin" /> Generating...</>
                      ) : (
                        <><Sparkles className="w-3 h-3" /> Generate Accurate README</>
                      )}
                    </Button>
                  </div>
                ) : null}
              </motion.div>
            )}

            {!project.readmeContent && !project.proposedReadme && (
              <motion.div
                custom={nextSectionIdx()}
                variants={sectionVariants}
                initial="hidden"
                animate="visible"
                className="flex flex-col items-center gap-2 p-3 rounded-lg border border-dashed border-border/20 bg-background/10"
              >
                <FileText className="w-4 h-4 text-muted-foreground/30" />
                <p className="text-[10px] text-muted-foreground/40">No README available</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 gap-1 text-[10px] border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                  onClick={handleGenerateReadme}
                  disabled={isGeneratingReadme}
                >
                  {isGeneratingReadme ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> Generating...</>
                  ) : (
                    <><Sparkles className="w-3 h-3" /> Generate README</>
                  )}
                </Button>
              </motion.div>
            )}

            {/* Dates */}
            <div className="text-[10px] text-muted-foreground/30 space-y-0.5 pt-2">
              <p>Created: {format(new Date(project.githubCreatedAt), 'MMM d, yyyy')}</p>
              <p>Updated: {format(new Date(project.githubUpdatedAt), 'MMM d, yyyy')}</p>
              {project.analyzedAt && (
                <p>Analyzed: {format(new Date(project.analyzedAt), 'MMM d, yyyy h:mm a')}</p>
              )}
              {project.deepAnalyzedAt && (
                <p>Deep Analyzed: {format(new Date(project.deepAnalyzedAt), 'MMM d, yyyy h:mm a')}</p>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* CSS for shimmer + health pulse */}
        <style>{`
          @keyframes shimmerSlide {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(200%); }
          }
          @keyframes healthPulse {
            0% { r: 13; opacity: 0.3; }
            50% { r: 16; opacity: 0; }
            100% { r: 13; opacity: 0.3; }
          }
          .health-pulse {
            animation: healthPulse 2s ease-in-out infinite;
          }
        `}</style>
      </SheetContent>
    </Sheet>
  );
}

// Enhanced file tree node component with animated folder icons and file type icons
function EnhancedFileTreeNodeItem({
  node,
  depth,
  expandedDirs,
  toggleDir,
  index = 0,
}: {
  node: FileTreeNode;
  depth: number;
  expandedDirs: Set<string>;
  toggleDir: (path: string) => void;
  index?: number;
}) {
  const isDir = node.type === 'dir';
  const isExpanded = expandedDirs.has(node.path);
  const fileName = node.path.split('/').pop() || node.path;
  const isEven = index % 2 === 0;

  // Get file extension for icon
  const ext = fileName.includes('.') ? '.' + fileName.split('.').pop() : '';
  const fileInfo = !isDir && ext ? FILE_TYPE_ICONS[ext] : null;
  const FileIcon = fileInfo?.icon || File;
  const fileIconColor = fileInfo?.color || '#64748b';

  return (
    <div>
      <button
        onClick={() => isDir && toggleDir(node.path)}
        className={`w-full flex items-center gap-1 py-0.5 px-1 rounded hover:bg-card/40 transition-colors text-left ${isEven ? 'bg-background/5' : ''}`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {isDir ? (
          <>
            <motion.span
              animate={{ rotate: isExpanded ? 90 : 0 }}
              transition={{ duration: 0.15 }}
              className="shrink-0 flex items-center"
            >
              <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
            </motion.span>
            <motion.span
              animate={{ scale: isExpanded ? 1.1 : 1 }}
              transition={{ duration: 0.15 }}
            >
              <Folder className={`w-3 h-3 shrink-0 ${isExpanded ? 'text-amber-400/80' : 'text-amber-400/50'}`} />
            </motion.span>
          </>
        ) : (
          <>
            <span className="w-3 shrink-0" />
            <FileIcon className="w-3 h-3 shrink-0" style={{ color: fileIconColor, opacity: 0.6 }} />
          </>
        )}
        <span className={`text-[10px] truncate ${isDir ? 'text-foreground/70 font-medium' : 'text-muted-foreground/50'}`}>
          {fileName}
        </span>
      </button>
      <AnimatePresence>
        {isDir && isExpanded && node.children?.map((child, ci) => (
          <motion.div
            key={child.path}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
          >
            <EnhancedFileTreeNodeItem
              node={child}
              depth={depth + 1}
              expandedDirs={expandedDirs}
              toggleDir={toggleDir}
              index={ci}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// Enhanced dependency item with shared project dots
function EnhancedDepItem({ name, sharedCount, sharedProjects, type, allProjects }: {
  name: string;
  sharedCount?: number;
  sharedProjects?: string[];
  type: 'runtime' | 'dev';
  allProjects: { name: string; category?: string | null; id: string }[];
}) {
  // Get colors for shared project dots
  const sharedProjectColors = useMemo(() => {
    if (!sharedProjects) return [];
    return sharedProjects.map(pName => {
      const p = allProjects.find(pr => pr.name === pName);
      return p?.category ? CATEGORY_COLORS[p.category] : '#64748b';
    });
  }, [sharedProjects, allProjects]);

  return (
    <div className="flex items-center gap-2 py-0.5 px-1 rounded hover:bg-card/30 transition-colors group">
      <Package className={`w-3 h-3 shrink-0 ${type === 'runtime' ? 'text-emerald-400/60' : 'text-amber-400/60'}`} />
      <span className="text-[10px] text-foreground/60 flex-1 truncate">{name}</span>
      {/* Shared project dots */}
      {sharedProjectColors.length > 0 && (
        <div className="flex items-center gap-0.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" title={`Shared with: ${sharedProjects?.join(', ')}`}>
          {sharedProjectColors.slice(0, 4).map((color, i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: color }}
            />
          ))}
          {sharedProjectColors.length > 4 && (
            <span className="text-[7px] text-muted-foreground/40">+{sharedProjectColors.length - 4}</span>
          )}
        </div>
      )}
      {sharedCount && sharedCount > 0 && (
        <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-blue-500/20 text-blue-400/70 shrink-0">
          Also in {sharedCount}
        </Badge>
      )}
    </div>
  );
}

// Build tree from flat path list
function buildTree(files: { path: string; type: 'file' | 'dir' }[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];
  const map = new Map<string, FileTreeNode>();

  const sorted = [...files].sort((a, b) => {
    const aParts = a.path.split('/');
    const bParts = b.path.split('/');
    if (aParts.length !== bParts.length) return aParts.length - bParts.length;
    if (a.type === 'dir' && b.type !== 'dir') return -1;
    if (a.type !== 'dir' && b.type === 'dir') return 1;
    return a.path.localeCompare(b.path);
  });

  for (const file of sorted) {
    const parts = file.path.split('/');
    
    const node: FileTreeNode = {
      path: file.path,
      type: file.type,
      children: file.type === 'dir' ? [] : undefined,
    };

    map.set(file.path, node);

    if (parts.length === 1) {
      root.push(node);
    } else {
      const parentPath = parts.slice(0, -1).join('/');
      const parent = map.get(parentPath);
      if (parent && parent.children) {
        parent.children.push(node);
      } else {
        root.push(node);
      }
    }
  }

  return root;
}

function StatItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 bg-background/30 rounded-lg px-3 py-2.5 border border-border/5">
      <div className="shrink-0">{icon}</div>
      <div>
        <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">{label}</p>
        <p className="text-xs font-medium text-foreground/80">{value}</p>
      </div>
    </div>
  );
}
