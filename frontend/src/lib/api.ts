import { supabase } from './supabase';

export type DiagramType = 'flowchart' | 'architecture' | 'sequence' | 'component' | 'erd' | 'c4';

export interface Diagram {
    id: string;
    title: string;
    prompt: string;
    diagram_type: DiagramType;
    canvas_json: any;
    created_at: string;
}

export interface UserProfile {
    id: string;
    email: string;
    plan: 'free' | 'pro' | 'team';
    usage: {
        month: string;
        diagrams_generated: number;
        limit: number | null;
    };
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8088';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const headers = new Headers(options.headers);
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }
    headers.set('Content-Type', 'application/json');

    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'API request failed');
    }

    if (response.status === 204) return {} as T;

    const { data } = await response.json();
    return data as T;
}

export const api = {
    generateDiagram: (payload: { prompt: string; diagram_type: DiagramType; title?: string }) =>
        request<{ diagram: Diagram }>('/diagrams/generate', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),

    getDiagrams: (params: { limit?: number; offset?: number; type?: string } = {}) => {
        const query = new URLSearchParams(params as any).toString();
        return request<{ diagrams: Diagram[]; total: number }>(`/diagrams?${query}`);
    },

    getDiagram: (id: string) =>
        request<{ diagram: Diagram }>(`/diagrams/${id}`),

    deleteDiagram: (id: string) =>
        request<void>(`/diagrams/${id}`, { method: 'DELETE' }),

    getMe: () =>
        request<{ user: UserProfile }>('/users/me'),
};
