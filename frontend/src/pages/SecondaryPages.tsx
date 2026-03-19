import React from 'react';
import { Navbar } from '../components/Navbar';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import {
    History as HistoryIcon,
    Search,
    Trash2,
    Clock,
    Check,
    Zap,
    ChevronRight
} from 'lucide-react';
import { api } from '../lib/api';
import type { Diagram } from '../lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

export const HistoryPage: React.FC = () => {
    const queryClient = useQueryClient();
    const { data, isLoading } = useQuery({
        queryKey: ['diagrams'],
        queryFn: () => api.getDiagrams(),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.deleteDiagram(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['diagrams'] }),
    });

    return (
        <div className="min-h-screen bg-background text-slate-100 flex flex-col">
            <Navbar />
            <main className="flex-1 pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-3">
                            <HistoryIcon className="h-8 w-8 text-primary" />
                            Diagram History
                        </h1>
                        <p className="text-slate-400 mt-1">Manage and revisit your previously generated diagrams</p>
                    </div>
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search diagrams..."
                            className="w-full bg-surface border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="card h-64 animate-pulse bg-surface/50" />
                        ))}
                    </div>
                ) : data?.diagrams.length === 0 ? (
                    <div className="card p-12 text-center space-y-4">
                        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-500">
                            <HistoryIcon className="h-8 w-8" />
                        </div>
                        <h3 className="text-xl font-semibold">No diagrams found</h3>
                        <p className="text-slate-400">Start by creating your first diagram from the dashboard</p>
                        <Button>
                            <Link to="/app">Create Diagram</Link>
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {data?.diagrams.map((diagram: Diagram) => (
                            <div key={diagram.id} className="card group hover:border-primary/30 transition-all">
                                <div className="h-48 bg-slate-900 border-b border-white/5 relative flex items-center justify-center overflow-hidden">
                                    {/* Placeholder for real canvas thumbnail */}
                                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:20px_20px] opacity-20" />
                                    <Badge variant="outline" className="z-10 bg-background/50 backdrop-blur-sm uppercase tracking-wider">{diagram.diagram_type}</Badge>
                                </div>
                                <div className="p-4 flex flex-col gap-4">
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-bold text-slate-200 truncate pr-4">{diagram.title}</h3>
                                        <button
                                            onClick={() => deleteMutation.mutate(diagram.id)}
                                            className="text-slate-500 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                                            <Clock className="h-3.5 w-3.5" />
                                            {new Date(diagram.created_at).toLocaleDateString()}
                                        </div>
                                        <Link to="/app">
                                            <Button size="sm" variant="ghost" className="text-xs group/btn">
                                                Open <ChevronRight className="ml-1 h-3.5 w-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export const PricingPage: React.FC = () => {
    const plans = [
        {
            name: 'Free',
            price: '$0',
            description: 'Perfect for side projects and individual engineers.',
            features: [
                '15 diagram generations / month',
                'Basic layout models',
                'Standard Excalidraw export',
                'Public community access',
            ],
            cta: 'Current Plan',
            variant: 'secondary' as const,
            current: true,
        },
        {
            name: 'Pro',
            price: '$9',
            period: '/month',
            description: 'Built for high-velocity software professionals.',
            features: [
                'Unlimited diagram generations',
                'Priority Claude access (Sonnet 3.5)',
                'Private diagrams & history',
                'SVG and High-res PNG export',
                'Early access to new features',
            ],
            cta: 'Upgrade to Pro',
            variant: 'primary' as const,
            highlight: true,
            popular: true,
        },
        {
            name: 'Team',
            price: '$19',
            period: '/user/month',
            description: 'Collaborative features for engineering squads.',
            features: [
                'Everything in Pro',
                'Shared team workspace & library',
                'Team-wide diagram search',
                'Admin dashboard & usage audit',
                'SAML SSO integration',
            ],
            cta: 'Contact Sales',
            variant: 'secondary' as const,
        },
    ];

    return (
        <div className="min-h-screen bg-background text-slate-100">
            <Navbar />
            <main className="pt-32 pb-20 px-4 max-w-7xl mx-auto">
                <div className="text-center space-y-4 mb-16 animate-fade-in">
                    <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">Simple, transparent pricing.</h1>
                    <p className="text-lg text-slate-400 max-w-2xl mx-auto">Choose the plan that fits your workflow. Upgrade or downgrade anytime.</p>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                    {plans.map((plan, i) => (
                        <div
                            key={i}
                            className={`
                card flex flex-col p-8 relative
                ${plan.highlight ? 'border-primary ring-2 ring-primary/20 bg-surface' : 'bg-surface/50'}
              `}
                        >
                            {plan.popular && (
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-lg">
                                    Most Popular
                                </div>
                            )}

                            <div className="mb-8">
                                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-extrabold">{plan.price}</span>
                                    {plan.period && <span className="text-slate-500 font-medium">{plan.period}</span>}
                                </div>
                                <p className="text-slate-400 text-sm mt-4 leading-relaxed">{plan.description}</p>
                            </div>

                            <div className="flex-1 space-y-4 mb-8">
                                {plan.features.map((feature, idx) => (
                                    <div key={idx} className="flex items-start gap-3">
                                        <div className="mt-1 w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                            <Check className="h-3 w-3 text-primary" />
                                        </div>
                                        <span className="text-sm text-slate-300">{feature}</span>
                                    </div>
                                ))}
                            </div>

                            <Button variant={plan.variant} size="lg" className="w-full" disabled={plan.current}>
                                {plan.cta}
                            </Button>
                        </div>
                    ))}
                </div>

                {/* Crypto Promotion */}
                <div className="mt-16 card p-8 bg-gradient-to-br from-background to-surface border-indigo-500/10 flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                            <Zap className="h-8 w-8" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold mb-1">Pay with Crypto</h3>
                            <p className="text-slate-400 text-sm max-w-md">Prefer paying with BTC, ETH, or USDC? We support Web3 payments via NOWPayments for Pro and Team subscriptions.</p>
                        </div>
                    </div>
                    <Button variant="outline" size="lg">Pay with Crypto</Button>
                </div>
            </main>
        </div>
    );
};
