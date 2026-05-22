'use client';

import { useAtlasStore } from '@/lib/store';
import { CATEGORY_COLORS, LANGUAGE_COLORS, ColorBy } from '@/lib/types';
import { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface GraphLegendProps {
  className?: string;
}

export function GraphLegend({ className }: GraphLegendProps) {
  const { colorBy, nodeSizeBy } = useAtlasStore();
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<'size' | 'color' | 'edges' | 'icons' | 'badges'>('size');

  const sections = [
    { id: 'size' as const, label: 'Node Sizes' },
    { id: 'color' as const, label: 'Node Colors' },
    { id: 'edges' as const, label: 'Connections' },
    { id: 'icons' as const, label: 'Category Icons' },
    { id: 'badges' as const, label: 'Special Badges' },
  ];

  return (
    <div className={`absolute bottom-3 left-3 z-20 ${className || ''}`}>
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-card/80 backdrop-blur-sm border border-border/20 text-[10px] text-muted-foreground/60 hover:text-foreground/80 hover:border-border/40 transition-all"
      >
        <Info className="w-3 h-3" />
        Legend
        {isOpen ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronUp className="w-2.5 h-2.5" />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="mt-1.5 w-56 rounded-lg bg-card/90 backdrop-blur-xl border border-border/25 shadow-xl p-3 space-y-3"
          >
            {/* Section tabs */}
            <div className="flex flex-wrap gap-1">
              {sections.map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={`px-1.5 py-0.5 rounded text-[9px] transition-all ${
                    activeSection === s.id
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                      : 'text-muted-foreground/40 hover:text-foreground/60 border border-transparent'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Size legend */}
            {activeSection === 'size' && (
              <div className="space-y-2">
                <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider">
                  Sized by: {nodeSizeBy === 'default' ? 'Stars + Activity' : nodeSizeBy}
                </p>
                <div className="flex items-end gap-3 justify-center py-2">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-emerald-500/40 border border-emerald-500/20" />
                    <span className="text-[8px] text-muted-foreground/40">0★</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/50 border border-emerald-500/30" />
                    <span className="text-[8px] text-muted-foreground/40">3★</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/60 border border-emerald-500/40" />
                    <span className="text-[8px] text-muted-foreground/40">10★</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-11 h-11 rounded-full bg-emerald-500/70 border border-emerald-500/50" />
                    <span className="text-[8px] text-muted-foreground/40">25★</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[9px] text-muted-foreground/50">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Pushed in last 7 days (+size boost)
                  </div>
                  {nodeSizeBy === 'dependencies' && (
                    <div className="flex items-center gap-2 text-[9px] text-muted-foreground/50">
                      <div className="w-2 h-2 rounded-full bg-blue-400" />
                      More dependencies = larger
                    </div>
                  )}
                  {nodeSizeBy === 'files' && (
                    <div className="flex items-center gap-2 text-[9px] text-muted-foreground/50">
                      <div className="w-2 h-2 rounded-full bg-violet-400" />
                      More files = larger
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Color legend */}
            {activeSection === 'color' && (
              <div className="space-y-2">
                <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider">
                  Colored by: {colorBy}
                </p>

                {colorBy === 'category' && (
                  <div className="space-y-1">
                    {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
                      <div key={cat} className="flex items-center gap-2 text-[9px]">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color, opacity: 0.7 }} />
                        <span className="text-foreground/60 capitalize">{cat}</span>
                      </div>
                    ))}
                  </div>
                )}

                {colorBy === 'language' && (
                  <div className="space-y-1">
                    {Object.entries(LANGUAGE_COLORS).slice(0, 8).map(([lang, color]) => (
                      <div key={lang} className="flex items-center gap-2 text-[9px]">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color, opacity: 0.7 }} />
                        <span className="text-foreground/60">{lang}</span>
                      </div>
                    ))}
                  </div>
                )}

                {colorBy === 'health' && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-[9px]">
                      <div className="w-3 h-3 rounded-full bg-emerald-500" />
                      <span className="text-foreground/60">Healthy (70-100)</span>
                    </div>
                    <div className="flex items-center gap-2 text-[9px]">
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                      <span className="text-foreground/60">Moderate (40-69)</span>
                    </div>
                    <div className="flex items-center gap-2 text-[9px]">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="text-foreground/60">Stale (0-39)</span>
                    </div>
                  </div>
                )}

                {colorBy === 'activity' && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-[9px]">
                      <div className="w-3 h-3 rounded-full bg-emerald-400" />
                      <span className="text-foreground/60">Active (&lt;7 days)</span>
                    </div>
                    <div className="flex items-center gap-2 text-[9px]">
                      <div className="w-3 h-3 rounded-full bg-teal-400" />
                      <span className="text-foreground/60">Warm (&lt;30 days)</span>
                    </div>
                    <div className="flex items-center gap-2 text-[9px]">
                      <div className="w-3 h-3 rounded-full bg-amber-400" />
                      <span className="text-foreground/60">Cool (&lt;90 days)</span>
                    </div>
                    <div className="flex items-center gap-2 text-[9px]">
                      <div className="w-3 h-3 rounded-full bg-slate-500" />
                      <span className="text-foreground/60">Stale (&gt;90 days)</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Edges legend */}
            {activeSection === 'edges' && (
              <div className="space-y-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[9px]">
                    <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="#fff" strokeWidth={0.5} opacity={0.4} /></svg>
                    <span className="text-foreground/60">Shared tags (solid, thin)</span>
                  </div>
                  <div className="flex items-center gap-2 text-[9px]">
                    <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="#3b82f6" strokeWidth={1} opacity={0.5} strokeDasharray="4 4" /></svg>
                    <span className="text-foreground/60">Shared dependencies (dashed, blue)</span>
                  </div>
                  <div className="flex items-center gap-2 text-[9px]">
                    <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="#10b981" strokeWidth={2} opacity={0.6} /></svg>
                    <span className="text-foreground/60">Strong connection (thick, highlighted)</span>
                  </div>
                  <div className="flex items-center gap-2 text-[9px]">
                    <svg width="24" height="12">
                      <circle cx="4" cy="6" r="2" fill="#10b981" opacity={0.6} />
                      <circle cx="20" cy="6" r="2" fill="#10b981" opacity={0.6} />
                      <circle cx="12" cy="6" r="3" fill="#10b981" opacity={0.8} />
                    </svg>
                    <span className="text-foreground/60">Pulse dot = data flow along edge</span>
                  </div>
                </div>
                <div className="text-[8px] text-muted-foreground/30 pt-1 border-t border-border/10">
                  Thicker edges = more shared items between repos
                </div>
              </div>
            )}

            {/* Icons legend */}
            {activeSection === 'icons' && (
              <div className="space-y-1.5">
                {[
                  { icon: '⚙️', label: 'Tool' },
                  { icon: '📚', label: 'Library' },
                  { icon: '🖥️', label: 'Application' },
                  { icon: '📋', label: 'Template' },
                  { icon: '🧪', label: 'Experiment' },
                  { icon: '🔧', label: 'Config' },
                  { icon: '📖', label: 'Documentation' },
                  { icon: '🎓', label: 'Learning' },
                  { icon: '📦', label: 'Archive' },
                ].map(({ icon, label }) => (
                  <div key={label} className="flex items-center gap-2 text-[9px]">
                    <span className="text-sm">{icon}</span>
                    <span className="text-foreground/60">{label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Badges legend */}
            {activeSection === 'badges' && (
              <div className="space-y-1.5">
                {[
                  { icon: '🦅', label: 'Phoenix — Flagship project (≥5 stars)', color: 'text-amber-400' },
                  { icon: '🔥', label: 'Hot — Pushed in last 7 days', color: 'text-red-400' },
                  { icon: '⚡', label: 'High Activity — Very active project', color: 'text-yellow-400' },
                  { icon: '🌟', label: 'Most Starred — Top starred repos', color: 'text-amber-300' },
                  { icon: '🛡️', label: 'Verified — Deep-analyzed with AI', color: 'text-emerald-400' },
                ].map(({ icon, label, color }) => (
                  <div key={label} className="flex items-center gap-2 text-[9px]">
                    <span className="text-sm">{icon}</span>
                    <span className={`text-foreground/60`}>{label}</span>
                  </div>
                ))}
                <div className="text-[8px] text-muted-foreground/30 pt-2 border-t border-border/10 mt-2">
                  Badges appear as small icons at the top-right of graph nodes
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
