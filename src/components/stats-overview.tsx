'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { useAtlasStore } from '@/lib/store';
import { CATEGORY_COLORS, LANGUAGE_COLORS, Project } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip,
  LineChart, Line, CartesianGrid,
} from 'recharts';
import {
  Star, GitFork, GitCommit, Activity,
  FolderOpen, ShieldCheck, AlertTriangle, Clock,
} from 'lucide-react';
import { motion } from 'framer-motion';

// --- AnimatedCounter: counts from 0 to target on mount ---
function AnimatedCounter({ target, duration = 1000 }: { target: number; duration?: number }) {
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

interface StatsOverviewProps {
  projects: Project[];
}

export function StatsOverview({ projects }: StatsOverviewProps) {
  const totalStars = useMemo(() => projects.reduce((s, p) => s + p.stargazersCount, 0), [projects]);
  const totalForks = useMemo(() => projects.reduce((s, p) => s + p.forksCount, 0), [projects]);
  const deepAnalyzedCount = useMemo(() => projects.filter(p => p.deepAnalyzedAt).length, [projects]);
  const recentlyActive = useMemo(() =>
    projects.filter(p => p.pushedAt && (Date.now() - new Date(p.pushedAt).getTime() < 30 * 24 * 60 * 60 * 1000)).length,
    [projects]
  );

  // Language distribution
  const langData = useMemo(() => {
    const map = new Map<string, number>();
    projects.forEach(p => { if (p.language) map.set(p.language, (map.get(p.language) || 0) + 1); });
    const total = projects.length;
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({
        name,
        value,
        pct: Math.round((value / total) * 100),
        color: LANGUAGE_COLORS[name] || '#8b8b8b',
      }));
  }, [projects]);

  // Category distribution
  const catData = useMemo(() => {
    const map = new Map<string, number>();
    projects.forEach(p => { if (p.category) map.set(p.category, (map.get(p.category) || 0) + 1); });
    const total = projects.length;
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
        pct: Math.round((value / total) * 100),
        color: CATEGORY_COLORS[name] || '#64748b',
      }));
  }, [projects]);

  // Framework popularity — with colors
  const frameworkData = useMemo(() => {
    const map = new Map<string, number>();
    projects.forEach(p => {
      if (p.codeSignature?.frameworks) {
        p.codeSignature.frameworks.forEach(fw => {
          map.set(fw, (map.get(fw) || 0) + 1);
        });
      }
    });
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count, color: getFwColor(name) }));
  }, [projects]);

  // Activity timeline (commits per month — from pushedAt)
  const activityTimeline = useMemo(() => {
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

  // Shared dependencies
  const sharedDeps = useMemo(() => {
    const depMap = new Map<string, number>();
    projects.forEach(p => {
      if (p.dependencies) {
        const all = [...(p.dependencies.runtime || []), ...(p.dependencies.dev || [])];
        const unique = new Set(all);
        unique.forEach(dep => {
          depMap.set(dep, (depMap.get(dep) || 0) + 1);
        });
      }
    });
    return [...depMap.entries()]
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([name, count]) => ({ name, count }));
  }, [projects]);

  // Health distribution
  const healthData = useMemo(() => {
    let healthy = 0, moderate = 0, stale = 0;
    projects.forEach(p => {
      if (p.isArchived) { stale++; return; }
      if (!p.pushedAt) { stale++; return; }
      const days = (Date.now() - new Date(p.pushedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (days < 30 && p.openIssuesCount < 10) healthy++;
      else if (days < 180) moderate++;
      else stale++;
    });
    return [
      { name: 'Healthy', value: healthy, color: '#10b981' },
      { name: 'Moderate', value: moderate, color: '#f59e0b' },
      { name: 'Stale', value: stale, color: '#ef4444' },
    ];
  }, [projects]);

  // Overall health score for ring chart center
  const overallHealthScore = useMemo(() => {
    const h = healthData[0].value;
    const m = healthData[1].value;
    const s = healthData[2].value;
    const total = h + m + s;
    if (total === 0) return 0;
    return Math.round(((h * 100 + m * 50 + s * 10) / (total * 100)) * 100);
  }, [healthData]);

  const tooltipStyle = {
    contentStyle: { background: 'rgba(20,20,20,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 11 },
    itemStyle: { color: '#e2e8f0' },
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-4">
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Portfolio Overview Cards — with gradient backgrounds */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <GradientStatCard
            icon={<FolderOpen className="w-5 h-5 text-emerald-400" />}
            title="Total Repos"
            value={projects.length}
            subtitle={`${deepAnalyzedCount} deep analyzed`}
            trend={deepAnalyzedCount > 0 ? 'up' : undefined}
            gradientFrom="rgba(16,185,129,0.08)"
            gradientTo="rgba(16,185,129,0.02)"
            borderColor="rgba(16,185,129,0.15)"
          />
          <GradientStatCard
            icon={<Star className="w-5 h-5 text-amber-400" />}
            title="Total Stars"
            value={totalStars}
            subtitle="Across all repos"
            gradientFrom="rgba(245,158,11,0.08)"
            gradientTo="rgba(245,158,11,0.02)"
            borderColor="rgba(245,158,11,0.15)"
          />
          <GradientStatCard
            icon={<GitCommit className="w-5 h-5 text-emerald-400" />}
            title="Active (30d)"
            value={recentlyActive}
            subtitle={`${Math.round((recentlyActive / Math.max(projects.length, 1)) * 100)}% of repos`}
            trend={recentlyActive > projects.length / 3 ? 'up' : 'down'}
            gradientFrom="rgba(16,185,129,0.08)"
            gradientTo="rgba(16,185,129,0.02)"
            borderColor="rgba(16,185,129,0.15)"
          />
          <GradientStatCard
            icon={<GitFork className="w-5 h-5 text-blue-400" />}
            title="Total Forks"
            value={totalForks}
            subtitle="Community interest"
            gradientFrom="rgba(59,130,246,0.08)"
            gradientTo="rgba(59,130,246,0.02)"
            borderColor="rgba(59,130,246,0.15)"
          />
        </div>

        {/* Charts row: Language + Category */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Language Distribution */}
          <Card className="bg-card/50 border-border/15">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">
                Language Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={langData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {langData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} fillOpacity={0.7} />
                      ))}
                    </Pie>
                    <Tooltip
                      {...tooltipStyle}
                      formatter={(value: number, name: string) => [`${value} repos (${langData.find(l => l.name === name)?.pct}%)`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                {langData.map(l => (
                  <div key={l.name} className="flex items-center gap-1.5 text-[10px]">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                    <span className="text-foreground/60">{l.name}</span>
                    <span className="text-muted-foreground/40">{l.pct}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Category Distribution — with rounded bar tops and gradient fill */}
          <Card className="bg-card/50 border-border/15">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">
                Category Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={catData} layout="vertical" margin={{ left: 10, right: 10, top: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      {...tooltipStyle}
                      formatter={(value: number) => [`${value} repos`]}
                    />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={14}>
                      {catData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} fillOpacity={0.6} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                {catData.map(c => (
                  <div key={c.name} className="flex items-center gap-1.5 text-[10px]">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="text-foreground/60">{c.name}</span>
                    <span className="text-muted-foreground/40">{c.value} ({c.pct}%)</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts row: Framework Popularity + Activity Timeline */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Framework Popularity — with colored icon boxes */}
          <Card className="bg-card/50 border-border/15">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">
                Framework Popularity
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {frameworkData.length > 0 ? (
                <div className="space-y-2 max-h-52">
                  {/* Custom bar chart with framework icons */}
                  {frameworkData.map((fw, i) => (
                    <motion.div
                      key={fw.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-2"
                    >
                      <div
                        className="w-6 h-6 rounded flex items-center justify-center text-[9px] font-bold shrink-0"
                        style={{ backgroundColor: fw.color + '20', color: fw.color }}
                      >
                        {fw.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[11px] text-foreground/70 truncate">{fw.name}</span>
                          <span className="text-[10px] text-muted-foreground/40 shrink-0 ml-2">{fw.count} repos</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-card/50 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(fw.count / Math.max(frameworkData[0]?.count || 1, 1)) * 100}%` }}
                            transition={{ delay: i * 0.05 + 0.2, duration: 0.6, ease: 'easeOut' }}
                            className="h-full rounded-full"
                            style={{
                              background: `linear-gradient(90deg, ${fw.color}60, ${fw.color}30)`,
                            }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="h-44 flex items-center justify-center text-xs text-muted-foreground/40">
                  No framework data — run Deep Analysis first
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity Timeline — with gradient area */}
          <Card className="bg-card/50 border-border/15">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">
                Activity Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={activityTimeline} margin={{ left: 0, right: 0, top: 5, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="month" tick={{ fontSize: 8, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip {...tooltipStyle} />
                    <defs>
                      <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ fill: '#10b981', r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: '#10b981', strokeWidth: 2, stroke: '#10b98140' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts row: Shared Dependencies + Health Distribution */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Shared Dependencies — with alternating rows and hover */}
          <Card className="bg-card/50 border-border/15">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">
                Most Shared Dependencies
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {sharedDeps.length > 0 ? (
                <div className="space-y-0 max-h-52 overflow-y-auto custom-scrollbar">
                  {sharedDeps.map((dep, i) => (
                    <motion.div
                      key={dep.name}
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className={`flex items-center gap-2 py-1.5 px-2 rounded-md transition-colors ${
                        i % 2 === 0 ? 'bg-card/20' : ''
                      } hover:bg-emerald-500/5`}
                    >
                      <span className="text-[10px] text-muted-foreground/40 w-4 text-right font-mono">{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[11px] text-foreground/70 truncate font-medium">{dep.name}</span>
                          <span className="text-[10px] text-emerald-400/60 shrink-0 ml-2 font-medium">{dep.count} repos</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-card/50 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(dep.count / projects.length) * 100}%` }}
                            transition={{ delay: i * 0.03 + 0.2, duration: 0.6, ease: 'easeOut' }}
                            className="h-full rounded-full"
                            style={{
                              background: 'linear-gradient(90deg, rgba(16,185,129,0.5), rgba(16,185,129,0.2))',
                            }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="h-32 flex items-center justify-center text-xs text-muted-foreground/40">
                  No dependency data — run Deep Analysis first
                </div>
              )}
            </CardContent>
          </Card>

          {/* Health Distribution — animated ring chart with central score */}
          <Card className="bg-card/50 border-border/15">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">
                Health Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="flex items-center gap-6">
                {/* Animated ring chart */}
                <div className="h-40 w-40 shrink-0 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={healthData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={60}
                        paddingAngle={4}
                        dataKey="value"
                        stroke="none"
                        animationBegin={0}
                        animationDuration={800}
                      >
                        {healthData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} fillOpacity={0.7} />
                        ))}
                      </Pie>
                      <Tooltip {...tooltipStyle} formatter={(value: number) => [`${value} repos`]} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Central score number */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-foreground/80">
                        <AnimatedCounter target={overallHealthScore} />
                      </p>
                      <p className="text-[8px] text-muted-foreground/40 uppercase tracking-wider">Health</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3 flex-1">
                  {healthData.map(h => (
                    <div key={h.name} className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: h.color, opacity: 0.7, boxShadow: `0 0 6px ${h.color}40` }}
                      />
                      <span className="text-xs text-foreground/70 flex-1">{h.name}</span>
                      <span className="text-sm font-bold text-foreground/80">{h.value}</span>
                      <span className="text-[10px] text-muted-foreground/40">
                        {Math.round((h.value / Math.max(projects.length, 1)) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// --- Gradient Stat Card with animated counter ---
function GradientStatCard({
  icon,
  title,
  value,
  subtitle,
  trend,
  gradientFrom,
  gradientTo,
  borderColor,
}: {
  icon: React.ReactNode;
  title: string;
  value: number;
  subtitle: string;
  trend?: 'up' | 'down';
  gradientFrom: string;
  gradientTo: string;
  borderColor: string;
}) {
  return (
    <Card
      className="border overflow-hidden"
      style={{
        borderColor,
        background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-md" style={{ backgroundColor: borderColor }}>{icon}</div>
          <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">{title}</span>
          {trend === 'up' && (
            <span className="text-[9px] text-emerald-400 flex items-center gap-0.5 ml-auto">
              <Activity className="w-2.5 h-2.5" /> Active
            </span>
          )}
          {trend === 'down' && (
            <span className="text-[9px] text-muted-foreground/40 flex items-center gap-0.5 ml-auto">
              <Clock className="w-2.5 h-2.5" /> Low
            </span>
          )}
        </div>
        <p className="text-2xl font-bold text-foreground/90">
          <AnimatedCounter target={value} />
        </p>
        <p className="text-[10px] text-muted-foreground/40 mt-0.5">{subtitle}</p>
      </CardContent>
    </Card>
  );
}
