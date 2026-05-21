'use client';

import { useState, useCallback, useMemo } from 'react';
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
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { formatDistanceToNow, format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

export function DetailPanel() {
  const { selectedProject, setSelectedProject, detailOpen, setDetailOpen, projects, updateProject, isDeepAnalyzing, deepAnalyzeProgress, setDeepAnalyzing, setDeepAnalyzeProgress } = useAtlasStore();

  // Local state for deep analysis features - ALWAYS called, before any conditional
  const [isLocalAnalyzing, setIsLocalAnalyzing] = useState(false);
  const [isGeneratingReadme, setIsGeneratingReadme] = useState(false);
  const [isLoadingFileTree, setIsLoadingFileTree] = useState(false);
  const [isLoadingSimilar, setIsLoadingSimilar] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(['']));
  const [depFilter, setDepFilter] = useState<'all' | 'runtime' | 'dev'>('all');

  const project = selectedProject;
  const catColor = project?.category ? CATEGORY_COLORS[project.category] : '#64748b';
  const langColor = project?.language ? LANGUAGE_COLORS[project.language] : '#8b8b8b';

  // Build file tree structure from flat list
  const fileTreeStructure = useMemo(() => {
    if (!project?.fileTree || project.fileTree.length === 0) return [];
    return buildTree(project.fileTree);
  }, [project?.fileTree]);

  // Compute dependency sharing counts
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

        // Refresh project data
        const projectsRes = await fetch(`/api/github/projects?username=${project.ownerLogin}`);
        if (projectsRes.ok) {
          const projectsData = await projectsRes.json();
          const updated = projectsData.projects?.find((p: any) => p.id === project.id);
          if (updated) {
            updateProject(project.id, updated);
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

  return (
    <Sheet open={detailOpen} onOpenChange={(open) => {
      setDetailOpen(open);
      if (!open) setSelectedProject(null);
    }}>
      <SheetContent className="w-[560px] sm:max-w-[560px] bg-card/95 backdrop-blur-md border-border/30 p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/20">
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
              <SheetTitle className="text-xl font-bold truncate">
                {project.name}
              </SheetTitle>
              <p className="text-xs text-muted-foreground/60 truncate mt-0.5">
                {project.fullName}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              onClick={() => window.open(project.htmlUrl, '_blank')}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              GitHub
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 h-[calc(100vh-120px)]">
          <div className="px-6 py-5 space-y-5">
            {/* Activity indicator */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background/30 border border-border/10">
              <ActivityIcon className="w-4 h-4" style={{ color: activity.color }} />
              <span className="text-xs font-medium" style={{ color: activity.color }}>{activity.text}</span>
              {project.openIssuesCount > 0 && (
                <span className="text-[10px] text-muted-foreground/40 ml-auto">
                  {project.openIssuesCount} open issues
                </span>
              )}
            </div>

            {/* ===== DEEP SUMMARY SECTION ===== */}
            {project.deepSummary ? (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative"
              >
                <h4 className="text-xs font-medium text-emerald-400/80 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Code-Verified Summary
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-emerald-500/30 text-emerald-400 ml-1">
                    Deep Analyzed
                  </Badge>
                </h4>
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
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
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
              <div>
                <h4 className="text-xs font-medium text-amber-400/60 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  AI Summary
                </h4>
                <p className="text-sm text-foreground/80 leading-relaxed bg-amber-500/5 border border-amber-500/10 rounded-lg p-3">
                  {project.summary}
                </p>
              </div>
            )}

            {/* ===== CODE SIGNATURE SECTION ===== */}
            {project.codeSignature && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
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
              <div>
                <h4 className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider mb-1.5">
                  Description
                </h4>
                <p className="text-sm text-foreground/70 leading-relaxed">
                  {project.description}
                </p>
              </div>
            )}

            {/* Category */}
            {project.category && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Layers className="w-3 h-3" /> Category
                </h4>
                <span
                  className="inline-block text-sm px-3.5 py-1.5 rounded-lg font-medium border"
                  style={{ backgroundColor: catColor + '10', color: catColor, borderColor: catColor + '20' }}
                >
                  {project.category}
                </span>
              </div>
            )}

            {/* Tags */}
            {project.tags.length > 0 && (
              <div>
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
              </div>
            )}

            {/* Topics */}
            {project.topics.length > 0 && (
              <div>
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
              </div>
            )}

            <Separator className="bg-border/20" />

            {/* ===== FILE TREE SECTION ===== */}
            <div>
              <h4 className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider mb-2 flex items-center gap-1">
                <FolderTree className="w-3 h-3" /> File Tree
              </h4>
              {fileTreeStructure.length > 0 ? (
                <div className="max-h-64 overflow-y-auto rounded-lg border border-border/10 bg-background/30 p-2 text-xs custom-scrollbar">
                  {fileTreeStructure.map(node => (
                    <FileTreeNodeItem
                      key={node.path}
                      node={node}
                      depth={0}
                      expandedDirs={expandedDirs}
                      toggleDir={toggleDir}
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
            </div>

            {/* ===== DEPENDENCIES SECTION ===== */}
            {project.dependencies && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Package className="w-3 h-3" /> Dependencies
                </h4>
                <div className="flex gap-1 mb-2">
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
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border/10 bg-background/30 p-2 space-y-0.5 custom-scrollbar">
                  {(depFilter === 'all' || depFilter === 'runtime') && project.dependencies.runtime?.map(dep => (
                    <DepItem key={`r-${dep}`} name={dep} sharedCount={depShareMap.get(dep)} type="runtime" />
                  ))}
                  {(depFilter === 'all' || depFilter === 'dev') && project.dependencies.dev?.map(dep => (
                    <DepItem key={`d-${dep}`} name={dep} sharedCount={depShareMap.get(dep)} type="dev" />
                  ))}
                  {(!project.dependencies.runtime?.length && !project.dependencies.dev?.length) && (
                    <p className="text-[10px] text-muted-foreground/30 p-2 text-center">No dependencies detected</p>
                  )}
                </div>
              </div>
            )}

            {/* ===== SIMILAR PROJECTS SECTION ===== */}
            <div>
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
                        className="w-full text-left p-2.5 rounded-lg border border-border/15 bg-background/20 hover:bg-background/40 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: spColor }} />
                          <span className="text-xs font-medium text-foreground/80 flex-1 truncate">{sp.name}</span>
                          <span className="text-[10px] font-bold text-emerald-400">{sp.score}%</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground/40 line-clamp-1">{sp.reason}</p>
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
            </div>

            <Separator className="bg-border/20" />

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2.5">
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
            </div>

            {/* Badges */}
            <div className="flex items-center gap-2 flex-wrap">
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
            </div>

            {/* Homepage */}
            {project.homepage && (
              <div>
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
              </div>
            )}

            <Separator className="bg-border/20" />

            {/* ===== PROPOSED README / README SECTION ===== */}
            {(project.readmeContent || project.proposedReadme) && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <FileText className="w-3 h-3" /> README
                </h4>
                {project.proposedReadme ? (
                  <Tabs defaultValue="proposed" className="w-full">
                    <TabsList className="h-7 bg-background/30 p-0.5">
                      <TabsTrigger value="proposed" className="text-[10px] h-6 px-2 data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">
                        <Sparkles className="w-3 h-3 mr-1" /> Generated
                      </TabsTrigger>
                      <TabsTrigger value="original" className="text-[10px] h-6 px-2">
                        Original
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
              </div>
            )}

            {!project.readmeContent && !project.proposedReadme && (
              <div className="flex flex-col items-center gap-2 p-3 rounded-lg border border-dashed border-border/20 bg-background/10">
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
              </div>
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
      </SheetContent>
    </Sheet>
  );
}

// File tree node component
function FileTreeNodeItem({
  node,
  depth,
  expandedDirs,
  toggleDir,
}: {
  node: FileTreeNode;
  depth: number;
  expandedDirs: Set<string>;
  toggleDir: (path: string) => void;
}) {
  const isDir = node.type === 'dir';
  const isExpanded = expandedDirs.has(node.path);
  const fileName = node.path.split('/').pop() || node.path;

  return (
    <div>
      <button
        onClick={() => isDir && toggleDir(node.path)}
        className="w-full flex items-center gap-1 py-0.5 px-1 rounded hover:bg-card/40 transition-colors text-left"
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {isDir ? (
          <>
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-muted-foreground/50 shrink-0" />
            ) : (
              <ChevronRight className="w-3 h-3 text-muted-foreground/50 shrink-0" />
            )}
            <Folder className="w-3 h-3 text-amber-400/60 shrink-0" />
          </>
        ) : (
          <>
            <span className="w-3 shrink-0" />
            <File className="w-3 h-3 text-muted-foreground/40 shrink-0" />
          </>
        )}
        <span className={`text-[10px] truncate ${isDir ? 'text-foreground/70 font-medium' : 'text-muted-foreground/50'}`}>
          {fileName}
        </span>
      </button>
      <AnimatePresence>
        {isDir && isExpanded && node.children?.map(child => (
          <motion.div
            key={child.path}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
          >
            <FileTreeNodeItem
              node={child}
              depth={depth + 1}
              expandedDirs={expandedDirs}
              toggleDir={toggleDir}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// Dependency item component
function DepItem({ name, sharedCount, type }: { name: string; sharedCount?: number; type: 'runtime' | 'dev' }) {
  return (
    <div className="flex items-center gap-2 py-0.5 px-1 rounded hover:bg-card/30 transition-colors">
      <Package className={`w-3 h-3 shrink-0 ${type === 'runtime' ? 'text-emerald-400/60' : 'text-amber-400/60'}`} />
      <span className="text-[10px] text-foreground/60 flex-1 truncate">{name}</span>
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

  // Sort to ensure dirs come before files at same level
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
