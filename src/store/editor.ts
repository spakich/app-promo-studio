import { create } from 'zustand';
import { Project, Screenshot, Template } from '../lib/types';

interface EditorStore {
  // Project state
  project: Project | null;
  screenshots: Screenshot[];
  selectedTemplate: Template | null;
  format: 'horizontal' | 'vertical' | 'square';

  // Actions
  setProject: (p: Project) => void;
  addScreenshot: (s: Screenshot) => void;
  removeScreenshot: (id: string) => void;
  reorderScreenshots: (from: number, to: number) => void;
  updateScreenshot: (id: string, patch: Partial<Screenshot>) => void;
  setTemplate: (t: Template) => void;
  setFormat: (f: 'horizontal' | 'vertical' | 'square') => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
  project: null,
  screenshots: [],
  selectedTemplate: null,
  format: 'horizontal',

  setProject: (p) => set({ project: p }),
  addScreenshot: (s) => set((st) => ({ screenshots: [...st.screenshots, s] })),
  removeScreenshot: (id) =>
    set((st) => ({ screenshots: st.screenshots.filter((s) => s.id !== id) })),
  reorderScreenshots: (from, to) =>
    set((st) => {
      const arr = [...st.screenshots];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return { screenshots: arr };
    }),
  updateScreenshot: (id, patch) =>
    set((st) => ({
      screenshots: st.screenshots.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    })),
  setTemplate: (t) => set({ selectedTemplate: t }),
  setFormat: (f) => set({ format: f }),
}));
