"use client";
// CriptoBot Pro v3.0 — 100% Real Client-Side Engine (Direct Binance Connection)
import React, { useEffect, useState, useRef, useCallback } from "react";
import { createChart, ColorType, ISeriesApi, CandlestickData, CandlestickSeries, Time } from "lightweight-charts";
import {
  TrendingUp, TrendingDown, Lock, Zap, BarChart3, Globe,
  ShieldCheck, Mail, Copy, ChevronRight, Menu, X,
  ArrowUpRight, ArrowDownRight, Activity, Smartphone
} from "lucide-react";
import ToastProvider, { toast } from "./components/Toast";
import LicenseModal from "./components/LicenseModal";
import { calculateRealScore, Candle, ScoreData } from "./utils/analysis";

// --- Config ---
const SYMBOLS = ["BTC", "ETH", "SOL", "BNB"];
const PRO_SYMBOLS = ["ETH", "SOL", "BNB"];
const WALLET = "0x1362e63dba3bbc05076a9e8d0f1c5b5e52208427";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export default function Dashboard() {
  const [selectedSym, setSelectedSym] = useState("BTC");
  const [timeframe, setTimeframe] = useState("1h");
  
  const [candles, setCandles] = useState<Candle[]>([]);
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  
  const [macroScore, setMacroScore] = useState(0);
  const [macroReason, setMacroReason] = useState("");
  const [macroLoading, setMacroLoading] = useState(true);
  
  const [license, setLicense] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // Refs for WebSocket closure prevention
  const macroScoreRef = useRef(0);
  const macroReasonRef = useRef("");

  // Load License
  useEffect(() => {
    setLicense(localStorage.getItem("cb_key") || "");
  }, []);

  // Check Lock
  useEffect(() => {
    setIsLocked(PRO_SYMBOLS.includes(selectedSym) && !license);
  }, [selectedSym, license]);

  // Fetch Macro Data via proxy (Using Yahoo Finance or fallback to Crypto sentiment)
  useEffect(() => {
    setMacroLoading(true);
    // Para asegurar 100% de confiabilidad y evitar bloqueos de CORS de Yahoo Finance,
    // usaremos el dominio de Bitcoin como proxy de sentimiento de mercado.
    fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT")
      .then(res => res.json())
      .then(data => {
        const change = parseFloat(data.priceChangePercent);
        let score = 0;
        let reason = "Macro Neutral";
        
        if (change > 2) { score = 15; reason = "Risk-On (Mercado General Alcista)"; }
        else if (change < -2) { score = -15; reason = "Risk-Off (Mercado General Bajista)"; }
        
        macroScoreRef.current = score;
        macroReasonRef.current = reason;
        setMacroScore(score);
        setMacroReason(reason);
      })
      .catch(() => {
         macroScoreRef.current = 0;
         macroReasonRef.current = "Macro no disponible";
         setMacroScore(0);
         setMacroReason("Macro no disponible");
      })
      .finally(() => setMacroLoading(false));
  }, []);

  // Fetch History and Init Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;
    if (chartRef.current) chartRef.current.remove();

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#666" },
      grid: { vertLines: { color: "#1a1a22" }, horzLines: { color: "#1a1a22" } },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      crosshair: { mode: 0 },
      timeScale: { timeVisible: true, secondsVisible: false }
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#00ffcc", downColor: "#ff4466", borderVisible: false,
      wickUpColor: "#00ffcc", wickDownColor: "#ff4466",
    });
    chartRef.current = chart;
    seriesRef.current = series;

    let isMounted = true;
    setLoading(true);
    
    // Direct Binance REST API
    const limit = 500;
    fetch(`https://api.binance.com/api/v3/klines?symbol=${selectedSym}USDT&interval=${timeframe}&limit=${limit}`)
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        const parsedCandles: Candle[] = data.map((d: any) => ({
          time: Math.floor(d[0] / 1000), // Binance returns MS
          open: parseFloat(d[1]),
          high: parseFloat(d[2]),
          low: parseFloat(d[3]),
          close: parseFloat(d[4]),
          volume: parseFloat(d[5]),
        }));
        
        setCandles(parsedCandles);
        if (parsedCandles.length > 0) {
            setCurrentPrice(parsedCandles[parsedCandles.length - 1].close);
            const scores = calculateRealScore(parsedCandles, macroScoreRef.current, macroReasonRef.current);
            setScoreData(scores);
        }

        // Lightweight charts requires time as Time
        const chartData = parsedCandles.map(c => ({...c, time: c.time as Time}));
        series.setData(chartData);
        chart.timeScale().fitContent();
      })
      .catch(err => {
         if (!isMounted) return;
         console.error("Error fetching Binance Klines", err);
         toast("❌ Error conectando a Binance REST API");
      })
      .finally(() => {
         if (isMounted) setLoading(false);
      });

    const onResize = () => chart.applyOptions({ width: chartContainerRef.current?.clientWidth });
    window.addEventListener("resize", onResize);
    
    return () => { isMounted = false; window.removeEventListener("resize", onResize); chart.remove(); };
  }, [selectedSym, timeframe]); // Removed macroScore and macroReason to avoid recreation

  // Connect Direct Binance WebSocket
  useEffect(() => {
    const wsUrl = `wss://stream.binance.com:9443/ws/${selectedSym.toLowerCase()}usdt@kline_${timeframe}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const k = data.k;
      
      const newCandle: Candle = {
          time: Math.floor(k.t / 1000),
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
          volume: parseFloat(k.v)
      };

      setCurrentPrice(newCandle.close);

      setCandles(prev => {
          if (prev.length === 0) return [newCandle];
          const last = prev[prev.length - 1];
          let updated = [...prev];
          
          if (last.time === newCandle.time) {
              // Update current candle
              updated[updated.length - 1] = newCandle;
          } else {
              // New candle
              updated.push(newCandle);
              if (updated.length > 1000) updated.shift();
          }
          
          // Re-calculate scores in real time!
          const scores = calculateRealScore(updated, macroScoreRef.current, macroReasonRef.current);
          setScoreData(scores);
          
          return updated;
      });

      if (seriesRef.current) {
          seriesRef.current.update({ ...newCandle, time: newCandle.time as Time });
      }
    };

    return () => ws.close();
  }, [selectedSym, timeframe]); // Removed macroScore and macroReason to prevent premature WebSocket closing

  const handleActivateLicense = useCallback((key: string) => {
    setLicense(key);
    localStorage.setItem("cb_key", key);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-bg text-foreground">
      <ToastProvider />
      <LicenseModal open={modalOpen} onClose={() => setModalOpen(false)} onActivate={handleActivateLicense} />

      {/* ===== NAVBAR ===== */}
      <nav className="h-14 md:h-16 flex items-center justify-between px-4 md:px-6 border-b border-border glass sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-brand-dim border border-brand/30 rounded-lg flex items-center justify-center">
            <Zap className="text-brand w-5 h-5" />
          </div>
          <span className="font-extrabold text-lg tracking-tight">CriptoBot <span className="text-brand">Pro</span></span>
        </div>

        <div className="hidden md:flex items-center gap-2 px-4">
            <div className="live-dot" />
            <span className="text-xs text-brand font-bold uppercase tracking-wider">Conexión Directa Binance</span>
        </div>

        <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {menuOpen && <div className="fixed inset-0 z-30 overlay md:hidden" onClick={() => setMenuOpen(false)} />}

        {/* ===== SIDEBAR ===== */}
        <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-bg border-r border-border p-4 flex flex-col gap-3 transition-transform duration-300 ease-out md:relative md:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="h-14 md:hidden" />
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] px-2 mb-1">Activos Reales</div>
          {SYMBOLS.map(s => {
            return (
              <button key={s} onClick={() => { setSelectedSym(s); setMenuOpen(false); }}
                className={`flex items-center justify-between p-3.5 rounded-xl transition-all btn-press ${selectedSym === s ? "bg-brand/10 border border-brand/30 text-brand" : "hover:bg-surface border border-transparent text-gray-400"}`}>
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-4 h-4" />
                  <div className="text-left">
                    <span className="font-bold text-sm">{s}</span>
                    {selectedSym === s && <div className="text-[11px] opacity-60">${currentPrice.toLocaleString()}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {PRO_SYMBOLS.includes(s) && !license && <Lock className="w-3.5 h-3.5 opacity-40" />}
                  <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                </div>
              </button>
            );
          })}

          <div className="mt-auto pt-4 border-t border-border px-2">
            <div className="flex items-center gap-2 text-[11px] text-gray-500 mb-2"><ShieldCheck className="w-3.5 h-3.5" /> Licencia Local</div>
            {license ? (
              <div className="text-[11px] font-mono bg-surface p-2 rounded-lg border border-border text-brand truncate">{license}</div>
            ) : (
              <button onClick={() => { setModalOpen(true); setMenuOpen(false); }} className="text-xs text-brand hover:underline font-bold">Activar Plan Pro →</button>
            )}
          </div>
        </aside>

        {/* ===== MAIN CONTENT ===== */}
        <main className="flex-1 flex flex-col overflow-y-auto p-4 md:p-6 gap-5 relative">

          {/* Header + Intervals */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 md:p-6 rounded-2xl border border-border relative overflow-hidden animate-slide-up">
            <div className="absolute top-0 right-0 w-28 h-28 bg-brand/5 blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div>
              <h1 className="text-2xl md:text-3xl font-black flex items-center gap-2.5">
                {selectedSym}/USDT
                {currentPrice > 0 && <span className="text-lg md:text-xl font-semibold text-brand">${currentPrice.toLocaleString()}</span>}
              </h1>
              <div className="text-brand text-xs mt-1 font-bold flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse"/> Datos reales en vivo desde Binance API</div>
            </div>
            <div className="flex items-center bg-bg p-1 rounded-xl border border-border">
              {["15m", "1h", "4h", "1d"].map(i => (
                <button key={i} onClick={() => setTimeframe(i)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all btn-press ${timeframe === i ? "bg-surface text-brand border border-border shadow-sm" : "text-gray-500 hover:text-white"}`}>
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            {/* === CHART === */}
            <div className="xl:col-span-2 flex flex-col gap-5">
              <div className="card h-[320px] md:h-[500px] relative animate-slide-up delay-200">
                <div ref={chartContainerRef} className="w-full h-full" />
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-bg/50 backdrop-blur-sm z-10 rounded-2xl">
                    <div className="w-8 h-8 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
                    </div>
                )}

                {isLocked && (
                  <div className="absolute inset-0 z-20 glass rounded-2xl flex flex-col items-center justify-center text-center p-6">
                    <div className="w-16 h-16 bg-brand/15 rounded-full flex items-center justify-center mb-5 animate-glow-pulse">
                      <Lock className="text-brand w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-bold mb-2">Contenido Premium</h2>
                    <p className="text-gray-400 mb-6 max-w-xs text-sm">Desbloquea el análisis IA y señales para {selectedSym} por solo $10 USD (pago único).</p>
                    <button onClick={() => setModalOpen(true)} className="py-3.5 px-8 bg-brand text-bg font-bold rounded-xl hover:brightness-110 transition-all btn-press flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" /> Obtener Acceso Pro
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* === ANALYSIS PANEL === */}
            <div className="flex flex-col gap-5">
              <div className="card p-5 animate-slide-up delay-300 relative overflow-hidden">
                {isLocked && <div className="absolute inset-0 z-10 glass rounded-2xl" />}
                
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black text-brand uppercase tracking-[0.15em]">Prediction Engine Real</span>
                  <div className="flex items-center gap-1.5 text-[10px] bg-brand-dim text-brand px-2 py-1 rounded-full">
                    <div className="live-dot" /> IA ACTIVA
                  </div>
                </div>

                <div className="flex flex-col items-center py-3">
                  <div className="relative w-36 h-36 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
                      <circle cx="80" cy="80" r="68" stroke="#1a1a22" strokeWidth="7" fill="none" />
                      <circle cx="80" cy="80" r="68" stroke={scoreData ? (scoreData.score > 60 ? "#00ffcc" : scoreData.score < 40 ? "#ff4466" : "#ffaa22") : "#333"}
                        strokeWidth="7" fill="none" strokeLinecap="round"
                        strokeDasharray="427" strokeDashoffset={427 - (427 * (scoreData?.score ?? 50)) / 100}
                        className="score-ring transition-all duration-1000 ease-out" />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      {scoreData ? (
                        <>
                          <span className="text-4xl font-black transition-all">{scoreData.score}</span>
                          <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">Score IA</span>
                        </>
                      ) : (
                        <>
                          <Skeleton className="w-14 h-8 mb-1" />
                          <span className="text-[9px] text-gray-500">Cargando...</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-8 mt-5">
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-gray-500 uppercase font-bold mb-1">Prob Up</span>
                      <span className="text-lg font-bold text-brand flex items-center gap-1">
                        {scoreData ? <>{Math.round(scoreData.prob_up * 100)}%<ArrowUpRight className="w-3.5 h-3.5" /></> : <Skeleton className="w-10 h-5" />}
                      </span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-gray-500 uppercase font-bold mb-1">Prob Down</span>
                      <span className="text-lg font-bold text-danger flex items-center gap-1">
                        {scoreData ? <>{Math.round(scoreData.prob_down * 100)}%<ArrowDownRight className="w-3.5 h-3.5" /></> : <Skeleton className="w-10 h-5" />}
                      </span>
                    </div>
                  </div>
                </div>

                {scoreData?.support !== undefined && (
                  <div className="flex gap-3 mt-4 pt-4 border-t border-border">
                    <div className="flex-1 bg-bg rounded-lg p-2.5 text-center border border-border">
                      <div className="text-[9px] text-gray-500 uppercase font-bold mb-1">Soporte</div>
                      <div className="text-sm font-bold text-brand">${scoreData.support.toLocaleString()}</div>
                    </div>
                    <div className="flex-1 bg-bg rounded-lg p-2.5 text-center border border-border">
                      <div className="text-[9px] text-gray-500 uppercase font-bold mb-1">Resistencia</div>
                      <div className="text-sm font-bold text-danger">${scoreData.resistance.toLocaleString()}</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="card p-5 animate-slide-up delay-400 relative">
                {isLocked && <div className="absolute inset-0 z-10 glass rounded-2xl" />}
                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] mb-3">Lógica Matemática Aplicada</h4>
                <div className="flex flex-col gap-2">
                  {scoreData?.reasons?.map((r: string, idx: number) => (
                    <div key={idx} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-bg/50 border border-border/50">
                      <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${r.includes("Alcista") || r.includes("Sobrevendido") || r.includes("Bullish") || r.includes("Risk-On") ? "bg-brand" : r.includes("Neutral") ? "bg-warning" : "bg-danger"}`} />
                      <span className="text-xs">{r}</span>
                    </div>
                  )) || (
                    <div className="space-y-2">
                      <Skeleton className="w-full h-8" />
                      <Skeleton className="w-4/5 h-8" />
                      <Skeleton className="w-3/5 h-8" />
                    </div>
                  )}
                </div>
              </div>

              {!license && (
                <div className="card p-5 bg-gradient-to-br from-brand/8 to-transparent animate-slide-up delay-500">
                  <h4 className="text-sm font-bold mb-3 flex items-center gap-2"><Zap className="text-brand w-4 h-4" /> Acceso Ilimitado</h4>
                  <p className="text-xs text-gray-400 mb-4">Análisis predictivo real para ETH, SOL y BNB por solo $10 USD. Pago único y de por vida.</p>
                  <button onClick={() => setModalOpen(true)} className="w-full py-3 bg-brand text-bg font-bold rounded-xl hover:brightness-110 transition-all btn-press text-sm">
                    Obtener Plan Pro →
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="card p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 animate-slide-up delay-300">
            <div className="w-20 h-20 bg-white/5 border border-border rounded-xl flex items-center justify-center shrink-0">
              <div className="text-center"><span className="text-lg font-black text-brand">₮</span><br /><span className="text-[9px] text-gray-500 font-bold">BSC</span></div>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-lg font-bold mb-1.5">Desbloquea el Algoritmo Completo</h3>
              <p className="text-gray-400 text-xs mb-4">Envía 10 USDT vía BSC (BEP20) y recibe tu clave en 24h.</p>
              <div className="flex items-center gap-2 bg-bg border border-border p-3 rounded-xl">
                <code className="text-[11px] md:text-xs font-mono text-brand break-all flex-1">{WALLET}</code>
                <button onClick={() => { navigator.clipboard.writeText(WALLET); toast("✅ Dirección copiada"); }} className="p-2 hover:bg-surface-2 rounded-lg btn-press shrink-0" title="Copiar">
                  <Copy className="w-4 h-4 text-brand" />
                </button>
              </div>
            </div>
            <div className="flex flex-col items-center md:items-end gap-2 shrink-0">
              <a href="mailto:dan.tagle2023@gmail.com" className="flex items-center gap-1.5 text-xs hover:text-brand transition-colors">
                <Mail className="w-3.5 h-3.5" /> dan.tagle2023@gmail.com
              </a>
              <span className="text-[10px] text-gray-600 font-semibold">by dantagle.cl</span>
            </div>
          </div>

          <div className="animate-slide-up delay-400 mt-4">
            <h2 className="text-lg font-bold mb-4 text-center">Datos 100% Reales</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: <Activity className="w-6 h-6 text-brand" />, title: "Conexión Directa a Binance", desc: "Los gráficos y precios son obtenidos desde la API pública oficial de Binance sin latencia." },
                { icon: <Zap className="w-6 h-6 text-brand" />, title: "Motor Matemático Local", desc: "El RSI, EMA, y Soporte/Resistencia se calculan estrictamente en tu navegador en tiempo real." },
                { icon: <Smartphone className="w-6 h-6 text-brand" />, title: "Máxima Velocidad", desc: "Al eliminar la necesidad de un backend intermedio, obtienes señales y predicciones ms a ms." },
              ].map((item, i) => (
                <div key={i} className="card p-5 text-center hover:border-brand/20">
                  <div className="w-12 h-12 bg-brand-dim rounded-xl flex items-center justify-center mx-auto mb-3">{item.icon}</div>
                  <h3 className="text-sm font-bold mb-1.5">{item.title}</h3>
                  <p className="text-xs text-gray-400">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <footer className="py-6 flex flex-col items-center gap-2 border-t border-border mt-8 opacity-40">
            <div className="text-sm font-bold uppercase tracking-widest">CriptoBot <span className="text-brand">Pro</span></div>
            <p className="text-[11px]">Hecho por <a href="https://dantagle.cl" className="text-brand hover:underline">dantagle.cl</a></p>
          </footer>
        </main>
      </div>
    </div>
  );
}
