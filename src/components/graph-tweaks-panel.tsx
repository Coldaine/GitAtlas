'use client';

// Why this component exists:
// The project graph used to bake its physics constants (repulsion, link
// distances, damping) and connection strategy (tag vs dependency only) into
// project-graph.tsx. That made it impossible for a user to test whether a
// different layout, looser springs, or e.g. framework-based edges produced
// a clearer picture of their portfolio. This panel surfaces every knob the
// store now exposes so iteration happens live, without code changes.
//
// Why a Sheet (side panel) instead of a Dialog:
// The whole point is to *see* the graph react. A modal would cover it.

import { useAtlasStore } from '@/lib/store';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RotateCcw, Info } from 'lucide-react';
import { useState } from 'react';
import type { GraphLayout, NodeSizeBy, ColorBy } from '@/lib/types';

// Why a small reusable row: keeps every slider visually consistent and
// makes it trivial to add a new knob without copy-pasting markup.
function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <Label className="text-muted-foreground">{label}</Label>
        <span className="font-mono text-foreground/80">{format ? format(value) : value}</span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
      />
    </div>
  );
}

function SwitchRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-0.5">
        <Label className="text-xs">{label}</Label>
        {description ? (
          <p className="text-[10px] text-muted-foreground leading-snug">{description}</p>
        ) : null}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function GraphTweaksPanel() {
  const s = useAtlasStore();
  // Why local explainer toggle: the "How connections work" block is long;
  // collapsing it keeps the panel scannable.
  const [showExplainer, setShowExplainer] = useState(false);

  return (
    <Sheet open={s.showGraphTweaksPanel} onOpenChange={s.setShowGraphTweaksPanel}>
      <SheetContent side="right" className="w-[400px] sm:max-w-[400px] p-0">
        <SheetHeader className="px-5 pt-5 pb-3">
          <SheetTitle>Tune Graph</SheetTitle>
          <SheetDescription className="text-xs">
            Tweak physics, sizing, and which signals form connections. Changes apply live.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-110px)] px-5 pb-6">
          <div className="space-y-6">
            {/* Layout / sizing / coloring — these influence what the graph *means* */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Layout
              </h3>

              <div className="space-y-2">
                <Label className="text-xs">Layout engine</Label>
                <Select
                  value={s.graphLayout}
                  onValueChange={(v) => s.setGraphLayout(v as GraphLayout)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Why list every option here: the store already supports
                        all six; this panel just exposes them. */}
                    <SelectItem value="force">Force-directed (live physics)</SelectItem>
                    <SelectItem value="radial">Radial (by category)</SelectItem>
                    <SelectItem value="circular">Circular</SelectItem>
                    <SelectItem value="hierarchical">Hierarchical</SelectItem>
                    <SelectItem value="grid">Grid</SelectItem>
                    <SelectItem value="spiral">Spiral</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Size nodes by</Label>
                <Select
                  value={s.nodeSizeBy}
                  onValueChange={(v) => s.setNodeSizeBy(v as NodeSizeBy)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default (stars + recency)</SelectItem>
                    <SelectItem value="stars">Stars</SelectItem>
                    <SelectItem value="activity">Activity</SelectItem>
                    <SelectItem value="dependencies">Dependency count</SelectItem>
                    <SelectItem value="files">File count</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Color nodes by</Label>
                <Select
                  value={s.colorBy}
                  onValueChange={(v) => s.setColorBy(v as ColorBy)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="category">Category</SelectItem>
                    <SelectItem value="language">Language</SelectItem>
                    <SelectItem value="health">Health</SelectItem>
                    <SelectItem value="activity">Activity</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </section>

            <Separator />

            {/* Physics — only relevant when graphLayout === 'force', but
                cheap to leave visible so users learn what shapes the sim. */}
            <section className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Physics
              </h3>
              <SliderRow
                label="Repulsion"
                value={s.repulsion}
                min={500}
                max={8000}
                step={100}
                onChange={s.setRepulsion}
              />
              <SliderRow
                label="Link strength"
                value={s.linkStrength}
                min={0.001}
                max={0.02}
                step={0.001}
                onChange={s.setLinkStrength}
                format={(v) => v.toFixed(3)}
              />
              <SliderRow
                label="Link distance (tag/category)"
                value={s.linkDistance}
                min={40}
                max={300}
                step={5}
                onChange={s.setLinkDistance}
              />
              <SliderRow
                label="Link distance (dependency)"
                value={s.depLinkDistance}
                min={40}
                max={300}
                step={5}
                onChange={s.setDepLinkDistance}
              />
              <SliderRow
                label="Damping"
                value={s.damping}
                min={0.7}
                max={0.99}
                step={0.01}
                onChange={s.setDamping}
                format={(v) => v.toFixed(2)}
              />
              <SliderRow
                label="Centering pull"
                value={s.centering}
                min={0}
                max={0.05}
                step={0.001}
                onChange={s.setCentering}
                format={(v) => v.toFixed(3)}
              />
              <SliderRow
                label="Animation speed"
                value={s.animationSpeed}
                min={0.1}
                max={2}
                step={0.1}
                onChange={s.setAnimationSpeed}
                format={(v) => `${v.toFixed(1)}x`}
              />
            </section>

            <Separator />

            {/* Node sizing knobs distinct from sizeBy metric */}
            <section className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Nodes
              </h3>
              <SliderRow
                label="Base radius"
                value={s.nodeSizeBase}
                min={5}
                max={25}
                step={1}
                onChange={s.setNodeSizeBase}
              />
              <SliderRow
                label="Size scale"
                value={s.nodeSizeScale}
                min={0.5}
                max={3}
                step={0.1}
                onChange={s.setNodeSizeScale}
                format={(v) => `${v.toFixed(1)}x`}
              />
            </section>

            <Separator />

            {/* Connection thresholds + per-source toggles. Why grouped:
                "what makes nodes connect?" is one mental concept even though
                it spans sliders and switches. */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Connections
                </h3>
                <button
                  onClick={() => setShowExplainer((v) => !v)}
                  className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <Info className="h-3 w-3" />
                  How they work
                </button>
              </div>

              {showExplainer ? (
                <div className="rounded-md border bg-muted/30 p-3 text-[11px] text-muted-foreground space-y-2">
                  <p>
                    Edges are computed pairwise. Each strategy below produces
                    its own edges, independently:
                  </p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li><b>Tag</b>: shared topics, tags, or primary language. Threshold = &quot;Edge threshold&quot;.</li>
                    <li><b>Dependency</b>: shared packages (runtime+dev). Threshold = &quot;Min shared deps&quot;.</li>
                    <li><b>Framework</b>: shared frameworks from deep-analyze. Any overlap = edge.</li>
                    <li><b>Category</b>: weak edge between same-category projects. Use sparingly.</li>
                    <li><b>Owner</b>: weak edge between same-owner projects. Useful with multi-org imports.</li>
                  </ul>
                </div>
              ) : null}

              <SliderRow
                label="Edge threshold (tags)"
                value={s.edgeThreshold}
                min={1}
                max={10}
                step={1}
                onChange={s.setEdgeThreshold}
              />
              <SliderRow
                label="Min shared deps"
                value={s.minSharedDeps}
                min={1}
                max={10}
                step={1}
                onChange={s.setMinSharedDeps}
              />

              <div className="space-y-3 pt-1">
                <SwitchRow
                  label="Tag / topic / language"
                  description="Original edge source."
                  checked={s.connectionSources.tag}
                  onChange={(v) => s.setConnectionSource('tag', v)}
                />
                <SwitchRow
                  label="Shared dependencies"
                  description="Packages used by both projects."
                  checked={s.connectionSources.dependency}
                  onChange={(v) => s.setConnectionSource('dependency', v)}
                />
                <SwitchRow
                  label="Shared frameworks"
                  description="Detected from code (deep-analyze)."
                  checked={s.connectionSources.framework}
                  onChange={(v) => s.setConnectionSource('framework', v)}
                />
                <SwitchRow
                  label="Same category"
                  description="Weak link; can over-cluster."
                  checked={s.connectionSources.category}
                  onChange={(v) => s.setConnectionSource('category', v)}
                />
                <SwitchRow
                  label="Same owner"
                  description="Weak link; useful for multi-org."
                  checked={s.connectionSources.owner}
                  onChange={(v) => s.setConnectionSource('owner', v)}
                />
              </div>
            </section>

            <Separator />

            {/* Visual extras — non-physics overlays */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Visuals
              </h3>
              <SwitchRow
                label="Floating particles"
                checked={s.showParticles}
                onChange={s.setShowParticles}
              />
              <SwitchRow
                label="Cluster backgrounds"
                checked={s.showClusterBackgrounds}
                onChange={s.setShowClusterBackgrounds}
              />
              <SwitchRow
                label="Health rings"
                checked={s.showHealthRings}
                onChange={s.setShowHealthRings}
              />
              <SwitchRow
                label="Edge labels"
                checked={s.showEdgeLabels}
                onChange={s.setShowEdgeLabels}
              />
              <SwitchRow
                label="Dependency edges (legacy gate)"
                description="Kept for back-compat alongside the new toggle above."
                checked={s.showDependencyEdges}
                onChange={s.setShowDependencyEdges}
              />
            </section>

            <Separator />

            {/* Why a single reset button: defaults map to the previously
                hardcoded constants, so this also restores "stock" look. */}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={s.resetGraphTweaks}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-2" />
              Reset to defaults
            </Button>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
