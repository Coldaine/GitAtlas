'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Project, CATEGORY_COLORS } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, ShieldCheck, AlertTriangle, Archive, Clock,
  FileText, Microscope, Star, TrendingUp, Zap,
  ChevronRight, Sparkles, Activity, RefreshCw,
  CheckCircle2, XCircle, ArrowRight,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface HealthDashboardProps {
  projects: Project[];
  onDeepAnalyzeAll: () => void;
  isDeepAnalyzing: boolean;
  onProjectClick: (project: Project) => void;
}

// Per-project health score calculation
function computeProjectHealth(project: Project): { score: number; label: string; color: string } {
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

// Portfolio health computation with weighted factors
function computePortfolioHealth(projects: Project[]) {
  const total = projects.length;
  if (total === 0) return { score: 0, factors: {} as Record<string, number> };

  const deepAnalyzed = projects.filter(p => p.deepAnalyzedAt).length;
  const withReadme = projects.filter(p => p.readmeContent).length;
  const activeIn90Days = projects.filter(p => p.pushedAt && (Date.now() - new Date(p.pushedAt).getTime() < 90 * 24 * 60 * 60 * 1000)).length;
  const notArchived = projects.filter(p => !p.isArchived).length;
  const withStars = projects.filter(p => p.stargazersCount >= 1).length;

  const avgHealth = projects.reduce((sum, p) => sum + computeProjectHealth(p).score, 0) / total;

  const factors = {
    deepAnalysis: (deepAnalyzed / total) * 100,
    readmes: (withReadme / total) * 100,
    active90: (activeIn90Days / total) * 100,
    avgHealth: avgHealth,
    notArchived: (notArchived / total) * 100,
    starDiversity: (withStars / total) * 100,
  };

  const score = Math.round(
    factors.deepAnalysis * 0.20 +
    factors.readmes * 0.15 +
    factors.active90 * 0.25 +
    factors.avgHealth * 0.20 +
    factors.notArchived * 0.10 +
    factors.starDiversity * 0.10
  );

  return { score: Math.max(0, Math.min(100, score)), factors };
}

function getMaturityLabel(score: number): { label: string; description: string; color: string } {
  if (score >= 80) return {
    label: 'Expert',
    description: 'Excellent portfolio management! You\'re a power user.',
    color: '#10b981',
  };
  if (score >= 60) return {
    label: 'Advanced',
    description: 'Strong portfolio! Focus on documentation and cross-project consistency.',
    color: '#14b8a6',
  };
  if (score >= 30) return {
    label: 'Intermediate',
    description: 'Good foundation! Consider deep analysis for better project understanding.',
    color: '#f59e0b',
  };
  return {
    label: 'Beginner',
    description: 'Just getting started! Focus on adding READMEs and keeping repos active.',
    color: '#ef4444',
  };
}

function getScoreColor(score: number): string {
  if (score >= 70) return '#10b981';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

export function HealthDashboard({ projects, onDeepAnalyzeAll, isDeepAnalyzing, onProjectClick }: HealthDashboardProps) {
  const [animatedScore, setAnimatedScore] = useState(0);

  const { score: portfolioScore, factors } = useMemo(() => computePortfolioHealth(projects), [projects]);
  const maturity = useMemo(() => getMaturityLabel(portfolioScore), [portfolioScore]);
  const scoreColor = useMemo(() => getScoreColor(portfolioScore), [portfolioScore]);

  // Animate the score ring on mount
  useEffect(() => {
    let start = 0;
    const duration = 1200;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(eased * portfolioScore));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [portfolioScore]);

  // Recommendations
  const recommendations = useMemo(() => {
    const recs: { id: string; icon: React.ReactNode; text: string; action?: React.ReactNode; type: 'warning' | 'info' | 'success' }[] = [];

    const needsDeepAnalysis = projects.filter(p => !p.deepAnalyzedAt);
    if (needsDeepAnalysis.length > 0) {
      recs.push({
        id: 'deep-analyze',
        icon: <Microscope className="w-4 h-4 text-emerald-400" />,
        text: `${needsDeepAnalysis.length} repos need deep analysis`,
        action: (
          <Button
            size="sm"
            className="h-6 gap-1 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white"
            onClick={onDeepAnalyzeAll}
            disabled={isDeepAnalyzing}
          >
            {isDeepAnalyzing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Microscope className="w-3 h-3" />}
            Deep Analyze
          </Button>
        ),
        type: 'warning',
      });
    }

    const staleRepos = projects.filter(p => p.pushedAt && (Date.now() - new Date(p.pushedAt).getTime() > 180 * 24 * 60 * 60 * 1000) && !p.isArchived);
    if (staleRepos.length > 0) {
      recs.push({
        id: 'stale',
        icon: <Clock className="w-4 h-4 text-amber-400" />,
        text: `${staleRepos.length} repos are stale (>6 months)`,
        type: 'warning',
      });
    }

    const missingReadmes = projects.filter(p => !p.readmeContent);
    if (missingReadmes.length > 0) {
      recs.push({
        id: 'readmes',
        icon: <FileText className="w-4 h-4 text-orange-400" />,
        text: `${missingReadmes.length} repos are missing READMEs`,
        type: 'warning',
      });
    }

    const noStars = projects.filter(p => p.stargazersCount === 0);
    if (noStars.length > 0) {
      recs.push({
        id: 'no-stars',
        icon: <Star className="w-4 h-4 text-muted-foreground" />,
        text: `${noStars.length} repos have no stars`,
        type: 'info',
      });
    }

    const archivedRepos = projects.filter(p => p.isArchived);
    if (archivedRepos.length > 0) {
      recs.push({
        id: 'archived',
        icon: <Archive className="w-4 h-4 text-muted-foreground" />,
        text: `Consider archiving unused repos`,
        type: 'info',
      });
    }

    return recs;
  }, [projects, onDeepAnalyzeAll, isDeepAnalyzing]);

  // Health over time projection
  const healthProjections = useMemo(() => {
    const current = portfolioScore;
    const afterDeepAnalysis = Math.min(100, current + (factors?.deepAnalysis !== undefined ? (100 - factors.deepAnalysis) * 0.2 : 0));
    const afterReadmes = Math.min(100, afterDeepAnalysis + (factors?.readmes !== undefined ? (100 - factors.readmes) * 0.1 : 0));
    const afterActivity = Math.min(100, afterReadmes + 5);

    return [
      { label: 'Now', score: current, color: getScoreColor(current) },
      { label: 'After Deep Analysis', score: Math.round(afterDeepAnalysis), color: getScoreColor(afterDeepAnalysis) },
      { label: 'After Adding READMEs', score: Math.round(afterReadmes), color: getScoreColor(afterReadmes) },
      { label: 'After Activity Boost', score: Math.round(afterActivity), color: getScoreColor(afterActivity) },
    ];
  }, [portfolioScore, factors]);

  // Factor bars for the breakdown
  const factorBars = useMemo(() => [
    { label: 'Deep Analysis', value: factors?.deepAnalysis || 0, weight: '20%', icon: <Microscope className="w-3 h-3" /> },
    { label: 'Active (90d)', value: factors?.active90 || 0, weight: '25%', icon: <Activity className="w-3 h-3" /> },
    { label: 'Avg Health', value: factors?.avgHealth || 0, weight: '20%', icon: <Heart className="w-3 h-3" /> },
    { label: 'Has README', value: factors?.readmes || 0, weight: '15%', icon: <FileText className="w-3 h-3" /> },
    { label: 'Not Archived', value: factors?.notArchived || 0, weight: '10%', icon: <ShieldCheck className="w-3 h-3" /> },
    { label: 'Star Diversity', value: factors?.starDiversity || 0, weight: '10%', icon: <Star className="w-3 h-3" /> },
  ], [factors]);

  // Per-project health list sorted by score
  const projectHealthList = useMemo(() => {
    return projects
      .map(p => ({ project: p, health: computeProjectHealth(p) }))
      .sort((a, b) => a.health.score - b.health.score);
  }, [projects]);

  const staleRepos = useMemo(() => projects.filter(p => p.pushedAt && (Date.now() - new Date(p.pushedAt).getTime() > 180 * 24 * 60 * 60 * 1000)), [projects]);
  const missingReadmeRepos = useMemo(() => projects.filter(p => !p.readmeContent), [projects]);
  const archivedRepos = useMemo(() => projects.filter(p => p.isArchived), [projects]);
  const noStarRepos = useMemo(() => projects.filter(p => p.stargazersCount === 0), [projects]);

  const circumference = 2 * Math.PI * 70;
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference;

  return (
    <div className="h-full overflow-hidden">
      <ScrollArea className="h-full">
        <div className="p-6 space-y-6 max-w-4xl mx-auto">

          {/* === Hero: Portfolio Health Score === */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center text-center"
          >
            <h2 className="text-lg font-bold text-foreground/90 flex items-center gap-2 mb-4">
              <Heart className="w-5 h-5 text-rose-400" /> Portfolio Health Dashboard
            </h2>

            {/* Large circular health gauge */}
            <div className="relative w-48 h-48 mb-3">
              <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
                {/* Background ring */}
                <circle
                  cx="80" cy="80" r="70"
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="10"
                />
                {/* Score ring - animated */}
                <circle
                  cx="80" cy="80" r="70"
                  fill="none"
                  stroke={scoreColor}
                  strokeWidth="10"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.1s ease-out, stroke 0.5s ease-out' }}
                  opacity="0.85"
                />
                {/* Glow effect */}
                <circle
                  cx="80" cy="80" r="70"
                  fill="none"
                  stroke={scoreColor}
                  strokeWidth="2"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.1s ease-out', filter: `drop-shadow(0 0 6px ${scoreColor}60)` }}
                  opacity="0.4"
                />
              </svg>
              {/* Score number */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-black" style={{ color: scoreColor }}>
                  {animatedScore}
                </span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50 mt-0.5">
                  out of 100
                </span>
              </div>
            </div>

            {/* Maturity badge */}
            <div className="flex items-center gap-2 mt-1">
              <Badge
                variant="outline"
                className="text-sm px-3 py-1 font-bold"
                style={{ borderColor: maturity.color + '40', color: maturity.color, backgroundColor: maturity.color + '10' }}
              >
                {maturity.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground/50 mt-2 max-w-sm">{maturity.description}</p>
          </motion.div>

          {/* === Factor Breakdown === */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="bg-card/30 border border-border/15 rounded-xl p-5"
          >
            <h3 className="text-sm font-semibold text-foreground/80 mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" /> Health Factors
            </h3>
            <div className="space-y-3">
              {factorBars.map(factor => (
                <div key={factor.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-muted-foreground/60">
                      {factor.icon} {factor.label}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground/30 text-[9px]">({factor.weight} weight)</span>
                      <span className="font-bold" style={{ color: getScoreColor(factor.value) }}>
                        {Math.round(factor.value)}%
                      </span>
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-background/50 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${factor.value}%` }}
                      transition={{ delay: 0.3, duration: 0.8, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: getScoreColor(factor.value), opacity: 0.7 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* === Two Column: Recommendations + Maturity === */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Recommendations */}
            <motion.div
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25, duration: 0.4 }}
              className="bg-card/30 border border-border/15 rounded-xl p-5"
            >
              <h3 className="text-sm font-semibold text-foreground/80 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Recommendations
              </h3>
              <div className="space-y-2">
                {recommendations.map(rec => (
                  <div
                    key={rec.id}
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border ${
                      rec.type === 'warning'
                        ? 'bg-amber-500/5 border-amber-500/15'
                        : rec.type === 'success'
                        ? 'bg-emerald-500/5 border-emerald-500/15'
                        : 'bg-background/30 border-border/15'
                    }`}
                  >
                    {rec.icon}
                    <span className="text-xs text-foreground/70 flex-1">{rec.text}</span>
                    {rec.action}
                  </div>
                ))}
                {recommendations.length === 0 && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-emerald-400/80">All clear! Your portfolio is in great shape.</span>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Portfolio Maturity */}
            <motion.div
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="bg-card/30 border border-border/15 rounded-xl p-5"
            >
              <h3 className="text-sm font-semibold text-foreground/80 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" /> Portfolio Maturity
              </h3>
              <div className="space-y-2">
                {[
                  { label: 'Beginner', range: '0-30', color: '#ef4444', isCurrent: maturity.label === 'Beginner' },
                  { label: 'Intermediate', range: '30-60', color: '#f59e0b', isCurrent: maturity.label === 'Intermediate' },
                  { label: 'Advanced', range: '60-80', color: '#14b8a6', isCurrent: maturity.label === 'Advanced' },
                  { label: 'Expert', range: '80-100', color: '#10b981', isCurrent: maturity.label === 'Expert' },
                ].map(level => (
                  <div
                    key={level.label}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all ${
                      level.isCurrent
                        ? 'bg-background/40 border-border/30 shadow-sm'
                        : 'bg-background/10 border-transparent'
                    }`}
                  >
                    <div
                      className="w-2 h-8 rounded-full"
                      style={{ backgroundColor: level.color, opacity: level.isCurrent ? 1 : 0.2 }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium" style={{ color: level.isCurrent ? level.color : 'rgba(255,255,255,0.4)' }}>
                          {level.label}
                        </span>
                        <span className="text-[9px] text-muted-foreground/30">{level.range}</span>
                        {level.isCurrent && (
                          <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5" style={{ borderColor: level.color + '40', color: level.color }}>
                            Current
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground/40 mt-3 leading-relaxed">{maturity.description}</p>
            </motion.div>
          </div>

          {/* === Health Over Time Projection === */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
            className="bg-card/30 border border-border/15 rounded-xl p-5"
          >
            <h3 className="text-sm font-semibold text-foreground/80 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" /> Health Over Time
              <span className="text-[9px] text-muted-foreground/30 font-normal ml-1">Projected improvements</span>
            </h3>
            <div className="flex items-end gap-3">
              {healthProjections.map((proj, i) => (
                <div key={proj.label} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-xs font-bold" style={{ color: proj.color }}>{proj.score}</span>
                  <div className="w-full relative">
                    <div className="w-full h-32 rounded-lg bg-background/30 overflow-hidden relative">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${proj.score}%` }}
                        transition={{ delay: 0.4 + i * 0.15, duration: 0.6, ease: 'easeOut' }}
                        className="absolute bottom-0 left-0 right-0 rounded-lg"
                        style={{
                          backgroundColor: proj.color,
                          opacity: 0.5,
                        }}
                      />
                    </div>
                    {/* Connector line */}
                    {i < healthProjections.length - 1 && (
                      <div className="absolute top-1/2 -right-2 w-4 border-t border-dashed border-muted-foreground/20" />
                    )}
                  </div>
                  <span className="text-[9px] text-muted-foreground/50 text-center leading-tight">{proj.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground/30">
              <ArrowRight className="w-3 h-3" />
              <span>Each action improves your portfolio health score</span>
            </div>
          </motion.div>

          {/* === Project Health List === */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="bg-card/30 border border-border/15 rounded-xl p-5"
          >
            <h3 className="text-sm font-semibold text-foreground/80 mb-3 flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose-400" /> Project Health
              <span className="text-[9px] text-muted-foreground/30 font-normal ml-1">({projects.length} repos)</span>
            </h3>
            <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-1">
              {projectHealthList.map(({ project, health }) => (
                <button
                  key={project.id}
                  onClick={() => onProjectClick(project)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-card/40 transition-colors text-left group"
                >
                  <div className="relative w-7 h-7 shrink-0">
                    <svg viewBox="0 0 28 28" className="w-7 h-7 -rotate-90">
                      <circle cx="14" cy="14" r="11" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
                      <circle
                        cx="14" cy="14" r="11" fill="none" stroke={health.color} strokeWidth="2.5"
                        strokeDasharray={`${(health.score / 100) * 69.12} 69.12`}
                        strokeLinecap="round"
                        opacity="0.85"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[7px] font-bold" style={{ color: health.color }}>
                      {health.score}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-foreground/70 group-hover:text-foreground/90 transition-colors truncate block">{project.name}</span>
                    <span className="text-[9px] text-muted-foreground/30">{project.category || 'Uncategorized'}</span>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[8px] px-1.5 py-0 h-4 shrink-0"
                    style={{ borderColor: health.color + '30', color: health.color }}
                  >
                    {health.label}
                  </Badge>
                  <ChevronRight className="w-3 h-3 text-muted-foreground/20 group-hover:text-muted-foreground/40 transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </motion.div>

          {/* === Detail Lists for Recommendations === */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Stale repos */}
            {staleRepos.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, duration: 0.3 }}
                className="bg-card/30 border border-amber-500/10 rounded-xl p-4"
              >
                <h4 className="text-xs font-medium text-amber-400/70 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Clock className="w-3 h-3" /> Stale Repos ({staleRepos.length})
                </h4>
                <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                  {staleRepos.map(p => (
                    <button
                      key={p.id}
                      onClick={() => onProjectClick(p)}
                      className="w-full text-left px-2 py-1 rounded text-[10px] text-muted-foreground/50 hover:text-foreground/70 hover:bg-card/30 transition-colors flex items-center gap-2"
                    >
                      <span className="truncate">{p.name}</span>
                      <span className="ml-auto text-[9px] text-muted-foreground/30">
                        {p.pushedAt ? formatDistanceToNow(new Date(p.pushedAt), { addSuffix: true }) : 'Never'}
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Missing READMEs */}
            {missingReadmeRepos.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.3 }}
                className="bg-card/30 border border-orange-500/10 rounded-xl p-4"
              >
                <h4 className="text-xs font-medium text-orange-400/70 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText className="w-3 h-3" /> Missing READMEs ({missingReadmeRepos.length})
                </h4>
                <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                  {missingReadmeRepos.map(p => (
                    <button
                      key={p.id}
                      onClick={() => onProjectClick(p)}
                      className="w-full text-left px-2 py-1 rounded text-[10px] text-muted-foreground/50 hover:text-foreground/70 hover:bg-card/30 transition-colors truncate"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* No stars */}
            {noStarRepos.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55, duration: 0.3 }}
                className="bg-card/30 border border-border/10 rounded-xl p-4"
              >
                <h4 className="text-xs font-medium text-muted-foreground/50 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Star className="w-3 h-3" /> No Stars ({noStarRepos.length})
                </h4>
                <p className="text-[10px] text-muted-foreground/30 mb-2">Consider starring your best repos to boost visibility</p>
                <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                  {noStarRepos.map(p => (
                    <button
                      key={p.id}
                      onClick={() => onProjectClick(p)}
                      className="w-full text-left px-2 py-1 rounded text-[10px] text-muted-foreground/50 hover:text-foreground/70 hover:bg-card/30 transition-colors truncate"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Archived */}
            {archivedRepos.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.3 }}
                className="bg-card/30 border border-border/10 rounded-xl p-4"
              >
                <h4 className="text-xs font-medium text-muted-foreground/50 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Archive className="w-3 h-3" /> Archived ({archivedRepos.length})
                </h4>
                <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                  {archivedRepos.map(p => (
                    <button
                      key={p.id}
                      onClick={() => onProjectClick(p)}
                      className="w-full text-left px-2 py-1 rounded text-[10px] text-muted-foreground/50 hover:text-foreground/70 hover:bg-card/30 transition-colors flex items-center gap-2"
                    >
                      <Archive className="w-2.5 h-2.5 text-muted-foreground/30" />
                      <span className="truncate">{p.name}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* === Quick Actions Panel === */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="bg-card/30 border border-border/15 rounded-xl p-5"
          >
            <h3 className="text-sm font-semibold text-foreground/80 mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" /> Quick Actions
            </h3>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
                onClick={onDeepAnalyzeAll}
                disabled={isDeepAnalyzing}
              >
                {isDeepAnalyzing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Microscope className="w-3.5 h-3.5" />}
                Deep Analyze All
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                onClick={() => {
                  const stale = projects.filter(p => p.pushedAt && (Date.now() - new Date(p.pushedAt).getTime() > 180 * 24 * 60 * 60 * 1000));
                  if (stale.length > 0) onProjectClick(stale[0]);
                }}
              >
                <Clock className="w-3.5 h-3.5" /> Review Stale Repos
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                onClick={() => {
                  const missing = projects.filter(p => !p.readmeContent);
                  if (missing.length > 0) onProjectClick(missing[0]);
                }}
              >
                <FileText className="w-3.5 h-3.5" /> Add Missing READMEs
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs border-border/30 text-muted-foreground/60 hover:bg-card/40"
                onClick={() => {
                  // Find lowest health project
                  const lowest = projectHealthList[0];
                  if (lowest) onProjectClick(lowest.project);
                }}
              >
                <Heart className="w-3.5 h-3.5" /> Fix Weakest Repo
              </Button>
            </div>
          </motion.div>

        </div>
      </ScrollArea>
    </div>
  );
}
