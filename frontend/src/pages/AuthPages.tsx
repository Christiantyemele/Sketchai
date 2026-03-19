import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import {
    PenTool,
    Mail,
    Lock,
    UserPlus,
    LogIn,
    Github,
    Chrome,
    AlertCircle
} from 'lucide-react';

export const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            setError(error.message);
            setLoading(false);
        } else {
            navigate('/app');
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
            {/* Background blobs */}
            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px]" />
            <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px]" />

            <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
                <Link to="/" className="flex items-center justify-center gap-3 mb-8 group">
                    <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform duration-300">
                        <PenTool className="h-6 w-6" />
                    </div>
                    <span className="text-3xl font-extrabold tracking-tight text-slate-900">SketchAI</span>
                </Link>
                <div className="card p-8 md:p-10">
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
                        <p className="mt-2 text-sm text-slate-600">Sign in to your account to continue</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex gap-3 text-red-400 text-sm animate-shake">
                            <AlertCircle className="h-5 w-5 flex-shrink-0" />
                            <p>{error}</p>
                        </div>
                    )}

                    <form className="space-y-6" onSubmit={handleLogin}>
                        <Input
                            label="Email Address"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="name@company.com"
                            leftIcon={<Mail className="h-4 w-4" />}
                        />
                        <Input
                            label="Password"
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            leftIcon={<Lock className="h-4 w-4" />}
                        />

                        <div className="flex items-center justify-end">
                            <Link to="#" className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
                                Forgot password?
                            </Link>
                        </div>

                        <Button type="submit" size="lg" className="w-full" isLoading={loading} rightIcon={<LogIn className="h-4 w-4" />}>
                            Sign In
                        </Button>
                    </form>

                    <div className="mt-8 relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-200"></div>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-surface px-4 text-slate-500 font-bold tracking-widest">Or continue with</span>
                        </div>
                    </div>

                    <div className="mt-8 grid grid-cols-2 gap-4">
                        <Button variant="outline" className="w-full" leftIcon={<Github className="h-4 w-4" />}>GitHub</Button>
                        <Button variant="outline" className="w-full" leftIcon={<Chrome className="h-4 w-4" />}>Google</Button>
                    </div>

                    <p className="mt-10 text-center text-sm text-slate-600 font-medium">
                        Don't have an account?{' '}
                        <Link to="/register" className="text-primary hover:text-primary/80 transition-colors font-bold">
                            Sign up free
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export const RegisterPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }
        setLoading(true);
        setError(null);
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) {
            setError(error.message);
            setLoading(false);
        } else {
            navigate('/login?registered=true');
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 -translate-y-1/2 -translate-x-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px]" />
            <div className="absolute bottom-0 right-0 translate-y-1/2 translate-x-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px]" />

            <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
                <Link to="/" className="flex items-center justify-center gap-3 mb-8 group">
                    <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform duration-300">
                        <PenTool className="h-6 w-6" />
                    </div>
                    <span className="text-3xl font-extrabold tracking-tight text-slate-900">SketchAI</span>
                </Link>
                <div className="card p-8 md:p-10">
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-slate-900">Create account</h2>
                        <p className="mt-2 text-sm text-slate-600">Start building smarter diagrams today</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex gap-3 text-red-400 text-sm animate-shake">
                            <AlertCircle className="h-5 w-5 flex-shrink-0" />
                            <p>{error}</p>
                        </div>
                    )}

                    <form className="space-y-5" onSubmit={handleRegister}>
                        <Input
                            label="Email Address"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="name@company.com"
                            leftIcon={<Mail className="h-4 w-4" />}
                        />
                        <Input
                            label="Password"
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            leftIcon={<Lock className="h-4 w-4" />}
                        />
                        <Input
                            label="Confirm Password"
                            type="password"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            leftIcon={<Lock className="h-4 w-4" />}
                        />

                        <div className="items-center flex gap-2 py-2">
                            <input type="checkbox" required className="rounded border-slate-300 bg-white text-primary focus:ring-primary/20" />
                            <span className="text-xs text-slate-600">I agree to the <Link to="/terms" className="text-primary hover:underline">Terms</Link> and <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link></span>
                        </div>

                        <Button type="submit" size="lg" className="w-full" isLoading={loading} rightIcon={<UserPlus className="h-4 w-4" />}>
                            Create Account
                        </Button>
                    </form>

                    <p className="mt-10 text-center text-sm text-slate-600 font-medium">
                        Already have an account?{' '}
                        <Link to="/login" className="text-primary hover:text-primary/80 transition-colors font-bold">
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};
