'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Network, LayoutGrid, Calendar, BarChart3, Share2,
  Microscope, FileText, Zap, GitCompare, Download, Building2,
  ChevronRight, Clock, Tag, ArrowUp, ArrowDown, CornerDownLeft, XCircle,
  Target, Bookmark, GitBranch, Sparkles,
} from 'lucide-react';
import { Project, ViewMode, CATEGORY_COLORS } from '@/lib/types';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';

// --- Types ---

interface CommandItem {
  id: string;
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  group: 'navigate' | 'projects' | 'actions' | 'filters';
  shortcut?: string;
  action: () => void;
  keywords?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  projects: Project[];
  currentView: ViewMode;
  onNavigate: (view: ViewMode) => void;
  onProjectSelect: (project: Project) => void;
  onSmartSearch: () => void;
  onDeepAnalyze: () => void;
  onRewriteReadmes: () => void;
  onCompare: () => void;
  onExport: () => void;
  onOrgRepos: () => void;
  onAIRecommendations: () => void;
  onToggleTag: (tag: string) => void;
  tags: [string, number][];
  activeTags: string[];
}

const STORAGE_KEY = 'git-atlas-command-recent';

// --- Fuzzy match helper ---
function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  // Direct substring match
  if (t.includes(q)) return true;
  // Fuzzy: each char in query must appear in order
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

function getRecentItems(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addRecentItem(id: string) {
  try {
    const recent = getRecentItems().filter(r => r !== id);
    recent.unshift(id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recent.slice(0, 20)));
  } catch { /* ignore */ }
}

// --- Group config ---
const GROUP_CONFIG: Record<string, { label: string; order: number }> = {
  navigate: { label: 'Navigate', order: 0 },
  projects: { label: 'Projects', order: 1 },
  actions: { label: 'Actions', order: 2 },
  filters: { label: 'Filters', order: 3 },
};

export function CommandPalette({
  open,
  onClose,
  projects,
  currentView,
  onNavigate,
  onProjectSelect,
  onSmartSearch,
  onDeepAnalyze,
  onRewriteReadmes,
  onCompare,
  onExport,
  onOrgRepos,
  onAIRecommendations,
  onToggleTag,
  tags,
  activeTags,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const recentItems = useMemo(() => getRecentItems(), [open]); // re-read on open

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      // Focus input after animation
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Build command items
  const commandItems = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [];

    // --- Navigate group ---
    const views: { mode: ViewMode; label: string; icon: React.ReactNode; shortcut: string }[] = [
      { mode: 'graph', label: 'Graph View', icon: <Network className="w-4 h-4" />, shortcut: '⌘1' },
      { mode: 'grid', label: 'Grid View', icon: <LayoutGrid className="w-4 h-4" />, shortcut: '⌘2' },
      { mode: 'timeline', label: 'Timeline View', icon: <Calendar className="w-4 h-4" />, shortcut: '⌘3' },
      { mode: 'stats', label: 'Stats Overview', icon: <BarChart3 className="w-4 h-4" />, shortcut: '⌘4' },
      { mode: 'network', label: 'Dependency Network', icon: <Share2 className="w-4 h-4" />, shortcut: '⌘5' },
      { mode: 'radar', label: 'Tech Radar', icon: <Target className="w-4 h-4" />, shortcut: '⌘6' },
      { mode: 'bookmarks', label: 'Bookmarks', icon: <Bookmark className="w-4 h-4" />, shortcut: '⌘7' },
      { mode: 'relationships', label: 'Relationship Map', icon: <GitBranch className="w-4 h-4" />, shortcut: '⌘8' },
    ];

    views.forEach(v => {
      items.push({
        id: `nav-${v.mode}`,
        label: v.label,
        sublabel: v.mode === currentView ? 'Current view' : undefined,
        icon: v.icon,
        group: 'navigate',
        shortcut: v.shortcut,
        action: () => { onNavigate(v.mode); onClose(); },
        keywords: `view navigate ${v.mode}`,
      });
    });

    // --- Projects group ---
    projects.forEach(p => {
      const categoryColor = p.category ? CATEGORY_COLORS[p.category] || '#64748b' : '#64748b';
      items.push({
        id: `project-${p.id}`,
        label: p.name,
        sublabel: [p.language, p.category].filter(Boolean).join(' · ') || undefined,
        icon: (
          <span
            className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold"
            style={{ backgroundColor: categoryColor + '30', color: categoryColor }}
          >
            {p.name.charAt(0).toUpperCase()}
          </span>
        ),
        group: 'projects',
        action: () => { onProjectSelect(p); addRecentItem(`project-${p.id}`); onClose(); },
        keywords: `${p.name} ${p.fullName} ${p.language || ''} ${p.description || ''} ${(p.tags || []).join(' ')} ${(p.topics || []).join(' ')} ${(p.codeSignature?.frameworks || []).join(' ')}`,
      });
    });

    // --- Actions group ---
    const actions: { id: string; label: string; icon: React.ReactNode; shortcut?: string; action: () => void }[] = [
      {
        id: 'action-deep-analyze',
        label: 'Deep Analyze All',
        icon: <Microscope className="w-4 h-4 text-emerald-400" />,
        action: () => { onDeepAnalyze(); onClose(); },
      },
      {
        id: 'action-rewrite-readmes',
        label: 'Rewrite All READMEs',
        icon: <FileText className="w-4 h-4 text-violet-400" />,
        action: () => { onRewriteReadmes(); onClose(); },
      },
      {
        id: 'action-smart-search',
        label: 'Smart Search — "Do I have...?"',
        icon: <Zap className="w-4 h-4 text-amber-400" />,
        shortcut: '/',
        action: () => { onSmartSearch(); onClose(); },
      },
      {
        id: 'action-compare',
        label: 'Compare Projects',
        icon: <GitCompare className="w-4 h-4 text-cyan-400" />,
        action: () => { onCompare(); onClose(); },
      },
      {
        id: 'action-export',
        label: 'Export Portfolio',
        icon: <Download className="w-4 h-4 text-emerald-400" />,
        action: () => { onExport(); onClose(); },
      },
      {
        id: 'action-org-repos',
        label: 'Load Org Repos',
        icon: <Building2 className="w-4 h-4 text-orange-400" />,
        action: () => { onOrgRepos(); onClose(); },
      },
      {
        id: 'action-ai-recommendations',
        label: 'AI Recommendations',
        icon: <Sparkles className="w-4 h-4 text-amber-400" />,
        action: () => { onAIRecommendations(); onClose(); },
        keywords: 'ai recommend suggest llm gap',
      },
    ];

    actions.forEach(a => {
      items.push({
        id: a.id,
        label: a.label,
        icon: a.icon,
        group: 'actions',
        shortcut: a.shortcut,
        action: a.action,
      });
    });

    // --- Filters group ---
    tags.forEach(([tag, count]) => {
      const isActive = activeTags.includes(tag);
      items.push({
        id: `filter-${tag}`,
        label: tag,
        sublabel: `${count} project${count !== 1 ? 's' : ''}${isActive ? ' — active' : ''}`,
        icon: <Tag className="w-4 h-4" />,
        group: 'filters',
        action: () => { onToggleTag(tag); onClose(); },
        keywords: `tag filter ${tag}`,
      });
    });

    return items;
  }, [projects, currentView, activeTags, tags, onNavigate, onProjectSelect, onSmartSearch, onDeepAnalyze, onRewriteReadmes, onCompare, onExport, onOrgRepos, onAIRecommendations, onToggleTag, onClose]);

  // Filter items by query with fuzzy matching
  const filteredItems = useMemo(() => {
    if (!query.trim()) return commandItems;
    return commandItems.filter(item => {
      const searchText = [item.label, item.sublabel || '', item.keywords || ''].join(' ');
      return fuzzyMatch(query, searchText);
    });
  }, [query, commandItems]);

  // Sort: recent items first when no query
  const sortedItems = useMemo(() => {
    if (!query.trim()) {
      const recent = recentItems;
      return [...filteredItems].sort((a, b) => {
        const aIdx = recent.indexOf(a.id);
        const bIdx = recent.indexOf(b.id);
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        if (aIdx !== -1) return -1;
        if (bIdx !== -1) return 1;
        return 0;
      });
    }
    return filteredItems;
  }, [query, filteredItems, recentItems]);

  // Group items
  const groupedItems = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    sortedItems.forEach(item => {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push(item);
    });
    // Sort groups by order
    return Object.entries(groups)
      .sort(([a], [b]) => (GROUP_CONFIG[a]?.order ?? 99) - (GROUP_CONFIG[b]?.order ?? 99))
      .map(([key, items]) => ({
        key,
        label: GROUP_CONFIG[key]?.label || key,
        items,
      }));
  }, [sortedItems]);

  // Reset selected index when filtered items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.querySelector('[data-selected="true"]');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Execute selected item
  const executeSelected = useCallback(() => {
    if (sortedItems[selectedIndex]) {
      addRecentItem(sortedItems[selectedIndex].id);
      sortedItems[selectedIndex].action();
    }
  }, [sortedItems, selectedIndex]);

  // Keyboard handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, sortedItems.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        executeSelected();
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [sortedItems, executeSelected, onClose]);

  // Compute flat index to group mapping
  const itemIndexToGroup = useMemo(() => {
    let idx = 0;
    const map: Map<number, { groupKey: string; groupLabel: string; isFirstInGroup: boolean }> = new Map();
    groupedItems.forEach(group => {
      group.items.forEach((_, i) => {
        map.set(idx, { groupKey: group.key, groupLabel: group.label, isFirstInGroup: i === 0 });
        idx++;
      });
    });
    return map;
  }, [groupedItems]);

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-xl bg-card/95 backdrop-blur-xl border border-border/30 rounded-xl shadow-2xl shadow-black/40 overflow-hidden"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/20">
              <Search className="w-5 h-5 text-muted-foreground/40 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a command or search..."
                className="flex-1 bg-transparent text-base text-foreground/90 placeholder:text-muted-foreground/30 outline-none"
                aria-label="Search commands"
                autoComplete="off"
                spellCheck={false}
              />
              <div className="flex items-center gap-1 shrink-0">
                <kbd className="px-1.5 py-0.5 rounded bg-background/50 border border-border/20 text-muted-foreground/30 text-[10px] font-mono">
                  Esc
                </kbd>
              </div>
            </div>

            {/* Results */}
            <div
              ref={listRef}
              className="max-h-80 overflow-y-auto overscroll-contain"
              role="listbox"
              aria-label="Command results"
            >
              {sortedItems.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-muted-foreground/40">No results found</p>
                  <p className="text-xs text-muted-foreground/20 mt-1">Try a different search term</p>
                </div>
              ) : (
                (() => {
                  let flatIndex = 0;
                  return groupedItems.map(group => (
                    <div key={group.key}>
                      {/* Group header */}
                      <div className="px-4 py-1.5 sticky top-0 bg-card/95 backdrop-blur-xl z-10">
                        <h3 className="text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider">
                          {group.label}
                        </h3>
                      </div>

                      {/* Group items */}
                      {group.items.map(item => {
                        const isSelected = flatIndex === selectedIndex;
                        const currentFlatIndex = flatIndex;
                        flatIndex++;

                        return (
                          <motion.div
                            key={item.id}
                            data-selected={isSelected}
                            role="option"
                            aria-selected={isSelected}
                            className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-emerald-500/10 text-foreground'
                                : 'text-foreground/70 hover:bg-card/40'
                            }`}
                            onClick={() => {
                              addRecentItem(item.id);
                              item.action();
                            }}
                            onMouseEnter={() => setSelectedIndex(currentFlatIndex)}
                          >
                            {/* Icon */}
                            <span className={`shrink-0 ${isSelected ? 'text-emerald-400' : 'text-muted-foreground/50'}`}>
                              {item.icon}
                            </span>

                            {/* Label + sublabel */}
                            <div className="flex-1 min-w-0">
                              <div className={`text-sm truncate ${isSelected ? 'font-medium' : ''}`}>
                                {highlightMatch(item.label, query)}
                              </div>
                              {item.sublabel && (
                                <div className="text-[11px] text-muted-foreground/40 truncate">
                                  {item.sublabel}
                                </div>
                              )}
                            </div>

                            {/* Shortcut */}
                            {item.shortcut && (
                              <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0 ${
                                isSelected
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-background/50 text-muted-foreground/30 border border-border/20'
                              }`}>
                                {item.shortcut}
                              </kbd>
                            )}

                            {/* Recent indicator */}
                            {recentItems.includes(item.id) && !query.trim() && !item.shortcut && (
                              <Clock className="w-3 h-3 text-muted-foreground/20 shrink-0" />
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  ));
                })()
              )}
            </div>

            {/* Footer hint */}
            <div className="px-4 py-2 border-t border-border/10 flex items-center gap-4 text-[10px] text-muted-foreground/25">
              <span className="flex items-center gap-1">
                <ArrowUp className="w-2.5 h-2.5" />
                <ArrowDown className="w-2.5 h-2.5" />
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <CornerDownLeft className="w-2.5 h-2.5" />
                Select
              </span>
              <span className="flex items-center gap-1">
                <XCircle className="w-2.5 h-2.5" />
                Close
              </span>
              <span className="ml-auto">
                {sortedItems.length} result{sortedItems.length !== 1 ? 's' : ''}
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// --- Highlight matching text ---
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // Find the best match position
  const idx = lowerText.indexOf(lowerQuery);
  if (idx === -1) {
    // For fuzzy match, just return the text without highlighting
    return text;
  }

  return (
    <>
      {text.slice(0, idx)}
      <span className="text-emerald-400 font-medium">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}
