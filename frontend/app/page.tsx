"use client";

import React, { useEffect, useState, useRef } from 'react';
import { createChart, ColorType, ISeriesApi, CandlestickData } from 'lightweight-charts';
import { 
  TrendingUp, TrendingDown, Lock, Zap, 
  BarChart3, Globe, ShieldCheck, Mail, CreditCard,
  ChevronRight, Smartphone, LayoutDashboard, Menu, X
} from 'lucide-react';

// --- Types ---
interface MacroData {
  symbol: string;
  price: number;
  change: number;
}

interface ScoreData {
  score: number;
  prob_up: number;
  prob_down: number;
  reasons: string[];
  support: number;
  resistance: number;
}

interface MarketState {
  price: number;
  scores: ScoreData;
  time: number;
}

// --- Config ---
const SYMBOLS = ["BTC", "ETH", "SOL", "BNB"];
const PRO_SYMBOLS = ["ETH", "SOL", "BNB"];
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const WS_BASE = API_BASE.replace("http", "ws");

export default function Dashboard() {
  const [selectedSym, setSelectedSym] = useState("BTC");
  const [interval, setInterval] = useState("1h");
  const [marketData, setMarketData] = useState<Record<string, Record<string, MarketState>>>({});
  const [macro, setMacro] = useState<MacroData[]>([]);
  const [license, setLicense] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [fingerprint, setFingerprint] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // Initialize fingerprint (simplified)
  useEffect(() => {
    const fp = localStorage.getItem("cb_fp") || Math.random().toString(36).substring(2, 15);
    localStorage.setItem("cb_fp", fp);
    setFingerprint(fp);
    const savedKey = localStorage.getItem("cb_key") || "";
    setLicense(savedKey);
  }, []);

  // Check locking
  useEffect(() => {
    if (PRO_SYMBOLS.includes(selectedSym)) {
      if (!license) setIsLocked(true);
      else {
        // Simple client-side check, backend will gate anyway
        setIsLocked(false);
      }
    } else {
      setIsLocked(false);
    }
  }, [selectedSym, license]);

  // Fetch Macro
  useEffect(() => {
    fetch(`${API_BASE}/api/macro`).then(r => r.json()).then(setMacro).catch(console.error);
    const intervalId = setInterval(() => {
      fetch(`${API_BASE}/api/macro`).then(r => r.json()).then(setMacro).catch(console.error);
    }, 60000);
    return () => clearInterval(intervalId);
  }, []);

  // Chart Sync
  useEffect(() => {
    if (!chartContainerRef.current) return;

    if (chartRef.current) {
        chartRef.current.remove();
    }

    const chart = createChart(chartContainerRef.current, {
      layout: { 
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#888',
      },
      grid: {
        vertLines: { color: '#1a1a1a' },
        horzLines: { color: '#1a1a1a' },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    });

    const series = chart.addCandlestickSeries({
      upColor: '#00ffcc',
      downColor: '#ff4d4d',
      borderVisible: false,
      wickUpColor: '#00ffcc',
      wickDownColor: '#ff4d4d',
    });

    chartRef.current = chart;
    seriesRef.current = series;

    // Fetch History
    const fetchPath = `${API_BASE}/api/history/${selectedSym}USDT?interval=${interval}&key=${license}&fingerprint=${fingerprint}`;
    fetch(fetchPath)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          series.setData(data as CandlestickData[]);
          chart.timeScale().fitContent();
        }
      })
      .catch(console.error);

    const handleResize = () => {
      chart.applyOptions({ width: chartContainerRef.current?.clientWidth });
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [selectedSym, interval, license, fingerprint]);

  // WebSocket for Live Updates
  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE}/ws/stream`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const { symbol, interval: msgInter, price, scores, time, open, high, low, close } = data;
      
      const s = symbol.replace("USDT", "");
      setMarketData(prev => ({
        ...prev,
        [s]: {
          ...prev[s],
          [msgInter]: { price, scores, time }
        }
      }));

      // If matches current view, update chart
      if (s === selectedSym && msgInter === interval && seriesRef.current) {
        seriesRef.current.update({
          time: time as any,
          open, high, low, close
        });
      }
    };
    return () => ws.close();
  }, [selectedSym, interval]);

  const currentState = marketData[selectedSym]?.[interval];

  return (
    <div className="min-h-screen flex flex-col bg-bg text-foreground">
      {/* --- Top Navbar --- */}
      <nav className="h-16 flex items-center justify-between px-6 border-b border-border glass sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-dim border border-brand rounded-lg flex items-center justify-center">
            <Zap className="text-brand w-6 h-6" />
          </div>
          <span className="font-bold text-xl tracking-tight uppercase">CriptoBot <span className="text-brand">Pro</span></span>
        </div>

        {/* Desktop Macro Bar */}
        <div className="hidden md:flex items-center gap-6 overflow-x-auto px-4 max-w-xl">
          {macro.map(m => (
            <div key={m.symbol} className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-xs text-gray-500 font-medium uppercase">{m.symbol}</span>
              <span className={`text-sm font-bold ${m.change >= 0 ? 'text-brand' : 'text-red-500'}`}>
                {m.change >= 0 ? '+' : ''}{m.change.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>

        <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X /> : <Menu />}
        </button>
      </nav>

      {/* --- Main Layout --- */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* --- Sidebar (Asset Selector) --- */}
        <aside className={`fixed inset-0 z-40 bg-bg transition-transform md:relative md:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'} md:w-72 border-r border-border p-4 flex flex-col gap-4`}>
          <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 px-2">Activos Disponibles</div>
          {SYMBOLS.map(s => (
            <button 
              key={s}
              onClick={() => { setSelectedSym(s); setMenuOpen(false); }}
              className={`flex items-center justify-between p-4 rounded-xl transition-all ${selectedSym === s ? 'bg-brand/10 border border-brand text-brand' : 'hover:bg-surface border border-transparent text-gray-400'}`}
            >
              <div className="flex items-center gap-3">
                <BarChart3 className="w-5 h-5" />
                <span className="font-bold">{s}</span>
              </div>
              {PRO_SYMBOLS.includes(s) && !license && <Lock className="w-4 h-4 opacity-50" />}
              <ChevronRight className="w-4 h-4" />
            </button>
          ))}

          <div className="mt-auto pt-6 border-t border-border px-2">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <ShieldCheck className="w-4 h-4" /> Licencia Dispositivo
            </div>
            {license ? (
              <div className="text-xs font-mono bg-surface p-2 rounded border border-border text-brand truncate max-w-full">
                {license}
              </div>
            ) : (
              <button 
                onClick={() => { /* Open modal or focus input */ }}
                className="text-xs text-brand hover:underline font-bold"
              >
                Activar Plan Pro
              </button>
            )}
          </div>
        </aside>

        {/* --- Content Area --- */}
        <main className="flex-1 flex flex-col overflow-y-auto p-4 md:p-6 gap-6">
          
          {/* Header & Intervals */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface p-6 rounded-2xl border border-border relative overflow-hidden">
             {/* Glow Background */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand/5 blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            
            <div>
                <h1 className="text-3xl font-black mb-1 flex items-center gap-3">
                    {selectedSym}/USDT
                    {currentState?.price && <span className="text-xl font-medium text-brand">${currentState.price.toLocaleString()}</span>}
                </h1>
                <p className="text-gray-500 text-sm">Actualizado en tiempo real • {interval} timeframe</p>
            </div>

            <div className="flex items-center bg-bg p-1 rounded-xl border border-border">
                {["10m", "1h", "1d"].map(i => (
                    <button 
                        key={i}
                        onClick={() => setInterval(i)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${interval === i ? 'bg-surface text-brand border border-border shadow-sm' : 'text-gray-500 hover:text-white'}`}
                    >
                        {i}
                    </button>
                ))}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            
            {/* Chart Column */}
            <div className="xl:col-span-2 flex flex-col gap-6">
                <div className="card h-[450px] md:h-[550px] relative">
                    <div ref={chartContainerRef} className="w-full h-full" />
                    
                    {isLocked && (
                        <div className="absolute inset-0 z-10 glass rounded-2xl flex flex-col items-center justify-center text-center p-8">
                            <div className="w-20 h-20 bg-brand/20 rounded-full flex items-center justify-center mb-6">
                                <Lock className="text-brand w-10 h-10" />
                            </div>
                            <h2 className="text-2xl font-bold mb-2">Sección Premium</h2>
                            <p className="text-gray-400 mb-8 max-w-xs">Desbloquea señales para {selectedSym} y el mejor algoritmo de predicción por solo 10 USD.</p>
                            
                            <div className="flex flex-col gap-3 w-full max-w-sm">
                                <button className="w-full py-4 bg-brand text-bg font-black rounded-xl hover:scale-[1.02] transition-transform flex items-center justify-center gap-2">
                                    <CreditCard className="w-5 h-5" /> SOLICITAR CLAVE (10 USD)
                                </button>
                                <div className="text-xs text-gray-500 flex items-center justify-center gap-2">
                                    <ShieldCheck className="w-4 h-4" /> Un solo pago de por vida
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Macro Mobile View */}
                <div className="md:hidden flex items-center gap-4 overflow-x-auto p-4 card no-scrollbar">
                    {macro.map(m => (
                        <div key={m.symbol} className="bg-bg border border-border px-3 py-2 rounded-lg flex items-center gap-2">
                             <span className="text-[10px] text-gray-500 font-bold uppercase">{m.symbol}</span>
                             <span className={`text-xs font-bold ${m.change >= 0 ? 'text-brand' : 'text-red-500'}`}>
                                {m.change.toFixed(2)}%
                             </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Analysis Column */}
            <div className="flex flex-col gap-6">
                {/* Prediction Engine */}
                <div className="card p-6 flex flex-col gap-6">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-brand uppercase tracking-widest">Prediction Engine</span>
                        <div className="flex items-center gap-2 text-[10px] bg-brand-dim text-brand px-2 py-1 rounded-full animate-pulse">
                            <Zap className="w-3 h-3" /> IA PRO ACTIVE
                        </div>
                    </div>

                    <div className="flex flex-col items-center text-center py-4">
                        <div className="relative w-40 h-40 flex items-center justify-center">
                            {/* Circular Meter Simulation */}
                            <svg className="w-full h-full -rotate-90">
                                <circle cx="80" cy="80" r="70" stroke="#1a1a1a" strokeWidth="8" fill="none" />
                                <circle 
                                    cx="80" cy="80" r="70" stroke="#00ffcc" strokeWidth="8" fill="none" 
                                    strokeDasharray="440" strokeDashoffset={440 - (440 * (currentState?.scores?.score || 50)) / 100}
                                    className="transition-all duration-1000"
                                />
                            </svg>
                            <div className="absolute flex flex-col">
                                <span className="text-5xl font-black">{currentState?.scores?.score || "--"}</span>
                                <span className="text-[10px] text-gray-500 uppercase font-black">Score IA</span>
                            </div>
                        </div>
                        
                        <div className="mt-6 flex gap-8">
                            <div className="flex flex-col">
                                <span className="text-xs text-gray-500 uppercase font-bold mb-1">PROB UP</span>
                                <span className="text-xl font-bold text-brand">{Math.round((currentState?.scores?.prob_up || 0.5) * 100)}%</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs text-gray-500 uppercase font-bold mb-1">PROB DOWN</span>
                                <span className="text-xl font-bold text-red-500">{Math.round((currentState?.scores?.prob_down || 0.5) * 100)}%</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Sentiment & Logic</h4>
                        <div className="flex flex-col gap-3">
                            {currentState?.scores?.reasons?.map((r: string, idx: number) => (
                                <div key={idx} className="flex items-start gap-3 bg-bg/50 p-3 rounded-xl border border-border/50">
                                    <div className={`mt-1.5 w-1.5 h-1.5 rounded-full ${r.includes("Bullish") || r.includes("Up") || r.includes("Oversold") ? 'bg-brand' : 'bg-red-500'}`} />
                                    <span className="text-sm font-medium">{r}</span>
                                </div>
                            )) || <div className="text-sm text-gray-500 italic">No analysis data available for this timeframe yet.</div>}
                        </div>
                    </div>
                </div>

                {/* Subscription Card (Only if not hidden by script logic) */}
                {!license && (
                    <div className="card p-6 bg-gradient-to-br from-brand/10 to-transparent">
                        <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
                             <ShieldCheck className="text-brand w-5 h-5" /> Acceso Ilimitado
                        </h4>
                        <div className="space-y-3 mb-6">
                            {[
                                "Señales Pro en Telegram (Criptomiau)",
                                "Predicciones ETH, SOL, BNB",
                                "Algoritmo de Macro Correlación",
                                "Sin renovaciones, pago único"
                            ].map((t, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-sm text-gray-300">
                                    <ChevronRight className="w-4 h-4 text-brand" /> {t}
                                </div>
                            ))}
                        </div>
                        <input 
                            type="text" 
                            placeholder="Ingresar clave recibida..."
                            value={license}
                            onChange={(e) => {
                                setLicense(e.target.value);
                                localStorage.setItem("cb_key", e.target.value);
                            }}
                            className="w-full bg-bg border border-border p-3 rounded-xl mb-4 text-sm focus:border-brand outline-none transition-all"
                        />
                        <p className="text-[10px] text-gray-500 text-center">
                            Envía tu comprobante de 10 USDT (BSC) a<br/>
                            <span className="text-brand font-bold">dan.tagle2023@gmail.com</span>
                        </p>
                    </div>
                )}
            </div>
          </div>

          {/* USDT Payment Info (Extra visibility) */}
          <div className="card p-8 bg-surface border-brand/20 flex flex-col md:flex-row items-center gap-8">
            <div className="w-24 h-24 bg-white p-2 rounded-xl border border-border shrink-0">
                {/* Simplified QR Placeholder */}
                <div className="w-full h-full bg-bg flex items-center justify-center text-xs text-gray-500 text-center font-bold uppercase">USDT<br/>BSC</div>
            </div>
            <div className="flex-1 text-center md:text-left">
                <h3 className="text-xl font-bold mb-2">Desbloquea el Poder Total de Scalping</h3>
                <p className="text-gray-400 text-sm mb-4">Envía 10 USD en USDT vía red BSC BEP20 a la siguiente dirección y recibe tu clave en 24h.</p>
                <div className="flex items-center gap-3 bg-bg border border-border p-4 rounded-xl">
                    <code className="text-xs md:text-sm font-mono text-brand break-all">0x1362e63dba3bbc05076a9e8d0f1c5b5e52208427</code>
                    <button 
                        onClick={() => navigator.clipboard.writeText("0x1362e63dba3bbc05076a9e8d0f1c5b5e52208427")}
                        className="p-2 hover:bg-surface rounded-lg transition-all"
                    >
                        <smartphone className="w-4 h-4" />
                    </button>
                </div>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
                <a href="mailto:dan.tagle2023@gmail.com" className="flex items-center gap-2 text-sm hover:text-brand transition-colors">
                    <Mail className="w-4 h-4" /> dan.tagle2023@gmail.com
                </a>
                <span className="text-xs text-gray-600 font-bold uppercase">Software Pro by Dantagle.cl</span>
            </div>
          </div>

          <footer className="py-8 flex flex-col items-center gap-2 border-t border-border mt-12 opacity-50">
                <div className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                    CriptoBot <span className="text-brand">Pro</span>
                </div>
                <p className="text-xs">Hecho con pasión por <a href="https://dantagle.cl" className="text-brand hover:underline">dantagle.cl</a></p>
                <div className="flex gap-4 mt-2">
                    <Smartphone className="w-4 h-4" />
                    <Globe className="w-4 h-4" />
                    <BarChart3 className="w-4 h-4" />
                </div>
          </footer>

        </main>
      </div>
    </div>
  );
}
