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
  detailOpen: boolean;
  isDataLoaded: boolean;

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
}));
