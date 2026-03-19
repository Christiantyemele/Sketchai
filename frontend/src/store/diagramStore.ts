import { create } from 'zustand';
import type { DiagramType } from '../lib/api';

interface DiagramState {
    currentDiagram: any | null;
    isGenerating: boolean;
    selectedType: DiagramType;
    prompt: string;
    title: string;

    setCurrentDiagram: (diagram: any | null) => void;
    setIsGenerating: (isGenerating: boolean) => void;
    setSelectedType: (type: DiagramType) => void;
    setPrompt: (prompt: string) => void;
    setTitle: (title: string) => void;
    reset: () => void;
}

export const useDiagramStore = create<DiagramState>((set) => ({
    currentDiagram: null,
    isGenerating: false,
    selectedType: 'architecture',
    prompt: '',
    title: 'Untitled Diagram',

    setCurrentDiagram: (currentDiagram) => set({ currentDiagram }),
    setIsGenerating: (isGenerating) => set({ isGenerating }),
    setSelectedType: (selectedType) => set({ selectedType }),
    setPrompt: (prompt) => set({ prompt }),
    setTitle: (title) => set({ title }),
    reset: () => set({
        currentDiagram: null,
        isGenerating: false,
        selectedType: 'architecture',
        prompt: '',
        title: 'Untitled Diagram'
    }),
}));
