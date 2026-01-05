
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { ConnectionStatus } from './types';
import { decode, encode, decodeAudioData } from './utils/audioUtils';
import { TherapeuticAvatar } from './components/TherapeuticAvatar';

const VOICES = [
  { id: 'Charon', name: 'Sábio', desc: 'Profundo e calmo' },
  { id: 'Kore', name: 'Suave', desc: 'Feminino acolhedor' },
  { id: 'Puck', name: 'Direto', desc: 'Voz limpa e clara' },
  { id: 'Fenrir', name: 'Firme', desc: 'Voz de segurança' },
  { id: 'Zephyr', name: 'Zen', desc: 'Paz e reflexão' }
];

const getSystemInstruction = (userName: string) => `Você é o AMI KAI, IA de resposta ultra-rápida.
Usuário: ${userName || 'Interlocutor'}.

REGRAS DE VELOCIDADE:
1. RESPOSTA INSTANTÂNEA: Seja extremamente breve. Priorize velocidade.
2. BUSCA SELETIVA: Use o Google Search APENAS se o usuário pedir notícias ou fatos que você não sabe. NÃO pesquise para dar "oi" ou conversar.
3. SEM CORTESIA: Não diga "Olá", "Como vai?" ou "Em que posso ajudar?". Responda o fato e pare.
4. ÁUDIO: Fale de forma direta e sem pausas dramáticas.

Se o usuário disser "Notícias", aí sim use a busca. Caso contrário, responda com seu conhecimento interno imediatamente.`;

const App: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [selectedVoice, setSelectedVoice] = useState(VOICES[0].id);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);
  const [userName, setUserName] = useState(() => localStorage.getItem('ami-kai-username') || '');
  const [sources, setSources] = useState<{title: string, uri: string}[]>([]);
  
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);

  useEffect(() => {
    localStorage.setItem('ami-kai-username', userName);
  }, [userName]);

  const triggerVoicePrompt = (prompt: string) => {
    if (sessionPromiseRef.current) {
      sessionPromiseRef.current.then((session) => {
        session.sendRealtimeInput({ text: prompt });
      });
    }
  };

  const stopSession = useCallback(async () => {
    if (sessionPromiseRef.current) {
      const session = await sessionPromiseRef.current;
      session.close();
      sessionPromiseRef.current = null;
    }
    inputAudioContextRef.current?.close();
    outputAudioContextRef.current?.close();
    setStatus(ConnectionStatus.DISCONNECTED);
    setAiSpeaking(false);
    setVolume(0);
    setSources([]);
  }, []);

  const startSession = async () => {
    try {
      setStatus(ConnectionStatus.CONNECTING);
      
      // Inicialização robusta de áudio
      const inCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      // Força o resume para evitar o estado 'suspended' (causa do mudo)
      await inCtx.resume(); 
      await outCtx.resume();
      
      inputAudioContextRef.current = inCtx;
      outputAudioContextRef.current = outCtx;

      const outAnalyser = outCtx.createAnalyser();
      outAnalyser.fftSize = 256;
      outputAnalyserRef.current = outAnalyser;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = inCtx.createMediaStreamSource(stream);
      const scriptProcessor = inCtx.createScriptProcessor(2048, 1, 1); // Buffer menor para menos latência
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ googleSearch: {} }],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } },
          },
          systemInstruction: getSystemInstruction(userName),
        },
        callbacks: {
          onopen: () => {
            setStatus(ConnectionStatus.CONNECTED);
            source.connect(scriptProcessor);
            scriptProcessor.connect(inCtx.destination);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              sessionPromise.then((s) => s.sendRealtimeInput({ 
                media: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' }
              }));
            };
            // Ativação rápida sem enrolação
            triggerVoicePrompt("Apenas confirme: Ativo.");
          },
          onmessage: async (message: LiveServerMessage) => {
            // Captura de fontes
            const grounding = (message as any).serverContent?.groundingMetadata?.groundingChunks;
            if (grounding) {
              const newSources = grounding.filter(c => c.web).map(c => ({ title: c.web.title, uri: c.web.uri }));
              if (newSources.length > 0) setSources(prev => [...prev, ...newSources].slice(-5));
            }

            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              setAiSpeaking(true);
              const audioCtx = outputAudioContextRef.current!;
              const analyser = outputAnalyserRef.current!;
              
              // Garante que o contexto está ativo antes de tocar
              if (audioCtx.state === 'suspended') await audioCtx.resume();

              const now = audioCtx.currentTime;
              // Ajuste de tempo para evitar gaps ou silêncio acumulado
              if (nextStartTimeRef.current < now) nextStartTimeRef.current = now;

              const audioBuffer = await decodeAudioData(decode(base64Audio), audioCtx, 24000, 1);
              const sourceNode = audioCtx.createBufferSource();
              sourceNode.buffer = audioBuffer;
              sourceNode.connect(analyser); 
              analyser.connect(audioCtx.destination);

              const dataArray = new Uint8Array(analyser.frequencyBinCount);
              const monitor = () => {
                if (sourcesRef.current.has(sourceNode)) {
                  analyser.getByteFrequencyData(dataArray);
                  setVolume(dataArray.reduce((a, b) => a + b, 0) / dataArray.length);
                  requestAnimationFrame(monitor);
                }
              };

              sourceNode.onended = () => {
                sourcesRef.current.delete(sourceNode);
                if (sourcesRef.current.size === 0) { 
                  setAiSpeaking(false); 
                  setVolume(0); 
                }
              };

              sourcesRef.current.add(sourceNode);
              sourceNode.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              monitor();
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
              sourcesRef.current.clear(); 
              nextStartTimeRef.current = 0;
              setAiSpeaking(false); 
              setVolume(0);
            }
          },
          onerror: (e) => {
            console.error(e);
            setStatus(ConnectionStatus.ERROR);
          },
          onclose: () => setStatus(ConnectionStatus.DISCONNECTED)
        }
      });
      sessionPromiseRef.current = sessionPromise;
    } catch (err) { 
      console.error(err);
      setStatus(ConnectionStatus.ERROR); 
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-lg mx-auto p-6 relative text-slate-100 overflow-hidden font-light tracking-wide">
      <div className="fixed inset-0 pointer-events-none -z-10 bg-gradient-to-b from-slate-950 via-[#0a1814] to-slate-950" />

      <header className="flex justify-between items-center mb-8 shrink-0">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold tracking-[0.3em] text-white/90">AMI KAI</h1>
          <span className="text-[8px] uppercase tracking-[0.4em] text-emerald-500 font-bold">Modo de Alta Performance</span>
        </div>
        <button 
          onClick={() => triggerVoicePrompt("EMERGÊNCIA.")}
          className="bg-red-500/10 border border-red-500/30 text-red-400 text-[9px] px-5 py-2 rounded-full font-bold uppercase tracking-[0.15em]"
        >
          SOS
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center space-y-8 overflow-hidden">
        <div className="text-center h-8 flex flex-col justify-center">
          <h2 className={`text-xl font-light transition-all duration-300 ${aiSpeaking ? 'text-emerald-400 scale-105' : 'text-white/50'}`}>
            {status === ConnectionStatus.DISCONNECTED ? "Sistema Offline" : 
             status === ConnectionStatus.CONNECTING ? "Iniciando..." : 
             aiSpeaking ? "Ami Kai Respondendo" : "Pronto para Ouvir"}
          </h2>
        </div>

        <div className="relative shrink-0">
          <button onClick={status === ConnectionStatus.DISCONNECTED ? startSession : stopSession} className="relative outline-none active:scale-95 transition-transform">
            <TherapeuticAvatar isSpeaking={aiSpeaking} volume={volume} status={status} />
            {status === ConnectionStatus.DISCONNECTED && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-emerald-500/10 backdrop-blur-md border border-emerald-500/20 text-emerald-400 text-[10px] px-10 py-3 rounded-full font-bold uppercase tracking-widest animate-pulse">
                  Ativar
                </div>
              </div>
            )}
          </button>
        </div>

        {sources.length > 0 && (
          <div className="w-full bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex flex-wrap gap-2 overflow-hidden max-h-12">
              {sources.map((s, idx) => (
                <a key={idx} href={s.uri} target="_blank" rel="noopener noreferrer" className="text-[8px] text-white/30 hover:text-emerald-400 underline truncate max-w-[100px]">
                  {s.title || 'Fonte'}
                </a>
              ))}
            </div>
          </div>
        )}

        <section className="w-full glass-morphism rounded-[3rem] p-8 border border-white/5 shadow-2xl space-y-6">
          <div className="flex items-center gap-4 bg-white/[0.02] rounded-2xl px-6 py-4 border border-white/5">
            <input 
              type="text" value={userName} placeholder="Seu Nome"
              onChange={(e) => setUserName(e.target.value)}
              className="bg-transparent border-none text-sm text-white/90 outline-none w-full placeholder:text-white/10"
            />
          </div>

          <div className="grid grid-cols-5 gap-2">
            {VOICES.map(v => (
              <button 
                key={v.id} 
                onClick={() => setSelectedVoice(v.id)}
                className={`flex flex-col items-center gap-2 p-2 rounded-xl border transition-all ${
                  selectedVoice === v.id ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-white/[0.01] border-white/5'
                }`}
              >
                <div className={`w-1 h-1 rounded-full ${selectedVoice === v.id ? 'bg-emerald-400' : 'bg-white/10'}`} />
                <span className="text-[6px] font-bold uppercase tracking-tighter text-white/40">{v.name}</span>
              </button>
            ))}
          </div>
        </section>
      </main>

      <footer className="shrink-0 py-4 flex justify-center opacity-5">
        <span className="text-[7px] text-white uppercase tracking-[0.8em] font-bold">Turbo v2.8 - Zero Latency Focus</span>
      </footer>

      <style>{`
        .glass-morphism { background: rgba(255, 255, 255, 0.01); backdrop-filter: blur(40px); }
      `}</style>
    </div>
  );
};

export default App;
