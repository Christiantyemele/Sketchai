import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Badge } from './ui/Badge';
import {
    PenTool,
    User,
    Settings,
    LogOut,
    ChevronDown,
    History,
    CreditCard,
    LayoutDashboard,
    Crown
} from 'lucide-react';

export const Navbar: React.FC = () => {
    const { user, signOut } = useAuth();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const location = useLocation();

    // TODO: Get actual plan from user metadata
    const userPlan: 'free' | 'pro' | 'team' = 'free';
    const isPro = userPlan === 'pro' || userPlan === 'team';

    const navLinks = [
        { name: 'Dashboard', path: '/app', icon: <LayoutDashboard className="h-4 w-4" /> },
        { name: 'History', path: '/history', icon: <History className="h-4 w-4" /> },
    ];

    return (
        <nav className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-xl fixed top-0 w-full z-40 px-4">
            <div className="max-w-[1800px] mx-auto h-full flex items-center justify-between">
                <div className="flex items-center gap-8">
                    <Link to="/" className="flex items-center gap-2 group">
                        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                            <PenTool className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-xl font-bold tracking-tight text-slate-900 hidden sm:block">SketchAI</span>
                    </Link>

                    <div className="hidden md:flex items-center gap-1">
                        {navLinks.map((link) => (
                            <Link
                                key={link.path}
                                to={link.path}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${location.pathname === link.path
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                                    }`}
                            >
                                {link.icon}
                                {link.name}
                            </Link>
                        ))}
                        {!isPro && (
                            <Link
                                to="/pricing"
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
                            >
                                <Crown className="h-4 w-4" />
                                Upgrade
                            </Link>
                        )}
                        {isPro && (
                            <Link
                                to="/settings/billing"
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                            >
                                <CreditCard className="h-4 w-4" />
                                Billing
                            </Link>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative">
                        <button
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/10">
                                <User className="h-4 w-4" />
                            </div>
                            <div className="hidden sm:block text-left">
                                <p className="text-xs font-semibold text-slate-900 truncate max-w-[120px]">
                                    {user?.email?.split('@')[0]}
                                </p>
                                <div className="flex items-center gap-1.5">
                                    <span className={`text-[10px] font-bold tracking-wide ${isPro ? 'text-primary' : 'text-slate-500'}`}>
                                        {isPro ? 'PRO' : 'FREE'}
                                    </span>
                                    <span className="text-[10px] text-slate-400">Plan</span>
                                </div>
                            </div>
                            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isDropdownOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setIsDropdownOpen(false)}
                                />
                                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white border border-slate-200 shadow-xl z-50 py-2 animate-fade-in">
                                    <div className="px-4 py-2 border-b border-slate-100 mb-2">
                                        <p className="text-sm font-medium text-slate-900 truncate">{user?.email}</p>
                                        <Badge variant={isPro ? 'pro' : 'primary'} className="mt-1">
                                            {isPro ? 'Pro Tier' : 'Free Tier'}
                                        </Badge>
                                    </div>

                                    <Link
                                        to="/settings"
                                        className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                                        onClick={() => setIsDropdownOpen(false)}
                                    >
                                        <Settings className="h-4 w-4" />
                                        Settings
                                    </Link>

                                    {!isPro && (
                                        <Link
                                            to="/pricing"
                                            className="flex items-center gap-2 px-4 py-2 text-sm text-primary hover:bg-primary/5 transition-colors"
                                            onClick={() => setIsDropdownOpen(false)}
                                        >
                                            <Crown className="h-4 w-4" />
                                            Upgrade to Pro
                                        </Link>
                                    )}

                                    <button
                                        onClick={() => {
                                            signOut();
                                            setIsDropdownOpen(false);
                                        }}
                                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                                    >
                                        <LogOut className="h-4 w-4" />
                                        Log Out
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
};
