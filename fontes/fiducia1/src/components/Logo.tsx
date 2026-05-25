import React from 'react';

export function Logo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
      aria-label="Fiducia Logo"
    >
      {/* Haste Principal (Fiducia Blue) */}
      <rect x="4" y="3" width="5" height="18" rx="2.5" fill="#185FA5" />
      {/* Braço Superior (Fiducia Green) */}
      <rect x="11" y="3" width="10" height="5" rx="2.5" fill="#1D9E75" />
      {/* Braço Central (Fiducia Teal) */}
      <rect x="11" y="10" width="6" height="5" rx="2.5" fill="#0D9488" />
    </svg>
  );
}
