import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '../components/ui/Button';
import {
    Zap,
    PenTool,
    Layers,
    Share2,
    ArrowRight,
    Database,
    Network,
    Boxes,
    GitBranch,
    MessageSquare,
    MousePointer,
    Download,
    Star,
} from 'lucide-react';

// Animation Variants
const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.6, ease: "easeOut" }
    }
} as any;

const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.2
        }
    }
} as any;

const floatAnimation = {
    initial: { y: 0 },
    animate: {
        y: [0, -10, 0],
        transition: {
            duration: 4,
            ease: "easeInOut",
            repeat: Infinity
        }
    }
} as any;

// Hero Diagram Showcase — Using the high-fidelity user-provided diagram with motion
function DiagramShowcase() {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="w-full h-full bg-white relative overflow-hidden group border border-[#EBEBEB] rounded-xl shadow-xl"
        >
            {/* Dot Grid Pattern Overlay */}
            <div
                className="absolute inset-0 pointer-events-none opacity-40"
                style={{
                    backgroundImage: 'radial-gradient(circle, #D0D0D0 1px, transparent 1px)',
                    backgroundSize: '24px 24px'
                }}
            />

            {/* The real diagram — scrollable with a gentle float */}
            <motion.div
                variants={floatAnimation}
                initial="initial"
                animate="animate"
                className="w-full h-full overflow-y-auto overflow-x-hidden p-8 scrollbar-hide"
            >
                <img
                    src="/hero-diagram.png"
                    alt="SketchAI Authentication Flow Diagram"
                    className="w-full h-auto rounded-lg shadow-sm border border-[#EBEBEB]"
                />
            </motion.div>

            {/* Hint for interaction */}
            <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm border border-[#EBEBEB] px-3 py-1.5 rounded-full text-[11px] font-medium text-[#666666] shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                Interactive SketchAI Output
            </div>
        </motion.div>
    );
}

// ─── Showcase data ────────────────────────────────────────────────────────────
const showcaseExamples = [
    {
        id: 0,
        title: "Authentication Flow",
        desc: "Secure multi-factor authentication with OAuth2 and OIDC.",
        prompt: "draw a secure authentication flow with MFA, OAuth2, and OIDC",
        img: "/hero-diagram.png",
        accentColor: "#F43F5E",
    },
    {
        id: 1,
        title: "ML Compilation Pipeline",
        desc: "Complex node-branching with heterogeneous targets.",
        prompt: "draw an ML compiler pipeline with IR optimization passes and multi-target backends",
        img: "/temp1.png",
        accentColor: "#6366F1",
    },
    {
        id: 2,
        title: "LLM Agent Orchestration",
        desc: "Deeply nested grouping and multi-step tool integration.",
        prompt: "orchestration workflow for LLM agents with multi-step tool use and nested grouping",
        img: "/temp2.png",
        accentColor: "#8B5CF6",
    },
    {
        id: 3,
        title: "E-commerce Microservices",
        desc: "Scalable distributed architecture with domain separation.",
        prompt: "draw a microservices architecture for an e-commerce platform",
        img: "/temp3.png",
        accentColor: "#06B6D4",
    },
    {
        id: 4,
        title: "Payment Service Internals",
        desc: "High-fidelity class diagram for transaction processing.",
        prompt: "show the internal structure of a payment service — charge, refund, webhook handler",
        img: "/temp4.png",
        accentColor: "#10B981",
    },
    {
        id: 5,
        title: "Ride-sharing Data Schema",
        desc: "Entity-relationship model for scalable logistics.",
        prompt: "show a schema for a ride-sharing app with drivers, riders, trips, and payments",
        img: "/temp5.png",
        accentColor: "#F59E0B",
    },
];

// ─── ShowcaseDeck Component — Rotational Playing-card Fan ────────────────────
const CARD_W = 420;
const CARD_H = 580;
const PIVOT_Y = 650; // Pivot point relative to card top

function ShowcaseDeck() {
    const [activeId, setActiveId] = useState<number>(0);
    const [hoveredId, setHoveredId] = useState<number | null>(null);

    return (
        <div className="relative w-full h-[700px] flex items-center justify-center overflow-hidden pt-10 px-4 select-none">
            {/* The fan container - pivot is bottom center */}
            <div className="relative w-full max-w-4xl h-full flex items-center justify-center">
                {showcaseExamples.map((ex, idx) => {
                    const isActive = ex.id === activeId;
                    const isHovered = ex.id === hoveredId;

                    // The "prominent" card is the one being hovered, or the active one if nothing is hovered
                    const effectiveActiveId = hoveredId ?? activeId;
                    const isProminent = ex.id === effectiveActiveId;

                    // Find effective active index
                    const effIdx = showcaseExamples.findIndex(e => e.id === effectiveActiveId);

                    // Calculate rotation: Spread from the prominent card
                    const rotate = (idx - effIdx) * 12;

                    // Prominent card pops up, others stay down
                    const y = isProminent ? -100 : 20;

                    // Z-index: hovered > active > others
                    const zIdx = isHovered ? 60 : (isActive ? 50 : 10 + Math.abs(idx - effIdx) * -1);

                    return (
                        <motion.div
                            key={ex.id}
                            initial={false}
                            animate={{
                                rotate,
                                y,
                                x: (idx - effIdx) * 30,
                                zIndex: zIdx,
                                scale: isProminent ? 1.05 : 0.92,
                                opacity: (hoveredId !== null && !isHovered) ? 0.7 : 1
                            }}
                            transition={{ type: "spring", stiffness: 260, damping: 25 }}
                            onMouseEnter={() => setHoveredId(ex.id)}
                            onMouseLeave={() => setHoveredId(null)}
                            onClick={() => setActiveId(ex.id)}
                            className={`absolute w-[${CARD_W}px] h-[${CARD_H}px] rounded-[24px] border border-[#E4E4E4] bg-white shadow-xl cursor-pointer
                                transition-all duration-300 overflow-hidden
                                ${isProminent ? "border-[#C4BCFC] shadow-[0_32px_64px_-16px_rgba(124,111,247,0.3)]" : "hover:border-[#C4BCFC] shadow-lg"}
                            `}
                            style={{
                                transformOrigin: `center ${PIVOT_Y}px`,
                                width: CARD_W,
                                height: CARD_H,
                                bottom: 0
                            }}
                        >
                            {/* Card Header (Strip) */}
                            <div className="p-6 flex items-center gap-4 border-b border-[#F0F0F0]">
                                <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                    style={{ backgroundColor: ex.accentColor }}
                                >
                                    {ex.id}
                                </div>
                                <div className="flex flex-col">
                                    <h4 className="font-bold text-[#111111] leading-tight">{ex.title}</h4>
                                    <p className="text-[11px] text-[#777777] font-medium">{ex.description}</p>
                                </div>
                                {isActive && (
                                    <div
                                        className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold text-white uppercase tracking-wider scale-90"
                                        style={{ backgroundColor: ex.accentColor }}
                                    >
                                        Selected
                                    </div>
                                )}
                            </div>

                            {/* Card Content - Visible when prominent */}
                            <div className="p-6 space-y-6 overflow-y-auto" style={{ height: CARD_H - 80 }}>
                                {/* Prompt Box */}
                                <div className="bg-[#F8F7FF] border border-[#EDE9FE] rounded-xl p-4 font-mono text-xs">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-2 h-2 rounded-full bg-purple-400" />
                                        <span className="font-bold text-[#6D28D9]">technical prompt</span>
                                    </div>
                                    <p className="text-[#555555] italic leading-relaxed">"{ex.prompt}"</p>
                                </div>

                                {/* Diagram Graphic Container */}
                                <div className="relative aspect-[16/10] bg-[#FAFAFA] rounded-xl border border-[#F0F0F0] overflow-hidden group">
                                    {/* Grid Overlay */}
                                    <div
                                        className="absolute inset-0 pointer-events-none opacity-[0.03]"
                                        style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '16px 16px' }}
                                    />
                                    <img
                                        src={ex.img}
                                        alt={ex.title}
                                        className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-700"
                                    />
                                </div>

                                {/* Feature Tags */}
                                <div className="flex flex-wrap gap-2 pt-2">
                                    {['architecture', 'technical', 'exportable'].map(tag => (
                                        <span key={tag} className="text-[10px] font-bold text-[#999999] uppercase border border-[#EEEEEE] px-2 py-1 rounded">
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}



const features = [
    {
        icon: <Zap className="h-6 w-6" />,
        title: "Unlimited Requests",
        desc: "Don't let daily quotas kill your flow. Pro and Team plans offer uncapped AI generations, no rate limits.",
    },
    {
        icon: <PenTool className="h-6 w-6" />,
        title: "Whiteboard-style Output",
        desc: "Whiteboard-style diagrams that look human, not corporate. The aesthetic that invites collaboration instead of ending conversation.",
    },
    {
        icon: <Layers className="h-6 w-6" />,
        title: "Deep Tech Vocabulary",
        desc: "C4 models, ERDs, sequence diagrams, architecture flows — the AI knows software engineering vocabulary, not just shapes and arrows.",
    },
    {
        icon: <Share2 className="h-6 w-6" />,
        title: "One-Click Export",
        desc: "Ready for your README. Copy clean SVG, export high-res PNG, or push directly to Notion and GitHub.",
    },
];

const steps = [
    {
        icon: <MessageSquare className="h-6 w-6" />,
        title: "Type a prompt",
        desc: "Describe your system in plain English. As much or as little detail as you want.",
    },
    {
        icon: <MousePointer className="h-6 w-6" />,
        title: "Choose a diagram type",
        desc: "Pick from flowcharts, architecture maps, ERDs, C4 models, and more.",
    },
    {
        icon: <Download className="h-6 w-6" />,
        title: "Edit and export",
        desc: "Drag, resize, and annotate. Export as SVG or PNG when you're done.",
    },
];

const diagramTypes = [
    { icon: <GitBranch />, name: "Flowcharts", desc: "Decision trees and process flows" },
    { icon: <Network />, name: "Architecture", desc: "System and infrastructure maps" },
    { icon: <GitBranch />, name: "Sequences", desc: "Time-ordered interactions between systems and actors" },
    { icon: <Boxes />, name: "Components", desc: "Software modules and their relationships" },
    { icon: <Database />, name: "ERDs", desc: "Entity-relationship data models" },
    { icon: <Layers />, name: "C4 Models", desc: "Container and context diagrams" },
];

export const LandingPage: React.FC = () => {
    return (
        <div className="min-h-screen bg-white text-[#111111] selection:bg-primary/20 overflow-x-hidden">
            {/* Background Moving Elements (Subtle) */}
            <div className="fixed inset-0 pointer-events-none opacity-20 -z-10">
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        rotate: [0, 5, 0],
                        x: [0, 50, 0],
                        y: [0, 30, 0]
                    }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full"
                />
                <motion.div
                    animate={{
                        scale: [1, 1.1, 1],
                        rotate: [0, -5, 0],
                        x: [0, -40, 0],
                        y: [0, -20, 0]
                    }}
                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                    className="absolute bottom-[-5%] right-[-5%] w-[35%] h-[35%] bg-accent/20 blur-[100px] rounded-full"
                />
            </div>

            {/* Navigation */}
            <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-[#EBEBEB]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2"
                    >
                        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-sm">
                            <PenTool className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-xl font-bold tracking-tight text-[#111111]">SketchAI</span>
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-6"
                    >
                        <Link to="/login" className="text-sm font-medium text-[#555555] hover:text-[#111111] transition-colors">
                            Log in
                        </Link>
                        <Button size="sm" className="bg-[#7C6FF7] hover:bg-[#6B5FE6] text-white">
                            <Link to="/register">Get Started</Link>
                        </Button>
                    </motion.div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="pt-32 pb-20 px-4">
                <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                    className="max-w-5xl mx-auto text-center space-y-8"
                >
                    <motion.div
                        variants={fadeIn}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EEF0FF] border border-[#C4BCFC] text-[#7C6FF7] text-xs font-semibold"
                    >
                        <Zap className="h-3 w-3" />
                        Now in public beta
                    </motion.div>

                    <motion.h1
                        variants={fadeIn}
                        className="text-5xl md:text-7xl font-extrabold tracking-tight leading-tight text-[#111111]"
                    >
                        From plain English to diagrams <br />
                        <span className="text-[#7C6FF7]">in under 10 seconds.</span>
                    </motion.h1>

                    <motion.p
                        variants={fadeIn}
                        className="text-lg md:text-xl text-[#555555] max-w-xl mx-auto"
                    >
                        Built for engineers who think faster than they draw or illustrate.
                    </motion.p>

                    <motion.div
                        variants={fadeIn}
                        className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
                    >
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                            <Button size="lg" className="bg-[#7C6FF7] hover:bg-[#6B5FE6] text-white w-full sm:w-auto group">
                                <Link to="/register" className="flex items-center">
                                    Start drawing for free
                                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                </Link>
                            </Button>
                        </motion.div>
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                            <Button
                                size="lg"
                                variant="outline"
                                className="bg-white border-[#CCCCCC] text-[#333333] hover:bg-[#F5F5F5] w-full sm:w-auto"
                            >
                                View live examples
                            </Button>
                        </motion.div>
                    </motion.div>

                    <motion.div
                        variants={fadeIn}
                        className="flex items-center justify-center gap-2 pt-2 text-[#888888] text-[13px]"
                    >
                        <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <Star key={i} className="h-3.5 w-3.5 fill-[#F5A623] text-[#F5A623]" />
                            ))}
                        </div>
                        Trusted by 500+ engineers
                    </motion.div>
                </motion.div>

                {/* Hero Diagram Preview (Dynamic Showcase) */}
                <div className="mt-16 max-w-5xl mx-auto animate-slide-up">
                    <div className="aspect-[16/9] w-full relative">
                        <DiagramShowcase />
                    </div>
                </div>
            </section>

            {/* Example Showcase Gallery — Expandable Card Deck */}
            <section className="py-24 px-4 bg-white">
                <div className="max-w-5xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center mb-16"
                    >
                        <h2 className="text-3xl md:text-5xl font-bold text-[#111111] mb-6">Designed for deep technical depth.</h2>
                        <p className="text-[#666666] text-lg max-w-2xl mx-auto">
                            From ML compilers to LLM orchestrators. SketchAI handles the complexity
                            of real-world engineering architecture.
                        </p>
                    </motion.div>

                    <ShowcaseDeck />
                </div>
            </section>


            {/* How It Works */}
            < motion.section
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={staggerContainer}
                className="py-20 px-4 border-y border-[#EBEBEB] bg-[#FAFAFA]"
            >
                <div className="max-w-5xl mx-auto">
                    <div className="grid md:grid-cols-3 gap-12 text-center">
                        {steps.map((step, i) => (
                            <motion.div
                                key={i}
                                variants={fadeIn}
                                className="flex flex-col items-center gap-4 group"
                            >
                                <motion.div
                                    whileInView={{ scale: [0.8, 1.1, 1] }}
                                    className="w-12 h-12 rounded-full bg-[#EEF0FF] flex items-center justify-center text-[#7C6FF7] font-bold text-lg"
                                >
                                    {i + 1}
                                </motion.div>
                                <div>
                                    <h3 className="text-lg font-bold text-[#111111] mb-1">{step.title}</h3>
                                    <p className="text-[#666666] text-sm leading-relaxed">{step.desc}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </motion.section >

            {/* Features Section */}
            < section className="py-24 px-4 relative" >
                <div className="max-w-5xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center mb-16"
                    >
                        <h2 className="text-3xl md:text-4xl font-bold text-[#111111] mb-4">Built for engineering velocity.</h2>
                        <p className="text-[#666666]">Everything you need. Nothing you don't.</p>
                    </motion.div>

                    <motion.div
                        variants={staggerContainer}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: "-100px" }}
                        className="grid md:grid-cols-2 gap-8"
                    >
                        {features.map((feature, i) => (
                            <motion.div
                                key={i}
                                variants={fadeIn}
                                whileHover={{ y: -8, transition: { duration: 0.2 } }}
                                className="p-8 rounded-2xl bg-[#FAFAFA] border border-[#EBEBEB] hover:border-[#C4BCFC] hover:shadow-xl hover:shadow-primary/5 transition-all group cursor-default"
                            >
                                <div className="w-12 h-12 rounded-xl bg-[#EEF0FF] flex items-center justify-center text-[#7C6FF7] mb-6 transition-transform group-hover:scale-110">
                                    {feature.icon}
                                </div>
                                <h3 className="text-xl font-bold text-[#111111] mb-3">{feature.title}</h3>
                                <p className="text-[#666666] leading-relaxed">{feature.desc}</p>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section >

            {/* Diagram Types */}
            < section className="py-20 px-4 bg-[#FAFAFA] border-t border-[#EBEBEB]" >
                <div className="max-w-7xl mx-auto space-y-12">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        className="text-center"
                    >
                        <h2 className="text-3xl md:text-4xl font-bold text-[#111111] mb-4">Every diagram type your team actually uses.</h2>
                        <p className="text-[#666666] max-w-2xl mx-auto">Six diagram types. All generated from plain English.</p>
                    </motion.div>

                    <motion.div
                        variants={staggerContainer}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"
                    >
                        {diagramTypes.map((type, i) => (
                            <motion.div
                                key={i}
                                variants={fadeIn}
                                whileHover={{ y: -5, borderColor: "#7C6FF7" }}
                                className="p-6 rounded-xl bg-white border border-[#EBEBEB] transition-all flex flex-col items-center gap-3 group cursor-default shadow-sm"
                            >
                                <div className="text-[#7C6FF7] transition-transform group-hover:scale-110">{type.icon}</div>
                                <div className="text-center">
                                    <span className="block text-sm font-bold text-[#333333] mb-1">{type.name}</span>
                                    <span className="block text-[11px] text-[#666666] leading-tight">{type.desc}</span>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section >

            {/* Footer */}
            < footer className="py-16 bg-[#FAFAFA] border-t border-[#EBEBEB]" >
                <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shadow-sm">
                            <PenTool className="h-4 w-4 text-white" />
                        </div>
                        <span className="font-bold tracking-tight text-[#111111]">SketchAI</span>
                    </div>
                    <p className="text-sm text-[#888888]">© 2026 SketchAI. Built with Rust and React.</p>
                    <div className="flex flex-wrap justify-center gap-6 md:gap-8 text-sm font-medium">
                        <Link to="/docs" target="_blank" rel="noopener noreferrer" className="text-[#666666] hover:text-[#111111] transition-colors">Docs</Link>
                        <Link to="/pricing" className="text-[#666666] hover:text-[#111111] transition-colors">Pricing</Link>
                        <a href="https://github.com/SketchAI" target="_blank" rel="noopener noreferrer" className="text-[#666666] hover:text-[#111111] transition-colors">GitHub</a>
                        <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="text-[#666666] hover:text-[#111111] transition-colors">Privacy</Link>
                        <Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-[#666666] hover:text-[#111111] transition-colors">Terms</Link>
                        <a href="https://twitter.com/SketchAI" target="_blank" rel="noopener noreferrer" className="text-[#666666] hover:text-[#111111] transition-colors">Twitter</a>
                    </div>
                </div>
            </footer >
        </div >
    );
};
