import { create } from 'zustand';
import { Project, AnalysisJob, ViewMode } from './types';

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
  sidebarOpen: boolean;
  detailOpen: boolean;

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
  setSidebarOpen: (o: boolean) => void;
  setDetailOpen: (o: boolean) => void;
}

export const useAtlasStore = create<AtlasState>((set) => ({
  username: '',
  projects: [],
  analysisJob: null,
  isLoading: false,
  isAnalyzing: false,
  fetchProgress: '',
  analyzeProgress: '',
  viewMode: 'graph',
  selectedProject: null,
  searchQuery: '',
  activeTags: [],
  sidebarOpen: true,
  detailOpen: false,

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
  setSidebarOpen: (o) => set({ sidebarOpen: o }),
  setDetailOpen: (o) => set({ detailOpen: o }),
}));
