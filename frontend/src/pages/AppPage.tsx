import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Excalidraw, exportToBlob } from '@excalidraw/excalidraw';
import { useDiagramStore } from '../store/diagramStore';
import { api } from '../lib/api';
import type { DiagramType } from '../lib/api';
import {
    Lock, Hand, MousePointer2, Square, Diamond, Circle, ArrowRight,
    Minus, Pencil, Type, Image, Eraser, Link2,
    X, Share2, ZoomIn, ZoomOut, RotateCcw, RotateCw,
    Loader2
} from 'lucide-react';

// ──────────────────────────────── Types ────────────────────────────────────

type Tool = 'lock' | 'hand' | 'select' | 'rectangle' | 'diamond' | 'ellipse'
    | 'arrow' | 'line' | 'pen' | 'text' | 'image' | 'eraser' | 'connect';

const DIAGRAM_TYPES: { id: DiagramType; label: string }[] = [
    { id: 'flowchart', label: 'Flowchart' },
    { id: 'architecture', label: 'Architecture' },
    { id: 'sequence', label: 'Sequence' },
    { id: 'component', label: 'Component' },
    { id: 'erd', label: 'ERD' },
    { id: 'c4', label: 'C4 Model' },
];

const QUICK_STARTS = ['JWT auth flow', 'Microservices arch', 'ERD schema'];

const HAMBURGER_ITEMS = [
    { label: 'New diagram', shortcut: 'Ctrl+N' },
    { label: 'Open diagram', shortcut: 'Ctrl+O' },
    null, // separator
    { label: 'Export as PNG', shortcut: '' },
    { label: 'Export as SVG', shortcut: '' },
    null,
    { label: 'Preferences', shortcut: '' },
    { label: 'Keyboard shortcuts', shortcut: '?' },
    null,
    { label: '✦ Go Pro', shortcut: '', highlight: true },
];

// ─────────────────────────── Toolbar icons map ─────────────────────────────

const TOOLBAR_GROUPS: { tools: { id: Tool; icon: React.ReactNode; title: string }[] }[] = [
    {
        tools: [{ id: 'lock', icon: <Lock size={16} />, title: 'Lock (Q)' }],
    },
    {
        tools: [
            { id: 'hand', icon: <Hand size={16} />, title: 'Hand tool (H)' },
            { id: 'select', icon: <MousePointer2 size={16} />, title: 'Selection (V)' },
        ],
    },
    {
        tools: [
            { id: 'rectangle', icon: <Square size={16} />, title: 'Rectangle (R)' },
            { id: 'diamond', icon: <Diamond size={16} />, title: 'Diamond (D)' },
            { id: 'ellipse', icon: <Circle size={16} />, title: 'Ellipse (O)' },
            { id: 'arrow', icon: <ArrowRight size={16} />, title: 'Arrow (A)' },
            { id: 'line', icon: <Minus size={16} />, title: 'Line (L)' },
            { id: 'pen', icon: <Pencil size={16} />, title: 'Draw (P)' },
            { id: 'text', icon: <Type size={16} />, title: 'Text (T)' },
            { id: 'image', icon: <Image size={16} />, title: 'Insert image' },
        ],
    },
    {
        tools: [
            { id: 'eraser', icon: <Eraser size={16} />, title: 'Eraser (E)' },
            { id: 'connect', icon: <Link2 size={16} />, title: 'Connect' },
        ],
    },
];

// ────────────────────────── Keyboard shortcuts modal ───────────────────────

const SHORTCUTS = [
    { keys: ['V'], action: 'Selection tool' },
    { keys: ['H'], action: 'Hand tool' },
    { keys: ['R'], action: 'Rectangle' },
    { keys: ['D'], action: 'Diamond' },
    { keys: ['O'], action: 'Ellipse' },
    { keys: ['A'], action: 'Arrow' },
    { keys: ['L'], action: 'Line' },
    { keys: ['P'], action: 'Draw' },
    { keys: ['T'], action: 'Text' },
    { keys: ['E'], action: 'Eraser' },
    { keys: ['Ctrl', '+'], action: 'Zoom in' },
    { keys: ['Ctrl', '−'], action: 'Zoom out' },
    { keys: ['Ctrl', '0'], action: 'Reset zoom' },
    { keys: ['Ctrl', 'Z'], action: 'Undo' },
    { keys: ['Ctrl', 'Y'], action: 'Redo' },
    { keys: ['Space'], action: 'Pan canvas (hold + drag)' },
];

// ========================== Sub-components ===================================

// ─── Pill Toolbar ────────────────────────────────────────────────────────────

const PillToolbar: React.FC<{
    activeTool: Tool;
    onSelectTool: (t: Tool) => void;
}> = ({ activeTool, onSelectTool }) => (
    <div
        style={{
            position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)',
            zIndex: 100,
            background: '#FFFFFF',
            border: '1px solid #EBEBEB',
            borderRadius: 12,
            padding: '5px 8px',
            height: 44,
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            userSelect: 'none',
        }}
    >
        {TOOLBAR_GROUPS.map((group, gi) => (
            <React.Fragment key={gi}>
                {gi > 0 && (
                    <div style={{ width: 1, height: 20, background: '#EBEBEB', margin: '0 4px', flexShrink: 0 }} />
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {group.tools.map(tool => (
                        <button
                            key={tool.id}
                            title={tool.title}
                            onClick={() => onSelectTool(tool.id)}
                            style={{
                                width: 32, height: 32,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                borderRadius: 8, border: 'none', cursor: 'pointer',
                                background: activeTool === tool.id ? '#F0EEFF' : 'transparent',
                                color: activeTool === tool.id ? '#7C6FF7' : '#666666',
                                transition: 'all 0.15s',
                            }}
                        >
                            {tool.icon}
                        </button>
                    ))}
                </div>
            </React.Fragment>
        ))}
    </div>
);

// ─── Canvas Hint ─────────────────────────────────────────────────────────────

const CanvasHint: React.FC<{ visible: boolean }> = ({ visible }) => (
    <div style={{
        position: 'fixed', top: 64, left: '50%', transform: 'translateX(-50%)',
        zIndex: 90, pointerEvents: 'none',
        fontSize: 12, color: '#AAAAAA',
        display: 'flex', alignItems: 'center', gap: 6,
        opacity: visible ? 1 : 0, transition: 'opacity 0.4s ease',
    }}>
        To move canvas, hold{' '}
        <kbd style={{ background: '#F5F5F5', border: '1px solid #DDDDDD', borderRadius: 4, padding: '1px 5px', fontFamily: 'monospace', fontSize: 11 }}>Scroll wheel</kbd>
        {' '}or{' '}
        <kbd style={{ background: '#F5F5F5', border: '1px solid #DDDDDD', borderRadius: 4, padding: '1px 5px', fontFamily: 'monospace', fontSize: 11 }}>Space</kbd>
        {' '}while dragging, or use the hand tool
    </div>
);

// ─── Hamburger Menu ───────────────────────────────────────────────────────────

const HamburgerMenu: React.FC<{
    open: boolean;
    onToggle: () => void;
    onExport: (fmt: 'png' | 'svg') => void;
}> = ({ open, onToggle, onExport }) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onToggle();
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open, onToggle]);

    return (
        <div ref={ref} style={{ position: 'fixed', top: 12, left: 12, zIndex: 200 }}>
            <button
                onClick={onToggle}
                title="Menu"
                style={{
                    width: 36, height: 36, borderRadius: 8, border: '1px solid #EBEBEB',
                    background: '#FFFFFF', cursor: 'pointer', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 4.5,
                    boxShadow: open ? '0 4px 16px rgba(0,0,0,0.08)' : 'none',
                    transition: 'box-shadow 0.2s',
                }}
            >
                <span style={{ display: 'block', width: 14, height: 1.5, background: '#333', borderRadius: 2 }} />
                <span style={{ display: 'block', width: 14, height: 1.5, background: '#333', borderRadius: 2 }} />
                <span style={{ display: 'block', width: 14, height: 1.5, background: '#333', borderRadius: 2 }} />
            </button>

            {open && (
                <div style={{
                    position: 'absolute', top: 44, left: 0, width: 220,
                    background: '#FFFFFF', border: '1px solid #EBEBEB', borderRadius: 12,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.10)', padding: '6px 0', zIndex: 300,
                    animation: 'fadeIn 0.15s ease-out',
                }}>
                    {HAMBURGER_ITEMS.map((item, i) =>
                        item === null ? (
                            <div key={i} style={{ height: 1, background: '#EBEBEB', margin: '4px 0' }} />
                        ) : (
                            <button
                                key={i}
                                onClick={() => {
                                    if (item.label.includes('PNG')) onExport('png');
                                    else if (item.label.includes('SVG')) onExport('svg');
                                    onToggle();
                                }}
                                style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    width: '100%', padding: '8px 14px', border: 'none', background: 'none',
                                    cursor: 'pointer', fontSize: 13, textAlign: 'left',
                                    color: item.highlight ? '#7C6FF7' : '#222',
                                    fontWeight: item.highlight ? 600 : 400,
                                    borderRadius: 6,
                                    transition: 'background 0.1s',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#F5F5F5')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                            >
                                <span>{item.label}</span>
                                {item.shortcut && <span style={{ fontSize: 11, color: '#AAAAAA' }}>{item.shortcut}</span>}
                            </button>
                        )
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Diagram Title ────────────────────────────────────────────────────────────

const DiagramTitle: React.FC<{
    title: string;
    onChange: (t: string) => void;
}> = ({ title, onChange }) => {
    const [editing, setEditing] = useState(false);
    const [hovered, setHovered] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editing) inputRef.current?.select();
    }, [editing]);

    return (
        <div
            style={{
                position: 'fixed', top: 56, left: 12, zIndex: 150,
                maxWidth: 200, display: 'flex', alignItems: 'center', gap: 4,
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {editing ? (
                <input
                    ref={inputRef}
                    value={title}
                    onChange={e => onChange(e.target.value)}
                    onBlur={() => setEditing(false)}
                    onKeyDown={e => e.key === 'Enter' && setEditing(false)}
                    style={{
                        fontSize: 13, color: '#333', border: '1px solid #7C6FF7', outline: 'none',
                        borderRadius: 6, padding: '2px 6px', width: 170,
                        fontFamily: 'Inter, system-ui, sans-serif',
                    }}
                />
            ) : (
                <span
                    onClick={() => setEditing(true)}
                    title="Click to rename"
                    style={{
                        fontSize: 13, color: '#555', cursor: 'text',
                        maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        padding: '2px 4px', borderRadius: 4,
                        border: '1px solid transparent',
                        transition: 'border-color 0.15s',
                        borderColor: hovered ? '#EBEBEB' : 'transparent',
                    }}
                >
                    {title || 'Untitled Diagram'}
                </span>
            )}
            {hovered && !editing && (
                <span style={{ fontSize: 11, color: '#AAAAAA', cursor: 'text' }} onClick={() => setEditing(true)}>✎</span>
            )}
        </div>
    );
};

// ─── Top Right Actions ────────────────────────────────────────────────────────

const TopRightActions: React.FC<{
    isPro: boolean;
    aiPanelOpen: boolean;
    onTogglePanel: () => void;
}> = ({ isPro, aiPanelOpen, onTogglePanel }) => (
    <div style={{
        position: 'fixed', top: 12, right: 12, zIndex: 150,
        display: 'flex', alignItems: 'center', gap: 8,
    }}>
        {/* Go Pro / Pro badge */}
        <button
            style={{
                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: isPro ? '#F0EEFF' : '#7C6FF7',
                color: isPro ? '#7C6FF7' : '#FFFFFF',
                fontSize: 13, fontWeight: 600,
                transition: 'all 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
            {isPro ? 'Pro ✓' : 'Go Pro'}
        </button>

        {/* Share */}
        <button
            style={{
                padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: '#7C6FF7', color: '#FFFFFF',
                fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 6,
                transition: 'all 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
            <Share2 size={14} />
            Share
        </button>

        {/* AI panel toggle */}
        <button
            onClick={onTogglePanel}
            title="Open AI panel"
            style={{
                width: 36, height: 36, borderRadius: 8,
                border: '1px solid ' + (aiPanelOpen ? '#7C6FF7' : '#EBEBEB'),
                background: aiPanelOpen ? '#F0EEFF' : '#FFFFFF',
                cursor: 'pointer', fontSize: 18, color: aiPanelOpen ? '#7C6FF7' : '#555',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
                if (!aiPanelOpen) e.currentTarget.style.borderColor = '#7C6FF7';
            }}
            onMouseLeave={e => {
                if (!aiPanelOpen) e.currentTarget.style.borderColor = '#EBEBEB';
            }}
        >
            ✦
        </button>
    </div>
);

// ─── AI Slide-in Panel ────────────────────────────────────────────────────────

const AIPanelSlideIn: React.FC<{
    open: boolean;
    onClose: () => void;
    selectedType: DiagramType;
    onSelectType: (t: DiagramType) => void;
    prompt: string;
    onPromptChange: (v: string) => void;
    onGenerate: () => void;
    isGenerating: boolean;
    refinePrompt: string;
    onRefinePromptChange: (v: string) => void;
    onRefine: () => void;
}> = ({
    open, onClose, selectedType, onSelectType,
    prompt, onPromptChange, onGenerate, isGenerating,
    refinePrompt, onRefinePromptChange, onRefine,
}) => (
        <div
            style={{
                position: 'fixed', top: 0, left: 0, height: '100vh',
                width: open ? 280 : 0, zIndex: 180,
                background: '#FFFFFF', borderRight: '1px solid #EBEBEB',
                overflow: 'hidden',
                transition: 'width 0.25s cubic-bezier(0.16,1,0.3,1)',
                boxShadow: open ? '4px 0 20px rgba(0,0,0,0.06)' : 'none',
                display: 'flex', flexDirection: 'column',
            }}
        >
            <div style={{
                width: 280, flex: 1, display: 'flex', flexDirection: 'column',
                padding: 16, overflowY: 'auto', gap: 0,
                opacity: open ? 1 : 0, transition: 'opacity 0.2s',
            }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#111', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: '#7C6FF7' }}>✦</span> Generate diagram
                    </span>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: 4, borderRadius: 6 }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#F5F5F5')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Diagram type */}
                <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                        Diagram type
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        {DIAGRAM_TYPES.map(t => (
                            <button
                                key={t.id}
                                onClick={() => onSelectType(t.id)}
                                style={{
                                    padding: '7px 10px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                                    border: '1px solid ' + (selectedType === t.id ? '#7C6FF7' : '#EBEBEB'),
                                    background: selectedType === t.id ? '#F0EEFF' : '#FAFAFA',
                                    color: selectedType === t.id ? '#7C6FF7' : '#555',
                                    cursor: 'pointer', textAlign: 'left',
                                    transition: 'all 0.12s',
                                }}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: '#F0F0F0', margin: '4px 0 16px' }} />

                {/* Prompt */}
                <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                        Prompt
                    </div>
                    <textarea
                        value={prompt}
                        onChange={e => onPromptChange(e.target.value)}
                        placeholder="Describe the diagram you want to generate..."
                        rows={5}
                        style={{
                            width: '100%', resize: 'vertical', fontSize: 13, color: '#222',
                            border: '1px solid #EBEBEB', borderRadius: 8, padding: '10px 12px',
                            outline: 'none', fontFamily: 'Inter, system-ui, sans-serif',
                            lineHeight: 1.5, boxSizing: 'border-box',
                            transition: 'border-color 0.15s',
                        }}
                        onFocus={e => (e.currentTarget.style.borderColor = '#7C6FF7')}
                        onBlur={e => (e.currentTarget.style.borderColor = '#EBEBEB')}
                    />
                </div>

                <button
                    onClick={onGenerate}
                    disabled={isGenerating || !prompt.trim()}
                    style={{
                        width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
                        background: isGenerating || !prompt.trim() ? '#C5BFFA' : '#7C6FF7',
                        color: '#FFFFFF', fontSize: 13, fontWeight: 600, cursor: isGenerating || !prompt.trim() ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        transition: 'all 0.15s',
                        marginBottom: 20,
                    }}
                >
                    {isGenerating ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating...</> : 'Generate diagram →'}
                </button>

                {/* Divider */}
                <div style={{ height: 1, background: '#F0F0F0', margin: '0 0 16px' }} />

                {/* Refine */}
                <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                        Refine current diagram
                    </div>
                    <textarea
                        value={refinePrompt}
                        onChange={e => onRefinePromptChange(e.target.value)}
                        placeholder="e.g. Add a caching layer between the API and DB..."
                        rows={3}
                        style={{
                            width: '100%', resize: 'vertical', fontSize: 13, color: '#222',
                            border: '1px solid #EBEBEB', borderRadius: 8, padding: '10px 12px',
                            outline: 'none', fontFamily: 'Inter, system-ui, sans-serif',
                            lineHeight: 1.5, boxSizing: 'border-box', marginBottom: 10,
                            transition: 'border-color 0.15s',
                        }}
                        onFocus={e => (e.currentTarget.style.borderColor = '#7C6FF7')}
                        onBlur={e => (e.currentTarget.style.borderColor = '#EBEBEB')}
                    />
                    <button
                        onClick={onRefine}
                        disabled={!refinePrompt.trim()}
                        style={{
                            width: '100%', padding: '9px 0', borderRadius: 8, border: '1px solid #7C6FF7',
                            background: 'transparent', color: '#7C6FF7',
                            fontSize: 13, fontWeight: 600, cursor: refinePrompt.trim() ? 'pointer' : 'not-allowed',
                            opacity: refinePrompt.trim() ? 1 : 0.5,
                            transition: 'all 0.15s',
                        }}
                    >
                        Apply →
                    </button>
                </div>
            </div>
        </div>
    );

// ─── Empty State: Hand-drawn annotations ──────────────────────────────────────

const HandDrawnAnnotation: React.FC<{
    style?: React.CSSProperties;
    arrowChar: string;
    lines: string[];
}> = ({ style, arrowChar, lines }) => (
    <div style={{
        position: 'fixed', pointerEvents: 'none', zIndex: 60,
        fontFamily: "'Caveat', cursive",
        fontSize: 15, color: '#AAAAAA', lineHeight: 1.4,
        ...style,
    }}>
        <div>{arrowChar}</div>
        {lines.map((l, i) => <div key={i}>{l}</div>)}
    </div>
);

// ─── Center Empty State: SketchAI prompt entry ────────────────────────────────

const CenterEmptyState: React.FC<{
    prompt: string;
    onPromptChange: (v: string) => void;
    onGenerate: () => void;
    isGenerating: boolean;
}> = ({ prompt, onPromptChange, onGenerate, isGenerating }) => (
    <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 70, width: 480, textAlign: 'center', pointerEvents: 'all',
    }}>
        <div style={{ fontSize: 15, color: '#7C6FF7', fontWeight: 500, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <span>✦</span> SketchAI
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 500, color: '#111', marginBottom: 20, margin: '0 0 16px' }}>
            Generate a diagram from a description
        </h2>

        {/* Inline prompt input + generate button */}
        <div style={{
            display: 'flex', alignItems: 'stretch',
            border: '1px solid #EBEBEB', borderRadius: 8, overflow: 'hidden',
            background: '#FFFFFF', boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
            marginBottom: 12,
        }}>
            <input
                type="text"
                value={prompt}
                onChange={e => onPromptChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && onGenerate()}
                placeholder="Describe what you want to build..."
                style={{
                    flex: 1, height: 44, padding: '0 14px', fontSize: 14,
                    border: 'none', outline: 'none', color: '#222',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    background: 'transparent',
                }}
            />
            <button
                onClick={onGenerate}
                disabled={isGenerating || !prompt.trim()}
                style={{
                    padding: '0 18px', height: 44, background: '#7C6FF7', color: '#FFFFFF',
                    border: 'none', cursor: isGenerating || !prompt.trim() ? 'not-allowed' : 'pointer',
                    fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'background 0.15s', flexShrink: 0,
                    borderRadius: '0 8px 8px 0',
                    opacity: isGenerating || !prompt.trim() ? 0.6 : 1,
                }}
            >
                {isGenerating
                    ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    : 'Generate →'
                }
            </button>
        </div>

        {/* Quick starts */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#AAAAAA', marginRight: 2 }}>Quick start:</span>
            {QUICK_STARTS.map(q => (
                <button
                    key={q}
                    onClick={() => onPromptChange(q)}
                    style={{
                        background: '#F5F5F5', color: '#555', borderRadius: 20,
                        fontSize: 12, padding: '4px 12px', border: 'none',
                        cursor: 'pointer', transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#EBEAFF')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#F5F5F5')}
                >
                    {q}
                </button>
            ))}
        </div>
    </div>
);

// ─── Zoom Controls ────────────────────────────────────────────────────────────

const ZoomControls: React.FC<{
    zoom: number;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onZoomReset: () => void;
    onUndo: () => void;
    onRedo: () => void;
}> = ({ zoom, onZoomIn, onZoomOut, onZoomReset, onUndo, onRedo }) => {
    const btnStyle: React.CSSProperties = {
        width: 30, height: 34, background: 'none', border: 'none',
        cursor: 'pointer', color: '#555', display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontSize: 14,
        transition: 'background 0.1s', borderRadius: 4,
    };

    return (
        <div style={{
            position: 'fixed', bottom: 16, left: 16, zIndex: 150,
            display: 'flex', alignItems: 'center', gap: 2,
            background: '#FFFFFF', border: '1px solid #EBEBEB',
            borderRadius: 8, padding: '0 2px', height: 36,
        }}>
            <button style={btnStyle} onClick={onZoomOut} title="Zoom out (Ctrl−)"
                onMouseEnter={e => (e.currentTarget.style.background = '#F5F5F5')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                <ZoomOut size={14} />
            </button>
            <button
                style={{ ...btnStyle, width: 48, fontSize: 12, fontWeight: 600, color: '#333' }}
                onClick={onZoomReset} title="Reset zoom (Ctrl+0)"
                onMouseEnter={e => (e.currentTarget.style.background = '#F5F5F5')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                {Math.round(zoom * 100)}%
            </button>
            <button style={btnStyle} onClick={onZoomIn} title="Zoom in (Ctrl+)"
                onMouseEnter={e => (e.currentTarget.style.background = '#F5F5F5')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                <ZoomIn size={14} />
            </button>

            {/* Divider */}
            <div style={{ width: 1, height: 20, background: '#EBEBEB', margin: '0 2px' }} />

            {/* Undo */}
            <button style={btnStyle} onClick={onUndo} title="Undo (Ctrl+Z)"
                onMouseEnter={e => (e.currentTarget.style.background = '#F5F5F5')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                <RotateCcw size={14} />
            </button>
            {/* Redo */}
            <button style={btnStyle} onClick={onRedo} title="Redo (Ctrl+Y)"
                onMouseEnter={e => (e.currentTarget.style.background = '#F5F5F5')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                <RotateCw size={14} />
            </button>
        </div>
    );
};

// ─── Usage Indicator ──────────────────────────────────────────────────────────

const UsageIndicator: React.FC<{ used: number; total: number; isPro: boolean }> = ({ used, total, isPro }) => {
    if (isPro) return null;
    return (
        <div style={{
            position: 'fixed', bottom: 22, left: '50%', transform: 'translateX(-50%)',
            zIndex: 140, fontSize: 11, color: '#AAAAAA', whiteSpace: 'nowrap',
            pointerEvents: 'all',
        }}>
            {used} / {total} diagrams this month &nbsp;·&nbsp;
            <span
                style={{ color: '#7C6FF7', cursor: 'pointer', textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
            >
                Go Pro for unlimited
            </span>
        </div>
    );
};

// ─── Shortcuts Button & Modal ─────────────────────────────────────────────────

const ShortcutsButton: React.FC<{
    showAnnotation: boolean;
    onDismiss: () => void;
}> = ({ showAnnotation, onDismiss }) => {
    const [open, setOpen] = useState(false);

    return (
        <>
            {/* Annotation */}
            {showAnnotation && (
                <div style={{
                    position: 'fixed', bottom: 60, right: 28, zIndex: 140,
                    pointerEvents: 'none', fontFamily: "'Caveat', cursive",
                    fontSize: 14, color: '#AAAAAA', textAlign: 'right',
                }}>
                    <div>Shortcuts &</div>
                    <div>help</div>
                    <div style={{ marginTop: 4, transform: 'rotate(15deg)', display: 'inline-block' }}>↓</div>
                </div>
            )}

            {/* ? button */}
            <button
                onClick={() => { setOpen(true); onDismiss(); }}
                title="Keyboard shortcuts"
                style={{
                    position: 'fixed', bottom: 16, right: 16, zIndex: 150,
                    width: 36, height: 36, borderRadius: '50%',
                    background: '#FFFFFF', border: '1px solid #EBEBEB',
                    cursor: 'pointer', fontSize: 15, color: '#666',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s', fontWeight: 600,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F5F5F5')}
                onMouseLeave={e => (e.currentTarget.style.background = '#FFFFFF')}
            >
                ?
            </button>

            {/* Modal */}
            {open && (
                <div
                    onClick={() => setOpen(false)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 400,
                        background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: '#FFF', borderRadius: 16, padding: 28, width: 420,
                            boxShadow: '0 24px 60px rgba(0,0,0,0.18)', maxHeight: '80vh', overflowY: 'auto',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111', margin: 0 }}>Keyboard Shortcuts</h3>
                            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}>
                                <X size={18} />
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {SHORTCUTS.map((s, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                                    <span style={{ color: '#555' }}>{s.action}</span>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        {s.keys.map((k, j) => (
                                            <kbd key={j} style={{
                                                background: '#F5F5F5', border: '1px solid #DDDDDD',
                                                borderRadius: 4, padding: '2px 7px',
                                                fontFamily: 'monospace', fontSize: 11, color: '#333',
                                            }}>{k}</kbd>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

// ==================== Main Page Component ====================================

export const AppPage: React.FC = () => {
    const {
        currentDiagram, setCurrentDiagram,
        isGenerating, setIsGenerating,
        selectedType, setSelectedType,
        prompt, setPrompt,
        title, setTitle,
    } = useDiagramStore();

    // UI state
    const [activeTool, setActiveTool] = useState<Tool>('select');
    const [menuOpen, setMenuOpen] = useState(false);
    const [aiPanelOpen, setAiPanelOpen] = useState(true);
    const [refinePrompt, setRefinePrompt] = useState('');
    const [hasElements, setHasElements] = useState(false);
    const [hintVisible, setHintVisible] = useState(true);
    const [showHelpAnnotation, setShowHelpAnnotation] = useState(true);
    const [zoom, setZoom] = useState(1);

    const excalidrawRef = useRef<any>(null);

    // ── Generate diagram ──────────────────────────────────────────────────────
    const handleGenerate = useCallback(async () => {
        if (!prompt.trim() || isGenerating) return;
        setIsGenerating(true);
        try {
            const { diagram } = await api.generateDiagram({
                prompt, diagram_type: selectedType,
                title: title !== 'Untitled Diagram' ? title : undefined,
            });
            setCurrentDiagram(diagram.canvas_json);
            if (excalidrawRef.current) {
                excalidrawRef.current.updateScene({ elements: diagram.canvas_json.elements });
                setHasElements(diagram.canvas_json.elements?.length > 0);
            }
        } catch {
            alert('Generation failed. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    }, [prompt, isGenerating, selectedType, title, setCurrentDiagram, setIsGenerating]);

    // ── Refine diagram ────────────────────────────────────────────────────────
    const handleRefine = useCallback(async () => {
        if (!refinePrompt.trim() || isGenerating) return;
        const combined = `${prompt}\n\nRefinement: ${refinePrompt}`;
        setPrompt(combined);
        setRefinePrompt('');
        // Trigger generate with combined prompt
        setIsGenerating(true);
        try {
            const { diagram } = await api.generateDiagram({
                prompt: combined, diagram_type: selectedType,
                title: title !== 'Untitled Diagram' ? title : undefined,
            });
            setCurrentDiagram(diagram.canvas_json);
            if (excalidrawRef.current) {
                excalidrawRef.current.updateScene({ elements: diagram.canvas_json.elements });
                setHasElements(diagram.canvas_json.elements?.length > 0);
            }
        } catch {
            alert('Refinement failed. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    }, [refinePrompt, isGenerating, prompt, selectedType, title, setCurrentDiagram, setIsGenerating, setPrompt]);

    // ── Export ────────────────────────────────────────────────────────────────
    const handleExport = useCallback(async (format: 'png' | 'svg') => {
        if (!excalidrawRef.current) return;
        const elements = excalidrawRef.current.getSceneElements();
        if (!elements.length) return;
        const blob = await exportToBlob({
            elements, files: null,
            mimeType: format === 'png' ? 'image/png' : 'image/svg+xml',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = `${title}.${format}`; link.click();
    }, [title]);

    // ── Zoom helpers ──────────────────────────────────────────────────────────
    const handleZoomIn = () => {
        if (!excalidrawRef.current) return;
        const newZoom = Math.min(zoom + 0.1, 5);
        excalidrawRef.current.updateScene({ appState: { zoom: { value: newZoom } } });
        setZoom(newZoom);
    };
    const handleZoomOut = () => {
        if (!excalidrawRef.current) return;
        const newZoom = Math.max(zoom - 0.1, 0.1);
        excalidrawRef.current.updateScene({ appState: { zoom: { value: newZoom } } });
        setZoom(newZoom);
    };
    const handleZoomReset = () => {
        if (!excalidrawRef.current) return;
        excalidrawRef.current.updateScene({ appState: { zoom: { value: 1 } } });
        setZoom(1);
    };

    const handleUndo = () => excalidrawRef.current?.history?.undo?.();
    const handleRedo = () => excalidrawRef.current?.history?.redo?.();

    // ── Hide hint after first canvas interaction ───────────────────────────────
    const handleCanvasInteraction = useCallback(() => {
        if (hintVisible) setHintVisible(false);
    }, [hintVisible]);

    // ── Keyboard shortcut: Ctrl+Z/Y passthrough ───────────────────────────────
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') handleUndo();
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) handleRedo();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const showEmptyAnnotations = !hasElements && !isGenerating;

    return (
        <div style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>

            {/* ── Canvas Background ────────────────────────────────────────── */}
            <div
                style={{
                    position: 'fixed', inset: 0, zIndex: 0,
                    backgroundColor: '#FFFFFF',
                    backgroundImage: 'radial-gradient(circle, #D8D8D8 1px, transparent 1px)',
                    backgroundSize: '20px 20px',
                }}
            />

            {/* ── Excalidraw (z-index 10) ──────────────────────────────────── */}
            <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={handleCanvasInteraction}>
                <Excalidraw
                    excalidrawAPI={(api) => (excalidrawRef.current = api)}
                    initialData={{
                        elements: currentDiagram?.elements || [],
                        appState: {
                            viewBackgroundColor: 'transparent',
                            currentItemFontFamily: 2,
                        },
                    }}
                    UIOptions={{
                        canvasActions: {
                            loadScene: false,
                            export: false,
                            saveToActiveFile: false,
                            toggleTheme: false,
                            clearCanvas: false,
                        },
                        dockedSidebarBreakpoint: undefined,
                    }}
                    onChange={(elements, appState) => {
                        if (appState.zoom?.value) setZoom(appState.zoom.value);
                        if (elements.length > 0 && !hasElements) setHasElements(true);
                    }}
                />
            </div>

            {/* ── AI Slide-in Panel (z-index 180) ─────────────────────────── */}
            <AIPanelSlideIn
                open={aiPanelOpen}
                onClose={() => setAiPanelOpen(false)}
                selectedType={selectedType}
                onSelectType={setSelectedType}
                prompt={prompt}
                onPromptChange={setPrompt}
                onGenerate={handleGenerate}
                isGenerating={isGenerating}
                refinePrompt={refinePrompt}
                onRefinePromptChange={setRefinePrompt}
                onRefine={handleRefine}
            />

            {/* ── Hamburger Menu (z-index 200) ─────────────────────────────── */}
            <HamburgerMenu
                open={menuOpen}
                onToggle={() => setMenuOpen(p => !p)}
                onExport={handleExport}
            />

            {/* ── Diagram Title (z-index 150) ──────────────────────────────── */}
            <DiagramTitle title={title} onChange={setTitle} />

            {/* ── Pill Toolbar (z-index 100) ───────────────────────────────── */}
            <PillToolbar activeTool={activeTool} onSelectTool={setActiveTool} />

            {/* ── Canvas Hint (z-index 90) ─────────────────────────────────── */}
            <CanvasHint visible={hintVisible} />

            {/* ── Top Right Actions (z-index 150) ─────────────────────────── */}
            <TopRightActions
                isPro={false}
                aiPanelOpen={aiPanelOpen}
                onTogglePanel={() => setAiPanelOpen(p => !p)}
            />

            {/* ── Empty State Annotations (z-index 60) ────────────────────── */}
            {showEmptyAnnotations && (
                <>
                    {/* Top-left annotation — pointing to hamburger */}
                    <HandDrawnAnnotation
                        style={{ top: 60, left: 16 }}
                        arrowChar="↖"
                        lines={['Export, preferences,', 'languages, ...']}
                    />

                </>
            )}


            {/* ── Zoom Controls (z-index 150) ──────────────────────────────── */}
            <ZoomControls
                zoom={zoom}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onZoomReset={handleZoomReset}
                onUndo={handleUndo}
                onRedo={handleRedo}
            />

            {/* ── Usage Indicator (z-index 140) ────────────────────────────── */}
            <UsageIndicator used={8} total={15} isPro={false} />

            {/* ── Shortcuts Button (z-index 150) ───────────────────────────── */}
            <ShortcutsButton
                showAnnotation={showHelpAnnotation}
                onDismiss={() => setShowHelpAnnotation(false)}
            />

            {/* ── Generating Overlay (z-index 500) ─────────────────────────── */}
            {isGenerating && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 500,
                    background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(2px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: 'fadeIn 0.3s ease-out',
                }}>
                    <div style={{
                        background: '#FFFFFF', borderRadius: 16, padding: '36px 40px',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.12)', border: '1px solid #EBEBEB',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
                        textAlign: 'center',
                    }}>
                        <div style={{ position: 'relative', width: 48, height: 48 }}>
                            <Loader2 size={48} color="#7C6FF7" style={{ animation: 'spin 1s linear infinite' }} />
                            <div style={{
                                position: 'absolute', inset: 0, borderRadius: '50%',
                                background: 'rgba(124,111,247,0.15)',
                                animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
                            }} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111', margin: '0 0 4px' }}>Generating Diagram...</h3>
                            <p style={{ fontSize: 13, color: '#888', margin: 0 }}>Claude is sketching your architecture</p>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Inline spin & ping keyframes ─────────────────────────────── */}
            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes ping { 75%, 100% { transform: scale(2); opacity: 0; } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            `}</style>
        </div>
    );
};
