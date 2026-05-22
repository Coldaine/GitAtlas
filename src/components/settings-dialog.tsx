'use client';

import { useAtlasStore } from '@/lib/store';
import { ViewMode, GraphLayout, NodeSizeBy, ColorBy } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Settings, Palette, Database, Info, ChevronRight,
  Monitor, Network, HardDrive, Zap,
} from 'lucide-react';
import { useState } from 'react';

type SettingsTab = 'general' | 'graph' | 'ingestion' | 'data' | 'about';

// Mocked setting indicator component
function MockedBadge({ tooltip }: { tooltip: string }) {
  return (
    <span className="inline-flex items-center gap-1" title={tooltip}>
      <Badge variant="outline" className="text-[8px] px-1 py-0 border-amber-500/30 text-amber-400 bg-amber-500/10">
        🚧 Planned
      </Badge>
    </span>
  );
}

// Mocked wrapper — dims the control and adds badge
function MockedSetting({ children, label, description }: { children: React.ReactNode; label: string; description: string }) {
  return (
    <div className="opacity-50 pointer-events-none">
      {/* MOCKED: {label} — Not yet functional */}
      {children}
      <MockedBadge tooltip={description} />
    </div>
  );
}

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const {
    viewMode, setViewMode,
    graphLayout, setGraphLayout,
    nodeSizeBy, setNodeSizeBy,
    colorBy, setColorBy,
    edgeThreshold, setEdgeThreshold,
    showParticles, setShowParticles,
    showClusterBackgrounds, setShowClusterBackgrounds,
    showHealthRings, setShowHealthRings,
    showDependencyEdges, setShowDependencyEdges,
    animationSpeed, setAnimationSpeed,
    showEdgeLabels, setShowEdgeLabels,
  } = useAtlasStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: 'General', icon: <Monitor className="w-3.5 h-3.5" /> },
    { id: 'graph', label: 'Graph', icon: <Network className="w-3.5 h-3.5" /> },
    { id: 'ingestion', label: 'Ingestion', icon: <Database className="w-3.5 h-3.5" /> },
    { id: 'data', label: 'Data', icon: <HardDrive className="w-3.5 h-3.5" /> },
    { id: 'about', label: 'About', icon: <Info className="w-3.5 h-3.5" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] p-0 gap-0 bg-card/95 backdrop-blur-xl border-border/30">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border/20">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Settings className="w-4 h-4 text-emerald-400" />
            Settings
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground/60">
            Configure Git Atlas behavior and appearance. Items marked 🚧 are planned features.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden" style={{ height: '520px' }}>
          {/* Sidebar tabs */}
          <div className="w-40 border-r border-border/15 p-2 space-y-0.5 shrink-0">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs transition-all ${
                  activeTab === tab.id
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-card/40 border border-transparent'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.id === 'ingestion' && (
                  <Badge variant="outline" className="ml-auto text-[7px] px-0.5 py-0 border-amber-500/30 text-amber-400">MOCK</Badge>
                )}
              </button>
            ))}
          </div>

          {/* Content area */}
          <ScrollArea className="flex-1">
            <div className="p-5 space-y-5">

              {/* === GENERAL TAB === */}
              {activeTab === 'general' && (
                <>
                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider mb-3">Display</h3>

                    <div className="space-y-4">
                      {/* Default View Mode — FUNCTIONAL */}
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-xs text-foreground/80">Default View Mode</label>
                          <p className="text-[10px] text-muted-foreground/50">Which view opens on launch</p>
                        </div>
                        <select
                          value={viewMode}
                          onChange={(e) => setViewMode(e.target.value as ViewMode)}
                          className="h-7 px-2 text-xs bg-card/50 border border-border/30 rounded-md text-foreground/80 focus:border-emerald-500/30 focus:outline-none"
                        >
                          <option value="graph">Graph</option>
                          <option value="grid">Grid</option>
                          <option value="timeline">Timeline</option>
                          <option value="stats">Stats</option>
                          <option value="network">Network</option>
                          <option value="radar">Radar</option>
                          <option value="bookmarks">Bookmarks</option>
                          <option value="relationships">Relationships</option>
                          <option value="health">Health</option>
                        </select>
                      </div>

                      {/* Auto-refresh interval — MOCKED */}
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-xs text-foreground/80">Auto-refresh Interval</label>
                          <p className="text-[10px] text-muted-foreground/50">How often to check for repo updates</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            disabled
                            className="h-7 px-2 text-xs bg-card/30 border border-border/20 rounded-md text-muted-foreground/40 cursor-not-allowed"
                          >
                            <option>Off</option>
                            <option>5 minutes</option>
                            <option>15 minutes</option>
                            <option>30 minutes</option>
                            <option>1 hour</option>
                          </select>
                          <MockedBadge tooltip="Auto-refresh will periodically check GitHub for updates" />
                        </div>
                      </div>

                      {/* Theme — MOCKED */}
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-xs text-foreground/80">Theme</label>
                          <p className="text-[10px] text-muted-foreground/50">Light, dark, or system preference</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            disabled
                            className="h-7 px-2 text-xs bg-card/30 border border-border/20 rounded-md text-muted-foreground/40 cursor-not-allowed"
                          >
                            <option>Dark</option>
                            <option>Light</option>
                            <option>System</option>
                          </select>
                          <MockedBadge tooltip="Theme switching will allow light/dark mode" />
                        </div>
                      </div>

                      {/* Language — MOCKED */}
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-xs text-foreground/80">Language</label>
                          <p className="text-[10px] text-muted-foreground/50">Interface language</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            disabled
                            className="h-7 px-2 text-xs bg-card/30 border border-border/20 rounded-md text-muted-foreground/40 cursor-not-allowed"
                          >
                            <option>English</option>
                          </select>
                          <MockedBadge tooltip="i18n support for multiple languages" />
                        </div>
                      </div>

                      {/* Compact mode — MOCKED */}
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-xs text-foreground/80">Compact Mode</label>
                          <p className="text-[10px] text-muted-foreground/50">Reduce padding and font sizes for dense displays</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch disabled checked={false} />
                          <MockedBadge tooltip="Compact mode reduces spacing for more content density" />
                        </div>
                      </div>

                      {/* Show onboarding tour — MOCKED */}
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-xs text-foreground/80">Show Onboarding Tour</label>
                          <p className="text-[10px] text-muted-foreground/50">Display the guided tour on next visit</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch disabled checked={false} />
                          <MockedBadge tooltip="Reset the onboarding tour for new user experience" />
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* === GRAPH TAB === */}
              {activeTab === 'graph' && (
                <>
                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider mb-3">Layout</h3>

                    <div className="space-y-4">
                      {/* Layout Mode — FUNCTIONAL */}
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-xs text-foreground/80">Layout Mode</label>
                          <p className="text-[10px] text-muted-foreground/50">How nodes are arranged in the graph</p>
                        </div>
                        <select
                          value={graphLayout}
                          onChange={(e) => setGraphLayout(e.target.value as GraphLayout)}
                          className="h-7 px-2 text-xs bg-card/50 border border-border/30 rounded-md text-foreground/80 focus:border-emerald-500/30 focus:outline-none"
                        >
                          <option value="force">Force-Directed</option>
                          <option value="radial">Radial</option>
                          <option value="circular">Circular</option>
                          <option value="hierarchical">Hierarchical</option>
                          <option value="grid">Grid</option>
                          <option value="spiral">Spiral</option>
                        </select>
                      </div>

                      {/* Node Size By — FUNCTIONAL */}
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-xs text-foreground/80">Node Size By</label>
                          <p className="text-[10px] text-muted-foreground/50">What determines node size</p>
                        </div>
                        <select
                          value={nodeSizeBy}
                          onChange={(e) => setNodeSizeBy(e.target.value as NodeSizeBy)}
                          className="h-7 px-2 text-xs bg-card/50 border border-border/30 rounded-md text-foreground/80 focus:border-emerald-500/30 focus:outline-none"
                        >
                          <option value="default">Default (stars + activity)</option>
                          <option value="stars">Stars</option>
                          <option value="activity">Recent Activity</option>
                          <option value="dependencies">Dependencies</option>
                          <option value="files">File Count</option>
                        </select>
                      </div>

                      {/* Color By — FUNCTIONAL */}
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-xs text-foreground/80">Color By</label>
                          <p className="text-[10px] text-muted-foreground/50">What determines node colors</p>
                        </div>
                        <select
                          value={colorBy}
                          onChange={(e) => setColorBy(e.target.value as ColorBy)}
                          className="h-7 px-2 text-xs bg-card/50 border border-border/30 rounded-md text-foreground/80 focus:border-emerald-500/30 focus:outline-none"
                        >
                          <option value="category">Category</option>
                          <option value="language">Language</option>
                          <option value="health">Health Score</option>
                          <option value="activity">Activity Level</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-gradient-to-r from-transparent via-border/20 to-transparent" />

                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider mb-3">Edges & Connections</h3>

                    <div className="space-y-4">
                      {/* Edge Threshold — FUNCTIONAL */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <div>
                            <label className="text-xs text-foreground/80">Edge Threshold</label>
                            <p className="text-[10px] text-muted-foreground/50">Minimum shared items to show connections</p>
                          </div>
                          <span className="text-xs text-emerald-400 font-mono">{edgeThreshold}</span>
                        </div>
                        <Slider
                          value={[edgeThreshold]}
                          onValueChange={([v]) => setEdgeThreshold(v)}
                          min={1}
                          max={10}
                          step={1}
                          className="w-full"
                        />
                      </div>

                      {/* Show Dependency Edges — FUNCTIONAL */}
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-xs text-foreground/80">Show Dependency Edges</label>
                          <p className="text-[10px] text-muted-foreground/50">Blue dashed lines for shared deps</p>
                        </div>
                        <Switch checked={showDependencyEdges} onCheckedChange={setShowDependencyEdges} />
                      </div>

                      {/* Show Edge Labels — FUNCTIONAL */}
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-xs text-foreground/80">Show Edge Labels</label>
                          <p className="text-[10px] text-muted-foreground/50">Shared items text on hover</p>
                        </div>
                        <Switch checked={showEdgeLabels} onCheckedChange={setShowEdgeLabels} />
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-gradient-to-r from-transparent via-border/20 to-transparent" />

                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider mb-3">Visual Effects</h3>

                    <div className="space-y-4">
                      {/* Show Particles — FUNCTIONAL */}
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-xs text-foreground/80">Ambient Particles</label>
                          <p className="text-[10px] text-muted-foreground/50">Floating particles in background</p>
                        </div>
                        <Switch checked={showParticles} onCheckedChange={setShowParticles} />
                      </div>

                      {/* Show Cluster Backgrounds — FUNCTIONAL */}
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-xs text-foreground/80">Cluster Backgrounds</label>
                          <p className="text-[10px] text-muted-foreground/50">Soft colored clouds behind categories</p>
                        </div>
                        <Switch checked={showClusterBackgrounds} onCheckedChange={setShowClusterBackgrounds} />
                      </div>

                      {/* Show Health Rings — FUNCTIONAL */}
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-xs text-foreground/80">Health Rings</label>
                          <p className="text-[10px] text-muted-foreground/50">Colored ring showing project health</p>
                        </div>
                        <Switch checked={showHealthRings} onCheckedChange={setShowHealthRings} />
                      </div>

                      {/* Animation Speed — FUNCTIONAL */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <div>
                            <label className="text-xs text-foreground/80">Animation Speed</label>
                            <p className="text-[10px] text-muted-foreground/50">Physics simulation speed</p>
                          </div>
                          <span className="text-xs text-emerald-400 font-mono">{animationSpeed.toFixed(1)}x</span>
                        </div>
                        <Slider
                          value={[animationSpeed]}
                          onValueChange={([v]) => setAnimationSpeed(v)}
                          min={0.5}
                          max={3}
                          step={0.1}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* === INGESTION TAB === */}
              {activeTab === 'ingestion' && (
                <>
                  <div className="px-3 py-2 rounded-md bg-amber-500/5 border border-amber-500/15 text-[10px] text-amber-400/70 mb-3">
                    ⚠️ All settings on this tab are <strong>planned/mocked</strong> and not yet functional. They represent the intended configuration for GitHub data ingestion.
                  </div>

                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider mb-3">GitHub Connection</h3>

                    <div className="space-y-4">
                      {/* GitHub PAT Token — MOCKED */}
                      <div className="opacity-50">
                        <label className="text-xs text-foreground/80">GitHub PAT Token</label>
                        <p className="text-[10px] text-muted-foreground/50 mb-1">Personal access token for API access</p>
                        <div className="flex items-center gap-2">
                          <Input
                            disabled
                            type="password"
                            value="••••••••••••••••"
                            className="h-7 text-xs bg-card/30 border-border/20"
                          />
                          <MockedBadge tooltip="Token management UI will allow updating the GitHub PAT" />
                        </div>
                        {/* MOCKED: Token management UI — Not yet functional */}
                      </div>

                      {/* Org Sync Interval — MOCKED */}
                      <div className="flex items-center justify-between opacity-50">
                        <div>
                          <label className="text-xs text-foreground/80">Org Sync Interval</label>
                          <p className="text-[10px] text-muted-foreground/50">How often to sync organization repos</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <select disabled className="h-7 px-2 text-xs bg-card/30 border border-border/20 rounded-md text-muted-foreground/40 cursor-not-allowed">
                            <option>Manual</option>
                            <option>Hourly</option>
                            <option>Daily</option>
                            <option>Weekly</option>
                          </select>
                          <MockedBadge tooltip="Scheduled org sync will auto-fetch new org repos" />
                        </div>
                        {/* MOCKED: Org sync interval — Not yet functional */}
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-gradient-to-r from-transparent via-border/20 to-transparent" />

                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider mb-3">Deep Analysis</h3>

                    <div className="space-y-4">
                      {/* Analysis Depth — MOCKED */}
                      <div className="flex items-center justify-between opacity-50">
                        <div>
                          <label className="text-xs text-foreground/80">Analysis Depth</label>
                          <p className="text-[10px] text-muted-foreground/50">How deep to analyze each repo</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <select disabled className="h-7 px-2 text-xs bg-card/30 border border-border/20 rounded-md text-muted-foreground/40 cursor-not-allowed">
                            <option>Shallow (readme + deps)</option>
                            <option>Medium (+file tree)</option>
                            <option>Deep (+source code)</option>
                          </select>
                          <MockedBadge tooltip="Configurable depth will control how much code is read during analysis" />
                        </div>
                        {/* MOCKED: Analysis depth config — Not yet functional */}
                      </div>

                      {/* Include Archived — MOCKED */}
                      <div className="flex items-center justify-between opacity-50">
                        <div>
                          <label className="text-xs text-foreground/80">Include Archived Repos</label>
                          <p className="text-[10px] text-muted-foreground/50">Also analyze archived repositories</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch disabled checked={true} />
                          <MockedBadge tooltip="Archive filtering will let you exclude archived repos from analysis" />
                        </div>
                        {/* MOCKED: Include archived toggle — Not yet functional */}
                      </div>

                      {/* Commit History Depth — MOCKED */}
                      <div className="flex items-center justify-between opacity-50">
                        <div>
                          <label className="text-xs text-foreground/80">Commit History Depth</label>
                          <p className="text-[10px] text-muted-foreground/50">How far back to analyze commits</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <select disabled className="h-7 px-2 text-xs bg-card/30 border border-border/20 rounded-md text-muted-foreground/40 cursor-not-allowed">
                            <option>30 days</option>
                            <option>90 days</option>
                            <option>180 days</option>
                            <option>365 days</option>
                          </select>
                          <MockedBadge tooltip="Configurable commit depth will control activity analysis range" />
                        </div>
                        {/* MOCKED: Commit history depth — Not yet functional */}
                      </div>

                      {/* Auto-deep-analyze new repos — MOCKED */}
                      <div className="flex items-center justify-between opacity-50">
                        <div>
                          <label className="text-xs text-foreground/80">Auto-Deep-Analyze New Repos</label>
                          <p className="text-[10px] text-muted-foreground/50">Automatically analyze repos when discovered</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch disabled checked={false} />
                          <MockedBadge tooltip="Auto-analysis will trigger deep analysis on newly discovered repos" />
                        </div>
                        {/* MOCKED: Auto deep-analyze toggle — Not yet functional */}
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-gradient-to-r from-transparent via-border/20 to-transparent" />

                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider mb-3">Memory & Caching</h3>

                    <div className="space-y-4">
                      {/* LLM Memory Context — MOCKED */}
                      <div className="flex items-center justify-between opacity-50">
                        <div>
                          <label className="text-xs text-foreground/80">LLM Memory Context</label>
                          <p className="text-[10px] text-muted-foreground/50">Include previous analyses as context for new runs</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch disabled checked={false} />
                          <MockedBadge tooltip="LLM memory will use previous analysis results as context for smarter future analyses" />
                        </div>
                        {/* MOCKED: LLM memory context — Not yet functional */}
                      </div>

                      {/* Cache TTL — MOCKED */}
                      <div className="flex items-center justify-between opacity-50">
                        <div>
                          <label className="text-xs text-foreground/80">Cache TTL</label>
                          <p className="text-[10px] text-muted-foreground/50">How long to cache API results</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <select disabled className="h-7 px-2 text-xs bg-card/30 border border-border/20 rounded-md text-muted-foreground/40 cursor-not-allowed">
                            <option>1 hour</option>
                            <option>6 hours</option>
                            <option>24 hours</option>
                            <option>Never expire</option>
                          </select>
                          <MockedBadge tooltip="Cache TTL controls how long fetched data is cached before refresh" />
                        </div>
                        {/* MOCKED: Cache TTL — Not yet functional */}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* === DATA TAB === */}
              {activeTab === 'data' && (
                <>
                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider mb-3">Cache & Storage</h3>

                    <div className="space-y-4">
                      {/* Clear cache — MOCKED */}
                      <div className="flex items-center justify-between opacity-50">
                        <div>
                          <label className="text-xs text-foreground/80">Clear Analysis Cache</label>
                          <p className="text-[10px] text-muted-foreground/50">Remove cached deep analysis results</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" disabled className="h-7 text-xs border-red-500/20 text-red-400/40">
                            Clear Cache
                          </Button>
                          <MockedBadge tooltip="Cache clearing will remove stored analysis results and force re-analysis" />
                        </div>
                        {/* MOCKED: Clear cache — Not yet functional */}
                      </div>

                      {/* Reset settings — MOCKED */}
                      <div className="flex items-center justify-between opacity-50">
                        <div>
                          <label className="text-xs text-foreground/80">Reset All Settings</label>
                          <p className="text-[10px] text-muted-foreground/50">Restore all settings to defaults</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" disabled className="h-7 text-xs border-orange-500/20 text-orange-400/40">
                            Reset
                          </Button>
                          <MockedBadge tooltip="Settings reset will restore all configuration to factory defaults" />
                        </div>
                        {/* MOCKED: Reset settings — Not yet functional */}
                      </div>

                      {/* Export settings — MOCKED */}
                      <div className="flex items-center justify-between opacity-50">
                        <div>
                          <label className="text-xs text-foreground/80">Export Settings as JSON</label>
                          <p className="text-[10px] text-muted-foreground/50">Download current settings for backup</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" disabled className="h-7 text-xs border-emerald-500/20 text-emerald-400/40">
                            Export
                          </Button>
                          <MockedBadge tooltip="Settings export will save configuration as a JSON file" />
                        </div>
                        {/* MOCKED: Export settings — Not yet functional */}
                      </div>

                      {/* Import settings — MOCKED */}
                      <div className="flex items-center justify-between opacity-50">
                        <div>
                          <label className="text-xs text-foreground/80">Import Settings</label>
                          <p className="text-[10px] text-muted-foreground/50">Load settings from a JSON file</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" disabled className="h-7 text-xs border-emerald-500/20 text-emerald-400/40">
                            Import
                          </Button>
                          <MockedBadge tooltip="Settings import will load configuration from a previously exported JSON file" />
                        </div>
                        {/* MOCKED: Import settings — Not yet functional */}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* === ABOUT TAB === */}
              {activeTab === 'about' && (
                <>
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center border border-emerald-500/20">
                        <Zap className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-foreground">Git Atlas</h3>
                        <p className="text-[10px] text-muted-foreground/50">v0.2.0 — Interactive GitHub Corpus Explorer</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground/60 leading-relaxed mb-4">
                      Git Atlas maps your entire GitHub project corpus into an interactive, visually explorable graph.
                      It uses AI to deeply analyze your code, find relationships between projects, and answer the question:
                      &quot;Do I already have a tool for X?&quot;
                    </p>
                  </div>

                  <div className="h-px bg-gradient-to-r from-transparent via-border/20 to-transparent" />

                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider mb-3">Keyboard Shortcuts</h3>

                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-card/30">
                        <kbd className="px-1.5 py-0.5 rounded bg-card/60 border border-border/20 text-emerald-400 font-mono text-[9px]">⌘K</kbd>
                        <span className="text-muted-foreground/60">Command Palette</span>
                      </div>
                      <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-card/30">
                        <kbd className="px-1.5 py-0.5 rounded bg-card/60 border border-border/20 text-emerald-400 font-mono text-[9px]">/</kbd>
                        <span className="text-muted-foreground/60">Smart Search</span>
                      </div>
                      <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-card/30">
                        <kbd className="px-1.5 py-0.5 rounded bg-card/60 border border-border/20 text-emerald-400 font-mono text-[9px]">⌘1-9</kbd>
                        <span className="text-muted-foreground/60">Switch Views</span>
                      </div>
                      <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-card/30">
                        <kbd className="px-1.5 py-0.5 rounded bg-card/60 border border-border/20 text-emerald-400 font-mono text-[9px]">?</kbd>
                        <span className="text-muted-foreground/60">Keyboard Help</span>
                      </div>
                      <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-card/30">
                        <kbd className="px-1.5 py-0.5 rounded bg-card/60 border border-border/20 text-emerald-400 font-mono text-[9px]">Esc</kbd>
                        <span className="text-muted-foreground/60">Close Dialogs</span>
                      </div>
                      <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-card/30">
                        <kbd className="px-1.5 py-0.5 rounded bg-card/60 border border-border/20 text-emerald-400 font-mono text-[9px]">Scroll</kbd>
                        <span className="text-muted-foreground/60">Zoom Graph</span>
                      </div>
                      <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-card/30">
                        <kbd className="px-1.5 py-0.5 rounded bg-card/60 border border-border/20 text-emerald-400 font-mono text-[9px]">Dbl-Click</kbd>
                        <span className="text-muted-foreground/60">Focus Node</span>
                      </div>
                      <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-card/30">
                        <kbd className="px-1.5 py-0.5 rounded bg-card/60 border border-border/20 text-emerald-400 font-mono text-[9px]">Right-Click</kbd>
                        <span className="text-muted-foreground/60">Node Context</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
