
import React, { useEffect, useState } from 'react';

interface AlienAvatarProps {
  isSpeaking: boolean;
  volume: number;
  status: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';
}

export const AlienAvatar: React.FC<AlienAvatarProps> = ({ isSpeaking, volume, status }) => {
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 120);
    }, 3500 + Math.random() * 4000);
    return () => clearInterval(blinkInterval);
  }, []);

  // Normalize volume for visual scale (avg volume is usually 10-60)
  const mouthScale = isSpeaking ? Math.min(1.2, 0.1 + (volume / 45)) : 0.05;
  const antennaPulse = isSpeaking ? 1 + (volume / 100) : 1;
  const headBob = isSpeaking ? `translateY(${Math.sin(Date.now() / 100) * 2}px)` : 'none';
  
  const glowIntensity = status === 'CONNECTED' ? (isSpeaking ? 0.7 + (volume / 150) : 0.25) : 0.1;
  const mainColor = status === 'ERROR' ? '#f87171' : (status === 'CONNECTING' ? '#fbbf24' : '#4ade80');

  return (
    <div className="relative flex items-center justify-center w-56 h-56 transition-all duration-700">
      {/* Dynamic Glow Aura */}
      <div 
        className="absolute inset-0 rounded-full blur-[60px] transition-all duration-300"
        style={{ 
          backgroundColor: mainColor, 
          opacity: glowIntensity,
          transform: `scale(${1 + (volume / 200)})`
        }}
      />

      <svg viewBox="0 0 200 200" className="w-full h-full relative z-10 overflow-visible filter drop-shadow-[0_0_25px_rgba(74,222,128,0.25)]">
        {/* Antennas */}
        <g style={{ transform: `scale(${antennaPulse})`, transformOrigin: '100px 40px' }}>
          <line x1="100" y1="40" x2="100" y2="15" stroke={mainColor} strokeWidth="5" strokeLinecap="round" opacity="0.8" />
          <circle cx="100" cy="12" r="6" fill={mainColor}>
            <animate attributeName="r" values="5;7;5" dur="1.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;1;0.6" dur="1.5s" repeatCount="indefinite" />
          </circle>
        </g>

        {/* Head Shape */}
        <path 
          d="M45,75 C45,30 155,30 155,75 C155,130 130,170 100,170 C70,170 45,130 45,75 Z" 
          fill={mainColor} 
          className="transition-colors duration-1000"
          style={{ transform: headBob }}
        />

        {/* Eyes Group */}
        <g transform="translate(100, 75)">
          {/* Left Eye */}
          <ellipse cx="-34" cy="0" rx="25" ry={blink ? "1" : "34"} fill="#0f172a" className="transition-all duration-75" />
          {!blink && <circle cx="-42" cy="-12" r="4" fill="white" opacity="0.35" />}
          
          {/* Right Eye */}
          <ellipse cx="34" cy="0" rx="25" ry={blink ? "1" : "34"} fill="#0f172a" className="transition-all duration-75" />
          {!blink && <circle cx="26" cy="-12" r="4" fill="white" opacity="0.35" />}
        </g>

        {/* Mouth - Responsive to audio */}
        <g transform="translate(100, 140)">
          <ellipse 
            cx="0" 
            cy="0" 
            rx={10 + (volume / 10)} 
            ry={3 + (35 * mouthScale)} 
            fill="#0f172a" 
            className="transition-all duration-75"
          />
          {/* Subtle smile when not speaking */}
          {!isSpeaking && status === 'CONNECTED' && (
             <path d="M-12,-2 Q0,4 12,-2" fill="none" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
          )}
        </g>

        {/* Tech Details */}
        <circle cx="65" cy="45" r="4" fill="#166534" opacity="0.3" />
        <circle cx="135" cy="45" r="4" fill="#166534" opacity="0.3" />
        <circle cx="100" cy="155" r="2" fill="#166534" opacity="0.2" />
      </svg>
    </div>
  );
};
