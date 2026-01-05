
import React from 'react';

interface TherapeuticAvatarProps {
  isSpeaking: boolean;
  volume: number;
  status: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';
}

export const TherapeuticAvatar: React.FC<TherapeuticAvatarProps> = ({ isSpeaking, volume, status }) => {
  const glowIntensity = status === 'CONNECTED' ? (isSpeaking ? 0.6 + (volume / 100) : 0.2) : 0.05;
  const mainColor = status === 'ERROR' ? '#f87171' : (status === 'CONNECTING' ? '#fbbf24' : '#10b981');
  const pulseScale = isSpeaking ? 1 + (volume / 200) : 1;

  return (
    <div className="relative flex items-center justify-center w-64 h-64 transition-all duration-700">
      {/* Aura de fundo suave */}
      <div 
        className="absolute inset-0 rounded-full blur-[80px] transition-all duration-1000"
        style={{ 
          backgroundColor: mainColor, 
          opacity: glowIntensity * 0.4,
          transform: `scale(${pulseScale * 1.2})`
        }}
      />

      <svg viewBox="0 0 200 200" className="w-full h-full relative z-10 overflow-visible">
        {/* Desenho Terapêutico - Silhueta Humana Minimalista */}
        <g fill="none" stroke={mainColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-1000" style={{ opacity: status === 'DISCONNECTED' ? 0.3 : 0.9 }}>
          
          {/* Cabeça/Rosto (Linha Única) */}
          <path d="M70,80 C70,50 130,50 130,80 C130,110 115,125 100,125 C85,125 70,110 70,80 Z" />
          
          {/* Ombros e Torso (Linha Fluida) */}
          <path d="M40,160 C50,140 70,135 100,135 C130,135 150,140 160,160" />
          
          {/* Círculo Zen ao redor (Aura) */}
          <circle cx="100" cy="100" r="85" strokeDasharray="5,10" opacity="0.2" />

          {/* Olhos (Pontos de calma) */}
          <g opacity={isSpeaking ? 0.8 : 0.4}>
             <circle cx="85" cy="85" r="1.5" fill={mainColor} stroke="none" />
             <circle cx="115" cy="85" r="1.5" fill={mainColor} stroke="none" />
          </g>

          {/* Boca (Reativa ao volume) */}
          <path 
            d={`M90,105 Q100,${105 + (isSpeaking ? volume/2 : 0)} 110,105`} 
            strokeWidth="2" 
            opacity={isSpeaking ? 1 : 0.4}
          />
        </g>

        {/* Partículas de energia flutuantes */}
        {isSpeaking && (
          <g>
            {[...Array(5)].map((_, i) => (
              <circle key={i} r="2" fill={mainColor} opacity="0.6">
                <animate attributeName="cx" from="100" to={100 + (Math.random() * 100 - 50)} dur={`${1 + i}s`} repeatCount="indefinite" />
                <animate attributeName="cy" from="100" to={100 + (Math.random() * 100 - 50)} dur={`${1 + i}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.6;0" dur={`${1 + i}s`} repeatCount="indefinite" />
              </circle>
            ))}
          </g>
        )}
      </svg>
    </div>
  );
};
