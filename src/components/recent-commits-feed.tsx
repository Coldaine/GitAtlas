'use client';

import { CATEGORY_COLORS, LANGUAGE_COLORS } from '@/lib/types';
import { motion } from 'framer-motion';
import {
  GitCommit, Clock, ExternalLink, RefreshCw, AlertTriangle,
  ChevronDown,
} from 'lucide-react';
import { useState, useEffect, useCallback, useMemo } from 'react';

interface CommitData {
  sha: string;
  message: string;
  author: string;
  date: string;
  repo: string;
  repoFullName: string;
  url: string;
}

interface RecentCommitsFeedProps {
  username: string;
  projects: { name: string; language: string | null; category: string | null }[];
}

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

function getDateGroup(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const commitDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (commitDay.getTime() >= today.getTime()) return 'Today';
  if (commitDay.getTime() >= yesterday.getTime()) return 'Yesterday';
  if (commitDay.getTime() >= weekAgo.getTime()) return 'Earlier this week';
  return 'Older';
}

function truncateMessage(msg: string, maxLen: number = 60): string {
  if (msg.length <= maxLen) return msg;
  return msg.substring(0, maxLen - 1) + '…';
}

export function RecentCommitsFeed({ username, projects }: RecentCommitsFeedProps) {
  const [commits, setCommits] = useState<CommitData[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterRepo, setFilterRepo] = useState<string | null>(null);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const fetchCommits = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/github/recent-commits?username=${username}&limit=30`);
      if (!res.ok) {
        throw new Error(`Failed to fetch commits: ${res.status}`);
      }
      const data = await res.json();
      setCommits(data.commits || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to load commits');
    } finally {
      setIsLoading(false);
    }
  }, [username]);

  // Initial fetch + 10-minute refresh
  useEffect(() => {
    fetchCommits();
    const interval = setInterval(fetchCommits, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchCommits]);

  // Build repo lookup for language/category
  const repoMeta = useMemo(() => {
    const map = new Map<string, { language: string | null; category: string | null }>();
    projects.forEach(p => {
      map.set(p.name, { language: p.language, category: p.category });
    });
    return map;
  }, [projects]);

  // Unique repos for filter dropdown
  const uniqueRepos = useMemo(() => {
    const repoSet = new Set<string>();
    commits.forEach(c => repoSet.add(c.repo));
    return [...repoSet].sort();
  }, [commits]);

  // Filtered commits
  const filteredCommits = useMemo(() => {
    if (!filterRepo) return commits;
    return commits.filter(c => c.repo === filterRepo);
  }, [commits, filterRepo]);

  // Group by date
  const groupedCommits = useMemo(() => {
    const groups = new Map<string, CommitData[]>();
    filteredCommits.forEach(c => {
      const group = getDateGroup(new Date(c.date));
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(c);
    });
    return groups;
  }, [filteredCommits]);

  const dateGroupOrder = ['Today', 'Yesterday', 'Earlier this week', 'Older'];

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="p-2 space-y-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <GitCommit className="w-3 h-3 text-emerald-400/60" />
            <span className="text-[10px] text-muted-foreground/40">Loading commits...</span>
          </div>
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="p-2 rounded-md bg-card/20 animate-pulse">
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-muted/20 mt-1 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-2.5 bg-muted/15 rounded w-3/4" />
                <div className="h-2 bg-muted/10 rounded w-1/2" />
                <div className="flex gap-2">
                  <div className="h-2 bg-muted/10 rounded w-12" />
                  <div className="h-2 bg-muted/10 rounded w-16" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-3 text-center">
        <AlertTriangle className="w-4 h-4 text-orange-400/60 mx-auto mb-2" />
        <p className="text-[10px] text-muted-foreground/40 mb-2">{error}</p>
        <button
          onClick={fetchCommits}
          className="inline-flex items-center gap-1 text-[10px] text-emerald-400/60 hover:text-emerald-400 transition-colors"
        >
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with count + filter */}
      <div className="px-2 pt-1 pb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <GitCommit className="w-3 h-3 text-emerald-400/60" />
          <span className="text-[10px] text-muted-foreground/40">
            {total} commits
          </span>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className="flex items-center gap-1 text-[9px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors px-1.5 py-0.5 rounded hover:bg-card/30"
          >
            {filterRepo || 'All repos'}
            <ChevronDown className="w-2.5 h-2.5" />
          </button>
          {showFilterDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowFilterDropdown(false)} />
              <div className="absolute right-0 top-full mt-1 bg-card/95 backdrop-blur-xl border border-border/20 rounded-md shadow-xl z-50 py-1 max-h-48 overflow-y-auto min-w-[140px]">
                <button
                  onClick={() => { setFilterRepo(null); setShowFilterDropdown(false); }}
                  className={`w-full text-left px-3 py-1 text-[10px] hover:bg-emerald-500/10 transition-colors ${!filterRepo ? 'text-emerald-400' : 'text-foreground/60'}`}
                >
                  All repos
                </button>
                {uniqueRepos.map(repo => (
                  <button
                    key={repo}
                    onClick={() => { setFilterRepo(repo); setShowFilterDropdown(false); }}
                    className={`w-full text-left px-3 py-1 text-[10px] hover:bg-emerald-500/10 transition-colors ${filterRepo === repo ? 'text-emerald-400' : 'text-foreground/60'}`}
                  >
                    {repo}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Commit feed */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="px-1 space-y-0.5">
          {dateGroupOrder.map(group => {
            const groupCommits = groupedCommits.get(group);
            if (!groupCommits || groupCommits.length === 0) return null;

            return (
              <div key={group}>
                <div className="sticky top-0 z-10 px-2 py-1">
                  <span className="text-[9px] font-medium text-muted-foreground/30 uppercase tracking-wider">
                    {group}
                  </span>
                </div>
                {groupCommits.map((c, i) => {
                  const meta = repoMeta.get(c.repo);
                  const catColor = meta?.category ? (CATEGORY_COLORS[meta.category] || '#64748b') : '#64748b';
                  const langColor = meta?.language ? (LANGUAGE_COLORS[meta.language] || '#8b8b8b') : '#8b8b8b';

                  return (
                    <motion.a
                      key={`${c.sha}-${c.repo}`}
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="block p-1.5 rounded-md hover:bg-card/40 transition-all group border-l-2 feed-item-hover"
                      style={{ borderLeftColor: catColor + '50' }}
                    >
                      <div className="flex items-start gap-1.5">
                        {/* Category + language dot */}
                        <div className="mt-1 flex flex-col items-center gap-0.5 shrink-0">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: catColor }} />
                          {meta?.language && (
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: langColor, opacity: 0.6 }} />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Commit message */}
                          <p className="text-[10px] text-foreground/70 leading-tight group-hover:text-foreground transition-colors">
                            {truncateMessage(c.message)}
                          </p>

                          {/* Repo + time + SHA */}
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-[9px] text-muted-foreground/40 font-medium">
                              {c.repo}
                            </span>
                            <span className="text-[9px] text-muted-foreground/25 flex items-center gap-0.5">
                              <Clock className="w-2 h-2" />
                              {formatRelativeTime(new Date(c.date))}
                            </span>
                            <span className="text-[8px] font-mono text-muted-foreground/20 bg-muted/10 px-1 py-px rounded">
                              {c.sha}
                            </span>
                          </div>
                        </div>

                        {/* External link icon */}
                        <ExternalLink className="w-2.5 h-2.5 text-muted-foreground/15 group-hover:text-foreground/30 transition-colors mt-1 shrink-0" />
                      </div>
                    </motion.a>
                  );
                })}
              </div>
            );
          })}

          {filteredCommits.length === 0 && (
            <div className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground/30">
                {filterRepo ? `No commits found for ${filterRepo}` : 'No recent commits found'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
