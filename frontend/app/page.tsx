"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { createChart, ColorType, ISeriesApi, CandlestickSeries, Time, LineSeries, LineWidth, LineStyle } from "lightweight-charts";
import {
  Lock, Zap, BarChart3, Mail, Copy, ChevronRight, Menu, X,
  Activity, Smartphone, Target, AlertTriangle, ArrowRightCircle, ShieldCheck
} from "lucide-react";
import ToastProvider, { toast } from "./components/Toast";
import LicenseModal from "./components/LicenseModal";
import { calculateRealScore, calculateHistoricalProjections, Candle, ScoreData, TradingSignal } from "./utils/analysis";

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
  
  const [license, setLicense] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Main Chart Refs
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  
  const tp1LineRef = useRef<any>(null);
  const tp2LineRef = useRef<any>(null);
  const slLineRef = useRef<any>(null);

  // Backtest Chart Refs
  const backtestContainerRef = useRef<HTMLDivElement>(null);
  const backtestChartRef = useRef<any>(null);
  const backtestSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const projectionSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const macroScoreRef = useRef(0);
  const macroReasonRef = useRef("");

  const updatePriceLines = useCallback((series: ISeriesApi<"Candlestick">, signal: TradingSignal | null) => {
    if (!signal) {
        if (tp1LineRef.current) { series.removePriceLine(tp1LineRef.current); tp1LineRef.current = null; }
        if (tp2LineRef.current) { series.removePriceLine(tp2LineRef.current); tp2LineRef.current = null; }
        if (slLineRef.current) { series.removePriceLine(slLineRef.current); slLineRef.current = null; }
        return;
    }
    
    const isLong = signal.direction.includes('LONG');
    
    const tp1Opts: any = { price: signal.takeProfit1, color: isLong ? '#00ffcc' : '#ff4466', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'TP1' };
    const tp2Opts: any = { price: signal.takeProfit2, color: isLong ? '#00ffcc' : '#ff4466', lineWidth: 2, lineStyle: 2, axisLabelVisible: true, title: 'TP2' };
    const slOpts: any = { price: signal.stopLoss, color: isLong ? '#ff4466' : '#00ffcc', lineWidth: 2, lineStyle: 2, axisLabelVisible: true, title: 'SL' };
    
    if (tp1LineRef.current) tp1LineRef.current.applyOptions(tp1Opts);
    else tp1LineRef.current = series.createPriceLine(tp1Opts);
    
    if (tp2LineRef.current) tp2LineRef.current.applyOptions(tp2Opts);
    else tp2LineRef.current = series.createPriceLine(tp2Opts);
    
    if (slLineRef.current) slLineRef.current.applyOptions(slOpts);
    else slLineRef.current = series.createPriceLine(slOpts);
  }, []);

  useEffect(() => {
    setLicense(localStorage.getItem("cb_key") || "");
  }, []);

  useEffect(() => {
    setIsLocked(PRO_SYMBOLS.includes(selectedSym) && !license);
  }, [selectedSym, license]);

  useEffect(() => {
    fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT")
      .then(res => res.json())
      .then(data => {
        const change = parseFloat(data.priceChangePercent);
        let score = 0;
        let reason = "Macro Neutral";
        
        if (change > 2) { score = 15; reason = "Risk-On (Mercado Alcista)"; }
        else if (change < -2) { score = -15; reason = "Risk-Off (Mercado Bajista)"; }
        
        macroScoreRef.current = score;
        macroReasonRef.current = reason;
        setMacroScore(score);
        setMacroReason(reason);
      })
      .catch(() => {
         macroScoreRef.current = 0;
         macroReasonRef.current = "Macro N/A";
         setMacroScore(0);
         setMacroReason("Macro N/A");
      });
  }, []);

  // Initialize both charts and fetch data
  useEffect(() => {
    if (!chartContainerRef.current || !backtestContainerRef.current) return;

    setCandles([]);
    setScoreData(null);
    setCurrentPrice(0);

    const chartOptions = {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#666" },
      grid: { vertLines: { color: "#1a1a22" }, horzLines: { color: "#1a1a22" } },
      crosshair: { mode: 0 },
      timeScale: { timeVisible: true, secondsVisible: false }
    };

    // 1. MAIN CHART
    const mainChart = createChart(chartContainerRef.current, { ...chartOptions, width: chartContainerRef.current.clientWidth, height: chartContainerRef.current.clientHeight });
    const mainSeries = mainChart.addSeries(CandlestickSeries, { upColor: "#00ffcc", downColor: "#ff4466", borderVisible: false, wickUpColor: "#00ffcc", wickDownColor: "#ff4466" });
    chartRef.current = mainChart;
    seriesRef.current = mainSeries;

    // 2. BACKTEST CHART
    const btChart = createChart(backtestContainerRef.current, { ...chartOptions, width: backtestContainerRef.current.clientWidth, height: backtestContainerRef.current.clientHeight });
    const btSeries = btChart.addSeries(CandlestickSeries, { upColor: "#00ffcc", downColor: "#ff4466", borderVisible: false, wickUpColor: "#00ffcc", wickDownColor: "#ff4466" });
    const projSeries = btChart.addSeries(LineSeries, { color: '#00ccff', lineWidth: 2, lineStyle: 0 });
    backtestChartRef.current = btChart;
    backtestSeriesRef.current = btSeries;
    projectionSeriesRef.current = projSeries;

    // Sync Crosshairs and Scrolling
    const sync1 = (logicalRange: any) => {
        if (logicalRange) btChart.timeScale().setVisibleLogicalRange(logicalRange);
    };
    const sync2 = (logicalRange: any) => {
        if (logicalRange) mainChart.timeScale().setVisibleLogicalRange(logicalRange);
    };
    mainChart.timeScale().subscribeVisibleLogicalRangeChange(sync1);
    btChart.timeScale().subscribeVisibleLogicalRangeChange(sync2);

    let isMounted = true;
    setLoading(true);
    
    fetch(`https://api.binance.com/api/v3/klines?symbol=${selectedSym}USDT&interval=${timeframe}&limit=500`)
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        const parsedCandles: Candle[] = data.map((d: any) => ({
          time: Math.floor(d[0] / 1000),
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
            updatePriceLines(mainSeries, scores.signal);

            const projections = calculateHistoricalProjections(parsedCandles, macroScoreRef.current);
            projSeries.setData(projections.map(p => ({ time: p.time as Time, value: p.value })));
        }

        const chartData = parsedCandles.map(c => ({...c, time: c.time as Time}));
        mainSeries.setData(chartData);
        btSeries.setData(chartData);
        
        mainChart.timeScale().fitContent();
        btChart.timeScale().fitContent();
      })
      .catch(err => {
         if (!isMounted) return;
         console.error("Error fetching Binance Klines", err);
         toast("❌ Error conectando a Binance REST API");
      })
      .finally(() => {
         if (isMounted) setLoading(false);
      });

    const onResize = () => {
        if (chartContainerRef.current && chartRef.current) chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
        if (backtestContainerRef.current && backtestChartRef.current) backtestChartRef.current.applyOptions({ width: backtestContainerRef.current.clientWidth });
    };
    window.addEventListener("resize", onResize);
    
    return () => { 
        isMounted = false; 
        window.removeEventListener("resize", onResize); 
        if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }
        if (backtestChartRef.current) { backtestChartRef.current.remove(); backtestChartRef.current = null; }
        tp1LineRef.current = null;
        tp2LineRef.current = null;
        slLineRef.current = null;
    };
  }, [selectedSym, timeframe, updatePriceLines]);

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
              updated[updated.length - 1] = newCandle;
          } else {
              updated.push(newCandle);
              if (updated.length > 1000) updated.shift();
          }
          
          const scores = calculateRealScore(updated, macroScoreRef.current, macroReasonRef.current);
          setScoreData(scores);
          
          if (seriesRef.current) {
              updatePriceLines(seriesRef.current, scores.signal);
          }

          if (projectionSeriesRef.current && scores.signal) {
              projectionSeriesRef.current.update({ time: newCandle.time as Time, value: scores.signal.takeProfit1 });
          }
          
          return updated;
      });

      if (seriesRef.current) seriesRef.current.update({ ...newCandle, time: newCandle.time as Time });
      if (backtestSeriesRef.current) backtestSeriesRef.current.update({ ...newCandle, time: newCandle.time as Time });
    };

    return () => ws.close();
  }, [selectedSym, timeframe, updatePriceLines]);

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
                    {selectedSym === s && currentPrice > 0 && <div className="text-[11px] opacity-60">${currentPrice.toLocaleString()}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {PRO_SYMBOLS.includes(s) && !license && <Lock className="w-3.5 h-3.5 opacity-40" />}
                  <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                </div>
              </button>
            );
          })}
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
            {/* === DUAL CHARTS === */}
            <div className="xl:col-span-2 flex flex-col gap-5">
              
              {/* CHART 1: Real-Time Market & Current Lines */}
              <div className="card h-[400px] relative animate-slide-up delay-200 flex flex-col">
                <div className="flex items-center gap-2 p-4 pb-0 z-10">
                    <Activity className="w-4 h-4 text-brand" />
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-300">Mercado en Tiempo Real</span>
                </div>
                <div ref={chartContainerRef} className="w-full flex-1" />
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
                    <p className="text-gray-400 mb-6 max-w-xs text-sm">Desbloquea el análisis IA y señales para {selectedSym} por solo $10 USD.</p>
                    <button onClick={() => setModalOpen(true)} className="py-3.5 px-8 bg-brand text-bg font-bold rounded-xl hover:brightness-110 transition-all btn-press flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" /> Obtener Acceso Pro
                    </button>
                  </div>
                )}
              </div>

              {/* CHART 2: Historical Prediction Backtest */}
              <div className="card h-[300px] relative animate-slide-up delay-300 flex flex-col border border-brand/10 bg-brand/5">
                <div className="flex items-center gap-2 p-4 pb-0 z-10">
                    <Target className="w-4 h-4 text-[#00ccff]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-300">Backtest: Línea de Proyección (TP) vs Realidad</span>
                </div>
                <div ref={backtestContainerRef} className="w-full flex-1" />
              </div>

            </div>

            {/* === TRADING SIGNALS PANEL === */}
            <div className="flex flex-col gap-5">
              <div className="card p-5 animate-slide-up delay-300 relative overflow-hidden">
                {isLocked && <div className="absolute inset-0 z-10 glass rounded-2xl" />}
                
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black text-brand uppercase tracking-[0.15em]">Señal de Trading</span>
                  <div className="flex items-center gap-1.5 text-[10px] bg-brand-dim text-brand px-2 py-1 rounded-full">
                    <div className="live-dot" /> IA ACTIVA
                  </div>
                </div>

                {scoreData?.signal ? (
                  <div className="flex flex-col gap-4">
                    {/* Direction Badge */}
                    <div className={`py-3 rounded-xl text-center font-black text-lg border
                      ${scoreData.signal.direction.includes('LONG') 
                        ? 'bg-brand/10 text-brand border-brand/30 shadow-[0_0_20px_rgba(0,255,204,0.1)]' 
                        : 'bg-danger/10 text-danger border-danger/30 shadow-[0_0_20px_rgba(255,68,102,0.1)]'}`}>
                      {scoreData.signal.direction}
                    </div>

                    {/* Entry & Risk Reward */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-bg p-3 rounded-xl border border-border">
                        <div className="text-[9px] text-gray-500 uppercase font-bold mb-1">Precio Entrada</div>
                        <div className="text-sm font-bold">${scoreData.signal.entry.toLocaleString()}</div>
                      </div>
                      <div className="bg-bg p-3 rounded-xl border border-border">
                        <div className="text-[9px] text-gray-500 uppercase font-bold mb-1">Risk / Reward</div>
                        <div className="text-sm font-bold text-brand">{scoreData.signal.riskReward}</div>
                      </div>
                    </div>

                    {/* Targets */}
                    <div className="flex flex-col gap-2 mt-2">
                      <div className="flex justify-between items-center p-3 rounded-xl bg-bg border border-brand/20">
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-brand" />
                          <span className="text-xs font-bold">Take Profit 2</span>
                        </div>
                        <span className="text-sm font-black text-brand">${scoreData.signal.takeProfit2.toLocaleString()}</span>
                      </div>

                      <div className="flex justify-between items-center p-3 rounded-xl bg-bg border border-border">
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-gray-400" />
                          <span className="text-xs font-bold">Take Profit 1</span>
                        </div>
                        <span className="text-sm font-bold text-gray-300">${scoreData.signal.takeProfit1.toLocaleString()}</span>
                      </div>

                      <div className="flex justify-between items-center p-3 rounded-xl bg-danger/5 border border-danger/20 mt-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-danger" />
                          <span className="text-xs font-bold text-danger">Stop Loss</span>
                        </div>
                        <span className="text-sm font-black text-danger">${scoreData.signal.stopLoss.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center text-gray-500">
                    {scoreData ? (
                        <>
                            <Activity className="w-10 h-10 mb-3 opacity-30" />
                            <p className="text-sm font-bold">Mercado Neutral</p>
                            <p className="text-xs mt-1">Esperando un patrón claro para generar señal de entrada.</p>
                        </>
                    ) : (
                        <>
                            <Skeleton className="w-14 h-8 mb-1" />
                            <span className="text-[9px]">Cargando...</span>
                        </>
                    )}
                  </div>
                )}
              </div>

              <div className="card p-5 animate-slide-up delay-400 relative">
                {isLocked && <div className="absolute inset-0 z-10 glass rounded-2xl" />}
                <div className="flex justify-between items-center mb-3">
                    <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em]">Indicadores</h4>
                    {scoreData && <div className="text-[10px] font-bold text-brand bg-brand/10 px-2 py-1 rounded border border-brand/20">Score IA: {scoreData.score}</div>}
                </div>
                
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
              <a href={`mailto:dan.tagle2023@gmail.com`} className="flex items-center gap-1.5 text-xs hover:text-brand transition-colors">
                <Mail className="w-3.5 h-3.5" /> <span suppressHydrationWarning>{"dan.tagle2023" + "@" + "gmail.com"}</span>
              </a>
              <span className="text-[10px] text-gray-600 font-semibold">by dantagle.cl</span>
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
