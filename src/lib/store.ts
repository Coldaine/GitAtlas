import { create } from 'zustand';
import { Project, AnalysisJob, ViewMode, GraphLayout, NodeSizeBy, ColorBy } from './types';

interface AtlasState {
  username: string;
  projects: Project[];
  analysisJob: AnalysisJob | null;
  isLoading: boolean;
  isAnalyzing: boolean;
  fetchProgress: string;
  analyzeProgress: string;
  viewMode: ViewMode;
  selectedProject: Project | null;
  searchQuery: string;
  activeTags: string[];
  detailOpen: boolean;
  isDataLoaded: boolean;
  isDeepAnalyzing: boolean;
  deepAnalyzeProgress: string;

  // Graph settings
  graphLayout: GraphLayout;
  nodeSizeBy: NodeSizeBy;
  colorBy: ColorBy;
  edgeThreshold: number;
  showParticles: boolean;
  showClusterBackgrounds: boolean;
  showHealthRings: boolean;
  showDependencyEdges: boolean;
  animationSpeed: number;
  showEdgeLabels: boolean;

  // Concept group filters
  activeConceptGroups: string[];

  // Setters
  setUsername: (u: string) => void;
  setProjects: (p: Project[]) => void;
  setAnalysisJob: (j: AnalysisJob | null) => void;
  setLoading: (l: boolean) => void;
  setAnalyzing: (a: boolean) => void;
  setFetchProgress: (p: string) => void;
  setAnalyzeProgress: (p: string) => void;
  setViewMode: (v: ViewMode) => void;
  setSelectedProject: (p: Project | null) => void;
  setSearchQuery: (q: string) => void;
  toggleTag: (t: string) => void;
  setActiveTags: (t: string[]) => void;
  setDetailOpen: (o: boolean) => void;
  setDataLoaded: (l: boolean) => void;
  setDeepAnalyzing: (v: boolean) => void;
  setDeepAnalyzeProgress: (v: string) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;

  // Graph settings setters
  setGraphLayout: (v: GraphLayout) => void;
  setNodeSizeBy: (v: NodeSizeBy) => void;
  setColorBy: (v: ColorBy) => void;
  setEdgeThreshold: (v: number) => void;
  setShowParticles: (v: boolean) => void;
  setShowClusterBackgrounds: (v: boolean) => void;
  setShowHealthRings: (v: boolean) => void;
  setShowDependencyEdges: (v: boolean) => void;
  setAnimationSpeed: (v: number) => void;
  setShowEdgeLabels: (v: boolean) => void;

  // Concept group setters
  toggleConceptGroup: (g: string) => void;
  setActiveConceptGroups: (g: string[]) => void;
}

export const useAtlasStore = create<AtlasState>((set) => ({
  username: 'Coldaine',
  projects: [],
  analysisJob: null,
  isLoading: true,
  isAnalyzing: false,
  fetchProgress: '',
  analyzeProgress: '',
  viewMode: 'graph',
  selectedProject: null,
  searchQuery: '',
  activeTags: [],
  detailOpen: false,
  isDataLoaded: false,
  isDeepAnalyzing: false,
  deepAnalyzeProgress: '',

  // Graph settings defaults
  graphLayout: 'force',
  nodeSizeBy: 'default',
  colorBy: 'category',
  edgeThreshold: 2,
  showParticles: true,
  showClusterBackgrounds: true,
  showHealthRings: true,
  showDependencyEdges: true,
  animationSpeed: 1,
  showEdgeLabels: true,

  // Concept group defaults
  activeConceptGroups: [],

  setUsername: (u) => set({ username: u }),
  setProjects: (p) => set({ projects: p }),
  setAnalysisJob: (j) => set({ analysisJob: j }),
  setLoading: (l) => set({ isLoading: l }),
  setAnalyzing: (a) => set({ isAnalyzing: a }),
  setFetchProgress: (p) => set({ fetchProgress: p }),
  setAnalyzeProgress: (p) => set({ analyzeProgress: p }),
  setViewMode: (v) => set({ viewMode: v }),
  setSelectedProject: (p) => set({ selectedProject: p, detailOpen: !!p }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  toggleTag: (t) =>
    set((state) => ({
      activeTags: state.activeTags.includes(t)
        ? state.activeTags.filter((x) => x !== t)
        : [...state.activeTags, t],
    })),
  setActiveTags: (t) => set({ activeTags: t }),
  setDetailOpen: (o) => set({ detailOpen: o }),
  setDataLoaded: (l) => set({ isDataLoaded: l }),
  setDeepAnalyzing: (v) => set({ isDeepAnalyzing: v }),
  setDeepAnalyzeProgress: (v) => set({ deepAnalyzeProgress: v }),
  updateProject: (id, updates) =>
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
      selectedProject:
        state.selectedProject?.id === id
          ? { ...state.selectedProject, ...updates }
          : state.selectedProject,
    })),

  // Graph settings setters
  setGraphLayout: (v) => set({ graphLayout: v }),
  setNodeSizeBy: (v) => set({ nodeSizeBy: v }),
  setColorBy: (v) => set({ colorBy: v }),
  setEdgeThreshold: (v) => set({ edgeThreshold: v }),
  setShowParticles: (v) => set({ showParticles: v }),
  setShowClusterBackgrounds: (v) => set({ showClusterBackgrounds: v }),
  setShowHealthRings: (v) => set({ showHealthRings: v }),
  setShowDependencyEdges: (v) => set({ showDependencyEdges: v }),
  setAnimationSpeed: (v) => set({ animationSpeed: v }),
  setShowEdgeLabels: (v) => set({ showEdgeLabels: v }),

  // Concept group setters
  toggleConceptGroup: (g) =>
    set((state) => ({
      activeConceptGroups: state.activeConceptGroups.includes(g)
        ? state.activeConceptGroups.filter((x) => x !== g)
        : [...state.activeConceptGroups, g],
    })),
  setActiveConceptGroups: (g) => set({ activeConceptGroups: g }),
}));
