import React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: "solid" | "outline" | "ghost" | "primary" | "pro" | "team";
}

export const Badge: React.FC<BadgeProps> = ({ children, className, variant = "solid", ...props }) => {
    const variants = {
        solid: "bg-slate-800 text-slate-200 border-transparent",
        outline: "bg-transparent text-slate-400 border-slate-700",
        ghost: "bg-transparent text-slate-500 border-transparent",
        primary: "bg-primary/20 text-primary border-primary/20",
        pro: "bg-gradient-to-r from-violet-600/20 to-indigo-600/20 text-violet-400 border-violet-500/30",
        team: "bg-gradient-to-r from-emerald-600/20 to-teal-600/20 text-emerald-400 border-emerald-500/30",
    };

    return (
        <div
            className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                variants[variant],
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
};

interface UsageMeterProps {
    used: number;
    total: number;
    label?: string;
    className?: string;
}

export const UsageMeter: React.FC<UsageMeterProps> = ({ used, total, label = "Usage this month", className }) => {
    const percentage = Math.min((used / total) * 100, 100);

    return (
        <div className={cn("w-full space-y-2", className)}>
            <div className="flex justify-between items-center text-xs font-medium">
                <span className="text-slate-600">{label}</span>
                <span className="text-slate-500">{used} of {total} diagrams</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                    className={cn(
                        "h-full transition-all duration-500 ease-out rounded-full bg-primary",
                        percentage > 90 && "bg-red-500",
                        percentage > 70 && percentage <= 90 && "bg-amber-500"
                    )}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
};
