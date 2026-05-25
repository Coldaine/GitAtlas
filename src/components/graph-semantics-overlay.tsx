'use client';

import { useState } from 'react';
import { useAtlasStore } from '@/lib/store';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, X } from 'lucide-react';

export function GraphSemanticsOverlay() {
  const { nodeSizeBy, colorBy } = useAtlasStore();
  const [isExpanded, setIsExpanded] = useState(false);

  // Human-readable labels for current modes
  const sizeLabel: Record<string, string> = {
    default: 'Stars + Activity',
    stars: 'Stars',
    activity: 'Activity',
    dependencies: 'Dependencies',
    files: 'Files',
  };
  const colorLabel: Record<string, string> = {
    default: 'Category',
    category: 'Category',
    language: 'Language',
    health: 'Health',
    activity: 'Activity',
  };

  return (
    <div className="absolute top-3 right-3 z-40">
      {/* Collapsed "?" button */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-card/70 backdrop-blur-sm border border-emerald-500/15 text-emerald-400/60 hover:text-emerald-400 hover:bg-card/90 hover:border-emerald-500/30 transition-all shadow-md"
          title="What am I looking at? — Click to see graph legend"
        >
          <HelpCircle className="w-3 h-3" />
          <span className="text-[9px] font-medium">Legend</span>
        </button>
      )}

      {/* Expanded panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -6 }}
            transition={{ duration: 0.15 }}
            className="w-56 rounded-lg border border-border/25 shadow-xl overflow-hidden"
            style={{ background: 'rgba(10,10,10,0.88)', backdropFilter: 'blur(16px)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/15">
              <span className="text-[10px] font-semibold text-foreground/80 uppercase tracking-wider">
                Graph Semantics
              </span>
              <button
                onClick={() => setIsExpanded(false)}
                className="text-muted-foreground/40 hover:text-foreground/70 transition-colors"
                title="Close"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            {/* Content */}
            <div className="px-3 py-2.5 space-y-2.5">
              {/* Node size */}
              <div className="flex items-start gap-2">
                <span className="text-sm leading-none mt-0.5">🟢</span>
                <div>
                  <span className="text-[9px] text-muted-foreground/50">Node size = </span>
                  <span className="text-[9px] text-foreground/70 font-medium">{sizeLabel[nodeSizeBy] || nodeSizeBy}</span>
                </div>
              </div>

              {/* Node color */}
              <div className="flex items-start gap-2">
                <span className="text-sm leading-none mt-0.5">🎨</span>
                <div>
                  <span className="text-[9px] text-muted-foreground/50">Node color = </span>
                  <span className="text-[9px] text-foreground/70 font-medium">{colorLabel[colorBy] || colorBy}</span>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-border/15" />

              {/* Solid lines — tag connections */}
              <div className="flex items-center gap-2">
                <svg width="20" height="6" className="shrink-0">
                  <line x1="0" y1="3" x2="20" y2="3" stroke="#10b981" strokeWidth={1.5} opacity={0.6} />
                </svg>
                <span className="text-[9px] text-muted-foreground/60">Solid lines = Shared tags/topics</span>
              </div>

              {/* Dashed lines — dependency connections */}
              <div className="flex items-center gap-2">
                <svg width="20" height="6" className="shrink-0">
                  <line x1="0" y1="3" x2="20" y2="3" stroke="#3b82f6" strokeWidth={1.5} opacity={0.6} strokeDasharray="3 3" />
                </svg>
                <span className="text-[9px] text-muted-foreground/60">Dashed lines = Shared deps</span>
              </div>

              {/* Divider */}
              <div className="h-px bg-border/15" />

              {/* Deep-analyzed ring */}
              <div className="flex items-center gap-2">
                <svg width="16" height="16" className="shrink-0">
                  <circle cx="8" cy="8" r="5" fill="none" stroke="#10b981" strokeWidth={1.5} opacity={0.4} />
                  <circle cx="8" cy="8" r="5" fill="none" stroke="#10b981" strokeWidth={1} opacity={0.2} strokeDasharray="2 1.5" />
                </svg>
                <span className="text-[9px] text-muted-foreground/60">Emerald ring = Deep-analyzed</span>
              </div>

              {/* Health arc */}
              <div className="flex items-center gap-2">
                <svg width="16" height="16" className="shrink-0">
                  <circle cx="8" cy="8" r="6" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
                  <circle cx="8" cy="8" r="6" fill="none" stroke="#10b981" strokeWidth={1} opacity={0.3} strokeDasharray="18 38" strokeLinecap="round" />
                </svg>
                <span className="text-[9px] text-muted-foreground/60">Health arc = Project health</span>
              </div>

              {/* Thickness note */}
              <div className="text-[8px] text-muted-foreground/30 pt-0.5 border-t border-border/10">
                Thicker lines = more shared items. Hover a line for details.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
