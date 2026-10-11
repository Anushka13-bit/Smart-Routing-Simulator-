// src/components/common/StatCard.tsx
import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  variant?: 'cyan' | 'blue' | 'emerald' | 'violet' | 'rose' | 'amber';
  badge?: string;
  trend?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtext,
  icon: Icon,
  variant = 'cyan',
  badge,
  trend,
}) => {
  const colorMap = {
    cyan: {
      border: 'border-cyan-500/20 hover:border-cyan-500/50',
      bgGlow: 'bg-cyan-500/10 text-cyan-400',
      valueColor: 'text-white',
      accentGlow: 'shadow-glow-cyan/10',
    },
    blue: {
      border: 'border-blue-500/20 hover:border-blue-500/50',
      bgGlow: 'bg-blue-500/10 text-blue-400',
      valueColor: 'text-white',
      accentGlow: 'shadow-glow-blue/10',
    },
    emerald: {
      border: 'border-emerald-500/20 hover:border-emerald-500/50',
      bgGlow: 'bg-emerald-500/10 text-emerald-400',
      valueColor: 'text-emerald-300',
      accentGlow: 'shadow-glow-emerald/10',
    },
    violet: {
      border: 'border-violet-500/20 hover:border-violet-500/50',
      bgGlow: 'bg-violet-500/10 text-violet-400',
      valueColor: 'text-violet-300',
      accentGlow: 'shadow-glow-violet/10',
    },
    rose: {
      border: 'border-rose-500/20 hover:border-rose-500/50',
      bgGlow: 'bg-rose-500/10 text-rose-400',
      valueColor: 'text-rose-300',
      accentGlow: 'shadow-glow-rose/10',
    },
    amber: {
      border: 'border-amber-500/20 hover:border-amber-500/50',
      bgGlow: 'bg-amber-500/10 text-amber-400',
      valueColor: 'text-amber-300',
      accentGlow: 'shadow-glow-amber/10',
    },
  };

  const style = colorMap[variant];

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-slate-900/80 backdrop-blur-md border ${style.border} p-5 transition-all duration-300 hover:shadow-xl ${style.accentGlow}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
            {label}
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight ${style.valueColor}`}>
              {value}
            </span>
            {trend && (
              <span className="text-xs font-mono text-emerald-400">{trend}</span>
            )}
          </div>
          {subtext && (
            <p className="mt-1.5 text-xs text-slate-400">{subtext}</p>
          )}
        </div>

        <div className={`p-3 rounded-xl ${style.bgGlow}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {badge && (
        <div className="mt-3 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700">
          <span>{badge}</span>
        </div>
      )}
    </div>
  );
};
