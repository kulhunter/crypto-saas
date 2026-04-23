"use client";
// CriptoBot Pro v2.0 — Mobile-First Premium Dashboard
import React, { useEffect, useState, useRef, useCallback } from "react";
import { createChart, ColorType, ISeriesApi, CandlestickData, CandlestickSeries } from "lightweight-charts";
import {
  TrendingUp, TrendingDown, Lock, Zap, BarChart3, Globe,
  ShieldCheck, Mail, Copy, ChevronRight, Menu, X,
  ArrowUpRight, ArrowDownRight, Activity, Eye, Smartphone
} from "lucide-react";
import ToastProvider, { toast } from "./components/Toast";
import LicenseModal from "./components/LicenseModal";

// --- Types ---
interface MacroData { symbol: string; price: number; change: number; }
interface ScoreData { score: number; prob_up: number; prob_down: number; reasons: string[]; support: number; resistance: number; }
interface MarketState { price: number; scores: ScoreData; time: number; }

// --- Config ---
const SYMBOLS = ["BTC", "ETH", "SOL", "BNB"];
const PRO_SYMBOLS = ["ETH", "SOL", "BNB"];
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const WS_BASE = API_BASE.replace("http", "ws");
const WALLET = "0x1362e63dba3bbc05076a9e8d0f1c5b5e52208427";

// --- Skeleton ---
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export default function Dashboard() {
  const [selectedSym, setSelectedSym] = useState("BTC");
  const [timeframe, setTimeframe] = useState("1h");
  const [marketData, setMarketData] = useState<Record<string, Record<string, MarketState>>>({});
  const [macro, setMacro] = useState<MacroData[]>([]);
  const [license, setLicense] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [fingerprint, setFingerprint] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [backendAlive, setBackendAlive] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // Fingerprint init
  useEffect(() => {
    const fp = localStorage.getItem("cb_fp") || Math.random().toString(36).substring(2, 15);
    localStorage.setItem("cb_fp", fp);
    setFingerprint(fp);
    setLicense(localStorage.getItem("cb_key") || "");
  }, []);

  // Lock check
  useEffect(() => {
    setIsLocked(PRO_SYMBOLS.includes(selectedSym) && !license);
  }, [selectedSym, license]);

  // Backend health check
  useEffect(() => {
    fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(5000) })
      .then(r => r.ok ? setBackendAlive(true) : setBackendAlive(false))
      .catch(() => setBackendAlive(false));
  }, []);

  // Fetch Macro
  useEffect(() => {
    if (backendAlive === false) return;
    const doFetch = () => fetch(`${API_BASE}/api/macro`).then(r => r.json()).then(setMacro).catch(() => {});
    doFetch();
    const id = window.setInterval(doFetch, 60000);
    return () => window.clearInterval(id);
  }, [backendAlive]);

  // Chart
  useEffect(() => {
    if (!chartContainerRef.current || backendAlive === false) return;
    if (chartRef.current) chartRef.current.remove();

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#666" },
      grid: { vertLines: { color: "#1a1a22" }, horzLines: { color: "#1a1a22" } },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      crosshair: { mode: 0 },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#00ffcc", downColor: "#ff4466", borderVisible: false,
      wickUpColor: "#00ffcc", wickDownColor: "#ff4466",
    });
    chartRef.current = chart;
    seriesRef.current = series;

    setLoading(true);
    fetch(`${API_BASE}/api/history/${selectedSym}USDT?interval=${timeframe}&key=${license}&fingerprint=${fingerprint}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          series.setData(data as CandlestickData[]);
          chart.timeScale().fitContent();
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    const onResize = () => chart.applyOptions({ width: chartContainerRef.current?.clientWidth });
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); chart.remove(); };
  }, [selectedSym, timeframe, license, fingerprint, backendAlive]);

  // WebSocket
  useEffect(() => {
    if (backendAlive === false) return;
    let ws: WebSocket;
    try {
      ws = new WebSocket(`${WS_BASE}/ws/stream`);
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const { symbol, interval: msgInter, price, scores, time, open, high, low, close } = data;
        const s = symbol.replace("USDT", "");
        setMarketData(prev => ({ ...prev, [s]: { ...prev[s], [msgInter]: { price, scores, time } } }));
        if (s === selectedSym && msgInter === timeframe && seriesRef.current) {
          seriesRef.current.update({ time: time as any, open, high, low, close });
        }
      };
    } catch {}
    return () => { try { ws?.close(); } catch {} };
  }, [selectedSym, timeframe, backendAlive]);

  const currentState = marketData[selectedSym]?.[timeframe];
  const score = currentState?.scores?.score ?? null;
  const probUp = currentState?.scores?.prob_up ?? null;
  const probDown = currentState?.scores?.prob_down ?? null;

  const handleActivateLicense = useCallback((key: string) => {
    setLicense(key);
    localStorage.setItem("cb_key", key);
  }, []);

  const copyWallet = () => {
    navigator.clipboard.writeText(WALLET);
    toast("✅ Dirección copiada al portapapeles");
  };

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

        {/* Desktop Macro */}
        <div className="hidden md:flex items-center gap-5 px-4">
          {backendAlive === false ? (
            <span className="text-xs text-gray-500">Datos macro no disponibles</span>
          ) : macro.map(m => (
            <div key={m.symbol} className="flex items-center gap-1.5">
              <span className="text-[11px] text-gray-500 font-semibold">{m.symbol}</span>
              <span className={`text-xs font-bold ${m.change >= 0 ? "text-brand" : "text-danger"}`}>
                {m.change >= 0 ? "+" : ""}{m.change.toFixed(2)}%
              </span>
            </div>
          ))}
          {backendAlive && <div className="live-dot" />}
        </div>

        <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* ===== MOBILE OVERLAY ===== */}
        {menuOpen && <div className="fixed inset-0 z-30 overlay md:hidden" onClick={() => setMenuOpen(false)} />}

        {/* ===== SIDEBAR ===== */}
        <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-bg border-r border-border p-4 flex flex-col gap-3 transition-transform duration-300 ease-out md:relative md:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="h-14 md:hidden" /> {/* Spacer for mobile navbar */}
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] px-2 mb-1">Activos</div>
          {SYMBOLS.map(s => {
            const sData = marketData[s]?.[timeframe];
            return (
              <button key={s} onClick={() => { setSelectedSym(s); setMenuOpen(false); }}
                className={`flex items-center justify-between p-3.5 rounded-xl transition-all btn-press ${selectedSym === s ? "bg-brand/10 border border-brand/30 text-brand" : "hover:bg-surface border border-transparent text-gray-400"}`}>
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-4 h-4" />
                  <div className="text-left">
                    <span className="font-bold text-sm">{s}</span>
                    {sData && <div className="text-[11px] opacity-60">${sData.price.toLocaleString()}</div>}
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
            <div className="flex items-center gap-2 text-[11px] text-gray-500 mb-2"><ShieldCheck className="w-3.5 h-3.5" /> Licencia</div>
            {license ? (
              <div className="text-[11px] font-mono bg-surface p-2 rounded-lg border border-border text-brand truncate">{license}</div>
            ) : (
              <button onClick={() => { setModalOpen(true); setMenuOpen(false); }} className="text-xs text-brand hover:underline font-bold">Activar Plan Pro →</button>
            )}
          </div>
        </aside>

        {/* ===== MAIN CONTENT ===== */}
        <main className="flex-1 flex flex-col overflow-y-auto p-4 md:p-6 gap-5">

          {/* Backend offline banner */}
          {backendAlive === false && (
            <div className="bg-warning/10 border border-warning/30 text-warning rounded-xl p-4 text-sm flex items-start gap-3 animate-slide-up">
              <Activity className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold mb-1">Servidor de datos no disponible</p>
                <p className="text-xs opacity-80">El backend con datos de Binance no está activo. Contacta al administrador para activar el servicio en tiempo real.</p>
              </div>
            </div>
          )}

          {/* Header + Intervals */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-4 md:p-6 rounded-2xl border border-border relative overflow-hidden animate-slide-up">
            <div className="absolute top-0 right-0 w-28 h-28 bg-brand/5 blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div>
              <h1 className="text-2xl md:text-3xl font-black flex items-center gap-2.5">
                {selectedSym}/USDT
                {currentState?.price && <span className="text-lg md:text-xl font-semibold text-brand">${currentState.price.toLocaleString()}</span>}
              </h1>
              <p className="text-gray-500 text-xs mt-1">{backendAlive ? "Tiempo real • Binance" : "Sin conexión"} • {timeframe}</p>
            </div>
            <div className="flex items-center bg-bg p-1 rounded-xl border border-border">
              {["10m", "1h", "1d"].map(i => (
                <button key={i} onClick={() => setTimeframe(i)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all btn-press ${timeframe === i ? "bg-surface text-brand border border-border shadow-sm" : "text-gray-500 hover:text-white"}`}>
                  {i}
                </button>
              ))}
            </div>
          </div>

          {/* Mobile Macro Strip */}
          <div className="md:hidden flex items-center gap-3 overflow-x-auto no-scrollbar animate-slide-up delay-100">
            {backendAlive !== false && macro.map(m => (
              <div key={m.symbol} className="bg-surface border border-border px-3 py-2 rounded-lg flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-gray-500 font-bold">{m.symbol}</span>
                <span className={`text-xs font-bold ${m.change >= 0 ? "text-brand" : "text-danger"}`}>{m.change.toFixed(2)}%</span>
              </div>
            ))}
            {backendAlive && <div className="flex items-center gap-1.5 shrink-0"><div className="live-dot" /><span className="text-[10px] text-gray-500">Live</span></div>}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            {/* === CHART === */}
            <div className="xl:col-span-2 flex flex-col gap-5">
              <div className="card h-[320px] md:h-[500px] relative animate-slide-up delay-200">
                {backendAlive === false ? (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 gap-3 p-8">
                    <Eye className="w-10 h-10 opacity-30" />
                    <p className="text-sm text-center">Gráfico disponible cuando el servidor esté activo</p>
                  </div>
                ) : (
                  <>
                    <div ref={chartContainerRef} className="w-full h-full" />
                    {loading && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-8 h-8 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
                      </div>
                    )}
                  </>
                )}

                {isLocked && (
                  <div className="absolute inset-0 z-10 glass rounded-2xl flex flex-col items-center justify-center text-center p-6">
                    <div className="w-16 h-16 bg-brand/15 rounded-full flex items-center justify-center mb-5 animate-glow-pulse">
                      <Lock className="text-brand w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-bold mb-2">Contenido Premium</h2>
                    <p className="text-gray-400 mb-6 max-w-xs text-sm">Desbloquea señales para {selectedSym} por solo $10 USD (pago único).</p>
                    <button onClick={() => setModalOpen(true)} className="py-3.5 px-8 bg-brand text-bg font-bold rounded-xl hover:brightness-110 transition-all btn-press flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" /> Obtener Acceso Pro
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* === ANALYSIS PANEL === */}
            <div className="flex flex-col gap-5">
              {/* Score */}
              <div className="card p-5 animate-slide-up delay-300">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black text-brand uppercase tracking-[0.15em]">Prediction Engine</span>
                  <div className="flex items-center gap-1.5 text-[10px] bg-brand-dim text-brand px-2 py-1 rounded-full">
                    <div className="live-dot" /> IA
                  </div>
                </div>

                <div className="flex flex-col items-center py-3">
                  <div className="relative w-36 h-36 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
                      <circle cx="80" cy="80" r="68" stroke="#1a1a22" strokeWidth="7" fill="none" />
                      <circle cx="80" cy="80" r="68" stroke={score !== null ? (score > 60 ? "#00ffcc" : score < 40 ? "#ff4466" : "#ffaa22") : "#333"}
                        strokeWidth="7" fill="none" strokeLinecap="round"
                        strokeDasharray="427" strokeDashoffset={427 - (427 * (score ?? 50)) / 100}
                        className="score-ring" />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      {score !== null ? (
                        <>
                          <span className="text-4xl font-black">{Math.round(score)}</span>
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
                        {probUp !== null ? <>{Math.round(probUp * 100)}%<ArrowUpRight className="w-3.5 h-3.5" /></> : <Skeleton className="w-10 h-5" />}
                      </span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-gray-500 uppercase font-bold mb-1">Prob Down</span>
                      <span className="text-lg font-bold text-danger flex items-center gap-1">
                        {probDown !== null ? <>{Math.round(probDown * 100)}%<ArrowDownRight className="w-3.5 h-3.5" /></> : <Skeleton className="w-10 h-5" />}
                      </span>
                    </div>
                  </div>
                </div>

                {/* S/R Levels */}
                {currentState?.scores?.support && (
                  <div className="flex gap-3 mt-4 pt-4 border-t border-border">
                    <div className="flex-1 bg-bg rounded-lg p-2.5 text-center border border-border">
                      <div className="text-[9px] text-gray-500 uppercase font-bold mb-1">Soporte</div>
                      <div className="text-sm font-bold text-brand">${currentState.scores.support.toLocaleString()}</div>
                    </div>
                    <div className="flex-1 bg-bg rounded-lg p-2.5 text-center border border-border">
                      <div className="text-[9px] text-gray-500 uppercase font-bold mb-1">Resistencia</div>
                      <div className="text-sm font-bold text-danger">${currentState.scores.resistance.toLocaleString()}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Reasons */}
              <div className="card p-5 animate-slide-up delay-400">
                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] mb-3">Análisis</h4>
                <div className="flex flex-col gap-2">
                  {currentState?.scores?.reasons?.map((r: string, idx: number) => (
                    <div key={idx} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-bg/50 border border-border/50">
                      <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${r.includes("Bullish") || r.includes("Up") || r.includes("Oversold") || r.includes("Risk-On") ? "bg-brand" : r.includes("Neutral") ? "bg-warning" : "bg-danger"}`} />
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

              {/* CTA Card */}
              {!license && (
                <div className="card p-5 bg-gradient-to-br from-brand/8 to-transparent animate-slide-up delay-500">
                  <h4 className="text-sm font-bold mb-3 flex items-center gap-2"><Zap className="text-brand w-4 h-4" /> Acceso Ilimitado</h4>
                  <p className="text-xs text-gray-400 mb-4">Señales Pro para ETH, SOL y BNB + alertas Telegram por solo $10 USD. Pago único.</p>
                  <button onClick={() => setModalOpen(true)} className="w-full py-3 bg-brand text-bg font-bold rounded-xl hover:brightness-110 transition-all btn-press text-sm">
                    Obtener Plan Pro →
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* USDT Payment Section */}
          <div className="card p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 animate-slide-up delay-300">
            <div className="w-20 h-20 bg-white/5 border border-border rounded-xl flex items-center justify-center shrink-0">
              <div className="text-center"><span className="text-lg font-black text-brand">₮</span><br /><span className="text-[9px] text-gray-500 font-bold">BSC</span></div>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-lg font-bold mb-1.5">Desbloquea el Algoritmo Completo</h3>
              <p className="text-gray-400 text-xs mb-4">Envía 10 USDT vía BSC (BEP20) y recibe tu clave en 24h.</p>
              <div className="flex items-center gap-2 bg-bg border border-border p-3 rounded-xl">
                <code className="text-[11px] md:text-xs font-mono text-brand break-all flex-1">{WALLET}</code>
                <button onClick={copyWallet} className="p-2 hover:bg-surface-2 rounded-lg btn-press shrink-0" title="Copiar">
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

          {/* How it works */}
          <div className="animate-slide-up delay-400">
            <h2 className="text-lg font-bold mb-4 text-center">¿Cómo funciona?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: <Activity className="w-6 h-6 text-brand" />, title: "Datos en Tiempo Real", desc: "Conectamos directo a Binance para obtener datos de mercado cada segundo." },
                { icon: <Zap className="w-6 h-6 text-brand" />, title: "Motor de Predicción IA", desc: "RSI, EMA, FVG y correlación macro SPY/DXY combinados en un score único." },
                { icon: <Smartphone className="w-6 h-6 text-brand" />, title: "Alertas Telegram", desc: "Recibe señales de alta probabilidad directo en tu celular via Criptomiau Bot." },
              ].map((item, i) => (
                <div key={i} className="card p-5 text-center hover:border-brand/20">
                  <div className="w-12 h-12 bg-brand-dim rounded-xl flex items-center justify-center mx-auto mb-3">{item.icon}</div>
                  <h3 className="text-sm font-bold mb-1.5">{item.title}</h3>
                  <p className="text-xs text-gray-400">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <footer className="py-6 flex flex-col items-center gap-2 border-t border-border mt-8 opacity-40">
            <div className="text-sm font-bold uppercase tracking-widest">CriptoBot <span className="text-brand">Pro</span></div>
            <p className="text-[11px]">Hecho por <a href="https://dantagle.cl" className="text-brand hover:underline">dantagle.cl</a></p>
          </footer>
        </main>
      </div>
    </div>
  );
}
