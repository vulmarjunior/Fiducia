import React from 'react';

interface FiduciaLogoProps {
  size?: number;
  className?: string;
  withText?: boolean;
}

export const FiduciaLogo: React.FC<FiduciaLogoProps> = ({ size = 36, className = '', withText = false }) => {
  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Dynamic Graphic SVG element */}
      <div 
        className="relative group flex items-center justify-center transition-transform duration-300 hover:scale-105"
        style={{ width: size, height: size }}
      >
        {/* Glow effect backdrop blur (for a premium glowing mesh gradient feel when hovered) */}
        <div className="absolute inset-0 bg-gradient-to-tr from-emerald-400 via-cyan-500 to-blue-600 rounded-xl blur-[6px] opacity-25 group-hover:opacity-40 transition-opacity duration-300" />
        
        {/* Main Logo Card */}
        <div className="relative w-full h-full bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center overflow-hidden shadow-md">
          <svg
            viewBox="0 0 100 100"
            className="w-8/12 h-8/12 text-emerald-400 fill-none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="logo-fluid-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="50%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
              <filter id="logo-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
            {/* Elegant continuous line: abstract security shield + exponential trend line inside. */}
            <path
              d="M20,30 L50,15 L80,30 L80,55 C80,75 50,90 50,90 C50,90 20,75 20,55 Z"
              stroke="url(#logo-fluid-grad)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-20 translate-y-[-2px] scale-95 origin-center text-slate-800"
            />
            {/* The active dynamic trend ribbon wrapping into a monogram F */}
            <path
              d="M30,35 H70 M30,52 H60 M30,35 V75"
              stroke="url(#logo-fluid-grad)"
              strokeWidth="11"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="drop-shadow-[0_2px_4px_rgba(16,185,129,0.3)] transition-all duration-300 group-hover:stroke-cyan-300"
            />
            {/* Upward growing dot represent growth trend */}
            <circle
              cx="70"
              cy="35"
              r="6.5"
              fill="#10b981"
              className="animate-pulse"
            />
          </svg>
        </div>
      </div>
      
      {withText && (
        <span className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight select-none flex items-center gap-1.5 duration-200">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500">
            Fidúcia
          </span>
          <span className="text-[10px] font-bold tracking-widest text-[#10b981] uppercase bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20 leading-none">
            v2.0
          </span>
        </span>
      )}
    </div>
  );
};
