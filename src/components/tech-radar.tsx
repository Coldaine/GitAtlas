'use client';

import { useMemo, useState } from 'react';
import { Project, CATEGORY_COLORS } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, AlertTriangle, ArrowUpRight } from 'lucide-react';

// --- Radar Dimension Definitions ---
interface RadarDimension {
  key: string;
  label: string;
  color: string;
  icon: string;
  matchers: {
    frameworks: string[];
    patterns: string[];
    tags: string[];
    languages: string[];
  };
}

const RADAR_DIMENSIONS: RadarDimension[] = [
  {
    key: 'frontend',
    label: 'Frontend',
    color: '#61dafb',
    icon: '🎨',
    matchers: {
      frameworks: ['Next.js', 'React', 'Vue', 'Svelte', 'Tailwind', 'Vite', 'Astro', 'Nuxt', 'Remix'],
      patterns: ['SSR', 'SPA', 'Frontend', 'UI'],
      tags: ['frontend', 'ui', 'web', 'react', 'nextjs', 'tailwind'],
      languages: ['TypeScript', 'JavaScript', 'HTML', 'CSS'],
    },
  },
  {
    key: 'backend',
    label: 'Backend',
    color: '#10b981',
    icon: '⚙️',
    matchers: {
      frameworks: ['FastAPI', 'Flask', 'Django', 'Express', 'Koa', 'Nest', 'Axum', 'Actix'],
      patterns: ['REST API', 'API', 'Backend', 'Server', 'GraphQL'],
      tags: ['backend', 'api', 'server', 'rest'],
      languages: ['Python', 'Go', 'Java'],
    },
  },
  {
    key: 'ai_llm',
    label: 'AI / LLM',
    color: '#8b5cf6',
    icon: '🧠',
    matchers: {
      frameworks: ['OpenAI', 'Anthropic', 'LangChain', 'LlamaIndex', 'Transformers', 'Hugging Face'],
      patterns: ['AI/LLM', 'AI', 'LLM', 'RAG', 'Agent', 'MCP'],
      tags: ['ai', 'llm', 'openai', 'anthropic', 'machine-learning', 'gpt', 'ml'],
      languages: [],
    },
  },
  {
    key: 'cli',
    label: 'CLI Tools',
    color: '#f59e0b',
    icon: '💻',
    matchers: {
      frameworks: ['Click', 'Typer', 'Rich', 'Argparse', 'Commander', 'Clap'],
      patterns: ['CLI', 'Terminal', 'Console'],
      tags: ['cli', 'command-line', 'terminal', 'tool'],
      languages: [],
    },
  },
  {
    key: 'data_storage',
    label: 'Data / Storage',
    color: '#3178c6',
    icon: '🗄️',
    matchers: {
      frameworks: ['Prisma', 'SQLAlchemy', 'Django ORM', 'Mongoose', 'Drizzle', 'Knex'],
      patterns: ['ORM', 'Database', 'Pipeline', 'ETL', 'Migration'],
      tags: ['database', 'sql', 'storage', 'data', 'orm', 'pipeline'],
      languages: [],
    },
  },
  {
    key: 'automation',
    label: 'Automation',
    color: '#ec4899',
    icon: '🤖',
    matchers: {
      frameworks: ['Selenium', 'Playwright', 'Puppeteer', 'Airflow', 'Celery'],
      patterns: ['Automation', 'Agent', 'Workflow', 'Scraper', 'Bot'],
      tags: ['automation', 'agent', 'workflow', 'bot', 'scraper'],
      languages: [],
    },
  },
  {
    key: 'desktop',
    label: 'Desktop',
    color: '#f97316',
    icon: '🖥️',
    matchers: {
      frameworks: ['Electron', 'Tauri', 'Qt', 'GTK', 'wxWidgets'],
      patterns: ['Desktop', 'GUI', 'Native'],
      tags: ['desktop', 'electron', 'tauri', 'gui', 'native'],
      languages: [],
    },
  },
  {
    key: 'devops',
    label: 'DevOps',
    color: '#14b8a6',
    icon: '🔧',
    matchers: {
      frameworks: ['Docker', 'Kubernetes', 'Terraform', 'Ansible', 'Pulumi'],
      patterns: ['CI/CD', 'Docker', 'Container', 'Infrastructure', 'Config'],
      tags: ['devops', 'docker', 'ci-cd', 'infrastructure', 'config', 'deployment'],
      languages: ['Shell'],
    },
  },
];

// --- Compute Radar Scores ---
function computeRadarScores(projects: Project[]): {
  scores: Record<string, number>;
  contributingProjects: Record<string, { name: string; reason: string }[]>;
} {
  const scores: Record<string, number> = {};
  const contributingProjects: Record<string, { name: string; reason: string }[]> = {};

  for (const dim of RADAR_DIMENSIONS) {
    const contributors: { name: string; reason: string }[] = [];

    for (const p of projects) {
      const reasons: string[] = [];

      // Check frameworks from codeSignature
      const frameworks = p.codeSignature?.frameworks || [];
      const matchedFws = frameworks.filter(fw =>
        dim.matchers.frameworks.some(m => fw.toLowerCase().includes(m.toLowerCase()))
      );
      if (matchedFws.length > 0) {
        reasons.push(...matchedFws);
      }

      // Check patterns from codeSignature
      const patterns = p.codeSignature?.patterns || [];
      const matchedPats = patterns.filter(pat =>
        dim.matchers.patterns.some(m => pat.toLowerCase().includes(m.toLowerCase()))
      );
      if (matchedPats.length > 0) {
        reasons.push(...matchedPats);
      }

      // Check tags
      const allTags = [...p.tags, ...p.topics];
      const matchedTags = allTags.filter(tag =>
        dim.matchers.tags.some(m => tag.toLowerCase().includes(m.toLowerCase()))
      );
      if (matchedTags.length > 0) {
        reasons.push(...matchedTags.slice(0, 2));
      }

      // Check language
      if (p.language && dim.matchers.languages.includes(p.language)) {
        if (reasons.length === 0) reasons.push(p.language);
      }

      if (reasons.length > 0) {
        contributors.push({
          name: p.name,
          reason: reasons.slice(0, 3).join(', '),
        });
      }
    }

    scores[dim.key] = contributors.length;
    contributingProjects[dim.key] = contributors;
  }

  return { scores, contributingProjects };
}

// --- SVG Radar Chart ---
interface RadarChartProps {
  dimensions: RadarDimension[];
  scores: Record<string, number>;
  maxScore: number;
  hoveredAxis: string | null;
  onHoverAxis: (key: string | null) => void;
  size: number;
}

function RadarChartSVG({ dimensions, scores, maxScore, hoveredAxis, onHoverAxis, size }: RadarChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.35;
  const n = dimensions.length;
  const angleStep = (2 * Math.PI) / n;

  // Get point for a given axis index and value (0-1 normalized)
  const getPoint = (i: number, value: number) => {
    const angle = i * angleStep - Math.PI / 2;
    return {
      x: cx + Math.cos(angle) * radius * value,
      y: cy + Math.sin(angle) * radius * value,
    };
  };

  // Concentric grid circles (5 levels)
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];

  // Data polygon points
  const dataPoints = dimensions.map((dim, i) => {
    const score = scores[dim.key] || 0;
    const normalized = maxScore > 0 ? score / maxScore : 0;
    return getPoint(i, Math.max(normalized, 0.05)); // minimum visibility
  });
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  // Axis endpoints
  const axisEndpoints = dimensions.map((_, i) => getPoint(i, 1));

  // Label positions (further out from the axis endpoints)
  const labelPositions = dimensions.map((_, i) => getPoint(i, 1.25));

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="overflow-visible"
    >
      <defs>
        {/* Gradient fill for the data polygon */}
        <radialGradient id="radarFill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
          <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.08} />
        </radialGradient>
        {/* Glow filter for data polygon */}
        <filter id="radarGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        {/* Subtle shadow for hovered axis */}
        <filter id="axisGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Grid circles */}
      {gridLevels.map((level, gi) => (
        <circle
          key={gi}
          cx={cx}
          cy={cy}
          r={radius * level}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={1}
        />
      ))}

      {/* Grid lines from center to each axis */}
      {axisEndpoints.map((point, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={point.x}
          y2={point.y}
          stroke={hoveredAxis === dimensions[i].key ? dimensions[i].color + '40' : 'rgba(255,255,255,0.04)'}
          strokeWidth={hoveredAxis === dimensions[i].key ? 1.5 : 1}
          style={{ transition: 'stroke 0.2s, stroke-width 0.2s' }}
        />
      ))}

      {/* Data polygon (filled area) */}
      <motion.path
        d={dataPath}
        fill="url(#radarFill)"
        stroke="url(#radarFill)"
        strokeWidth={2}
        filter="url(#radarGlow)"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      />

      {/* Data polygon border (emerald/teal gradient) */}
      <motion.path
        d={dataPath}
        fill="none"
        stroke="#10b981"
        strokeWidth={2}
        strokeOpacity={0.6}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.3 }}
      />

      {/* Data points on each axis */}
      {dataPoints.map((point, i) => {
        const dim = dimensions[i];
        const isHovered = hoveredAxis === dim.key;
        return (
          <motion.circle
            key={i}
            cx={point.x}
            cy={point.y}
            r={isHovered ? 6 : 4}
            fill={dim.color}
            fillOpacity={isHovered ? 1 : 0.8}
            stroke={dim.color}
            strokeWidth={isHovered ? 3 : 2}
            strokeOpacity={0.4}
            initial={{ r: 0 }}
            animate={{ r: isHovered ? 6 : 4 }}
            transition={{ duration: 0.3 }}
            style={{ cursor: 'pointer', filter: isHovered ? 'url(#axisGlow)' : undefined }}
          />
        );
      })}

      {/* Axis labels with colored dots */}
      {labelPositions.map((pos, i) => {
        const dim = dimensions[i];
        const isHovered = hoveredAxis === dim.key;
        const score = scores[dim.key] || 0;

        // Determine text anchor based on position
        const angle = i * angleStep - Math.PI / 2;
        const textAnchor = Math.abs(Math.cos(angle)) < 0.1 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end';
        const dy = Math.sin(angle) > 0.3 ? 16 : Math.sin(angle) < -0.3 ? -8 : 4;

        return (
          <g
            key={i}
            onMouseEnter={() => onHoverAxis(dim.key)}
            onMouseLeave={() => onHoverAxis(null)}
            style={{ cursor: 'pointer' }}
          >
            {/* Invisible hit area */}
            <circle cx={pos.x} cy={pos.y + dy / 2 - 4} r={20} fill="transparent" />

            {/* Colored dot */}
            <circle
              cx={pos.x - (textAnchor === 'start' ? -2 : textAnchor === 'end' ? 2 : 0)}
              cy={pos.y + dy / 2 - 10}
              r={3}
              fill={dim.color}
              fillOpacity={isHovered ? 1 : 0.6}
            />

            {/* Label text */}
            <text
              x={pos.x}
              y={pos.y + dy / 2}
              textAnchor={textAnchor}
              fill={isHovered ? dim.color : 'rgba(226,232,240,0.6)'}
              fontSize={isHovered ? 12 : 11}
              fontWeight={isHovered ? 600 : 500}
              style={{ transition: 'fill 0.2s, font-size 0.2s' }}
            >
              {dim.icon} {dim.label}
            </text>

            {/* Score */}
            <text
              x={pos.x}
              y={pos.y + dy / 2 + 14}
              textAnchor={textAnchor}
              fill={isHovered ? dim.color : 'rgba(148,163,184,0.4)'}
              fontSize={9}
              fontWeight={isHovered ? 600 : 400}
              style={{ transition: 'fill 0.2s' }}
            >
              {score} project{score !== 1 ? 's' : ''}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// --- Gap Analysis Section ---
function GapAnalysis({
  scores,
  contributingProjects,
  onProjectClick,
}: {
  scores: Record<string, number>;
  contributingProjects: Record<string, { name: string; reason: string }[]>;
  onProjectClick: (name: string) => void;
}) {
  const gaps = RADAR_DIMENSIONS
    .filter(dim => (scores[dim.key] || 0) <= 1)
    .map(dim => ({
      ...dim,
      score: scores[dim.key] || 0,
      projects: contributingProjects[dim.key] || [],
    }));

  if (gaps.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-emerald-500/5 border border-emerald-500/15 rounded-lg p-4 text-center"
      >
        <Target className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
        <p className="text-sm text-emerald-400/80 font-medium">Strong coverage across all dimensions!</p>
        <p className="text-xs text-muted-foreground/40 mt-1">Your portfolio has at least 2 projects in every category.</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
    >
      <h3 className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400/60" />
        Gap Analysis
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {gaps.map((gap, i) => (
          <motion.div
            key={gap.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + i * 0.05 }}
            className="bg-card/30 border border-border/15 rounded-lg p-3 hover:bg-card/50 hover:border-border/30 transition-all"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">{gap.icon}</span>
              <span className="text-sm font-medium text-foreground/80">{gap.label}</span>
              <span
                className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: gap.color + '15', color: gap.color + 'cc' }}
              >
                {gap.score}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground/40 leading-relaxed">
              Consider building a project in this area to diversify your portfolio.
            </p>
            {gap.projects.length > 0 && (
              <div className="mt-2 pt-2 border-t border-border/10">
                <p className="text-[9px] text-muted-foreground/30 mb-1">Current projects:</p>
                {gap.projects.slice(0, 2).map(p => (
                  <button
                    key={p.name}
                    onClick={() => onProjectClick(p.name)}
                    className="flex items-center gap-1 text-[10px] text-foreground/50 hover:text-foreground/80 transition-colors"
                  >
                    <ArrowUpRight className="w-2.5 h-2.5" />
                    {p.name}
                    <span className="text-muted-foreground/30">({p.reason})</span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// --- Legend ---
function RadarLegend({ scores }: { scores: Record<string, number> }) {
  return (
    <div className="flex flex-wrap gap-3 justify-center">
      {RADAR_DIMENSIONS.map((dim) => {
        const score = scores[dim.key] || 0;
        return (
          <div key={dim.key} className="flex items-center gap-1.5 text-[10px]">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: dim.color, opacity: 0.7 }}
            />
            <span className="text-muted-foreground/60">{dim.label}</span>
            <span className="text-foreground/40 font-medium">{score}</span>
          </div>
        );
      })}
    </div>
  );
}

// --- Main Component ---
interface TechRadarProps {
  projects: Project[];
  onProjectClick?: (project: Project) => void;
}

export function TechRadar({ projects, onProjectClick }: TechRadarProps) {
  const [hoveredAxis, setHoveredAxis] = useState<string | null>(null);
  const [chartSize, setChartSize] = useState(420);

  const { scores, contributingProjects } = useMemo(
    () => computeRadarScores(projects),
    [projects]
  );

  const maxScore = useMemo(
    () => Math.max(...Object.values(scores), 1),
    [scores]
  );

  // Responsive size
  const containerRef = (node: HTMLDivElement | null) => {
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        setChartSize(Math.min(Math.max(width - 40, 300), 500));
      }
    });
    observer.observe(node);
  };

  // Find project by name for onProjectClick
  const handleGapProjectClick = (name: string) => {
    const project = projects.find(p => p.name === name);
    if (project && onProjectClick) {
      onProjectClick(project);
    }
  };

  // Hovered axis details
  const hoveredDetails = hoveredAxis ? contributingProjects[hoveredAxis] || [] : [];

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-4">
      <div className="max-w-5xl mx-auto space-y-6" ref={containerRef}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h2 className="text-lg font-bold text-foreground/90 flex items-center gap-2">
              <Target className="w-5 h-5 text-emerald-400" />
              Tech Radar
            </h2>
            <p className="text-xs text-muted-foreground/50 mt-0.5">
              Portfolio skill distribution across {RADAR_DIMENSIONS.length} dimensions
            </p>
          </div>
          <div className="text-xs text-muted-foreground/40">
            Based on {projects.length} projects
          </div>
        </motion.div>

        {/* Radar Chart */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="flex justify-center"
        >
          <RadarChartSVG
            dimensions={RADAR_DIMENSIONS}
            scores={scores}
            maxScore={maxScore}
            hoveredAxis={hoveredAxis}
            onHoverAxis={setHoveredAxis}
            size={chartSize}
          />
        </motion.div>

        {/* Legend */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <RadarLegend scores={scores} />
        </motion.div>

        {/* Hovered Axis Details */}
        <AnimatePresence mode="wait">
          {hoveredAxis && hoveredDetails.length > 0 && (
            <motion.div
              key={hoveredAxis}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="bg-card/30 border border-border/15 rounded-lg p-4"
            >
              <h4 className="text-xs font-medium text-foreground/70 mb-2 flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: RADAR_DIMENSIONS.find(d => d.key === hoveredAxis)?.color,
                  }}
                />
                {RADAR_DIMENSIONS.find(d => d.key === hoveredAxis)?.label} Projects
              </h4>
              <div className="flex flex-wrap gap-2">
                {hoveredDetails.map(p => (
                  <button
                    key={p.name}
                    onClick={() => handleGapProjectClick(p.name)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-card/40 border border-border/10 text-[11px] text-foreground/60 hover:text-foreground hover:border-border/30 transition-all"
                  >
                    {p.name}
                    <span className="text-muted-foreground/30 text-[9px]">({p.reason})</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Gap Analysis */}
        <GapAnalysis
          scores={scores}
          contributingProjects={contributingProjects}
          onProjectClick={handleGapProjectClick}
        />
      </div>
    </div>
  );
}
