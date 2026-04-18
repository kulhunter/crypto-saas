"use client";

import React, { useState, useEffect, useRef } from 'react';
import ChartComponent from '../components/Chart';
import { Activity, TrendingUp, TrendingDown, Target, Bell } from 'lucide-react';
import { CandlestickData } from 'lightweight-charts';

const BINANCE_REST = 'https://api.binance.com/api/v3';
const BINANCE_WS   = 'wss://stream.binance.com:9443/ws';

// ──────────────────────────────────────────────
// Client-side AI scoring (mirrors backend logic)
// ──────────────────────────────────────────────
function calcEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  return data.reduce((acc: number[], val, i) => {
    acc.push(i === 0 ? val : val * k + acc[i - 1] * (1 - k));
    return acc;
  }, []);
}

function calcRSI(closes: number[], period = 14): number {
  const deltas = closes.slice(1).map((v, i) => v - closes[i]);
  const gains  = deltas.map(d => (d > 0 ? d : 0));
  const losses = deltas.map(d => (d < 0 ? -d : 0));
  const avgG = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
  const avgL = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
  if (avgL === 0) return 100;
  return 100 - 100 / (1 + avgG / avgL);
}

function calcScore(closes: number[], volumes: number[], highs: number[], lows: number[]) {
  const close = closes[closes.length - 1];
  const rsi = calcRSI(closes);
  const ema20 = calcEMA(closes, 20);
  const ema50 = calcEMA(closes, 50);
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macd  = ema12[ema12.length - 1] - ema26[ema26.length - 1];
  const macdSignal = calcEMA(ema12.map((v, i) => v - ema26[i]), 9);
  const momentum = macd - macdSignal[macdSignal.length - 1];

  // Bollinger %B
  const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const std20 = Math.sqrt(closes.slice(-20).reduce((a, b) => a + (b - sma20) ** 2, 0) / 20);
  const bbUpper = sma20 + std20 * 2;
  const bbLower = sma20 - std20 * 2;
  const pctB = (close - bbLower) / (bbUpper - bbLower);

  // OBV trend
  const obv = closes.slice(1).reduce((acc, v, i) => {
    return acc + (v > closes[i] ? volumes[i + 1] : -volumes[i + 1]);
  }, 0);
  const obvEMA = calcEMA(closes.map((_, i) => {
    let o = 0;
    for (let j = 1; j <= i; j++) o += closes[j] > closes[j - 1] ? volumes[j] : -volumes[j];
    return o;
  }), 20);
  const obvTrend = obvEMA.length ? (obv - obvEMA[obvEMA.length - 1]) / (Math.abs(obvEMA[obvEMA.length - 1]) || 1) : 0;

  // Support / Resistance (rolling 40-period pivots)
  const windowH = highs.slice(-40);
  const windowL = lows.slice(-40);
  const maxH = Math.max(...windowH);
  const minL = Math.min(...windowL);
  const atr  = highs.slice(-14).reduce((a, v, i) => a + (v - lows[lows.length - 14 + i]), 0) / 14;

  const res = maxH > close + atr * 0.5 ? maxH : close * 1.05;
  const sup = minL < close - atr * 0.5 ? minL : close * 0.95;

  const distRes = Math.max(0.0001, (res - close) / res);
  const distSup = Math.max(0.0001, (close - sup) / sup);

  let probUp = 0.5;
  const rsiFactor = (50 - rsi) / 100;
  probUp += rsiFactor * 0.4;

  const momFactor = Math.min(0.3, Math.max(-0.3, momentum * 10));
  probUp += momFactor;

  const ema50Slope = ema50.length > 5
    ? (ema50[ema50.length - 1] - ema50[ema50.length - 5]) / ema50[ema50.length - 5]
    : 0;
  probUp += Math.min(0.2, Math.max(-0.2, ema50Slope * 100));

  const obvFactor = Math.min(0.2, Math.max(-0.2, obvTrend * 5));
  probUp += obvFactor;

  if (pctB > 1) probUp -= 0.15;
  else if (pctB < 0) probUp += 0.15;

  let probBreakout = 0.1;
  if (distRes < 0.005 && momentum > 0) probBreakout = 0.5 + (0.005 - distRes) * 100 + Math.max(0, momFactor);
  if (distSup < 0.005 && momentum < 0) probBreakout = 0.4 + (0.005 - distSup) * 100;

  probUp = Math.min(0.95, Math.max(0.05, probUp));
  const probDown = 1 - probUp;
  probBreakout = Math.min(0.95, Math.max(0.05, probBreakout));
  const score = (probUp * 0.4 + probBreakout * 0.45 + (1 - distRes) * 0.15) * 100;

  return { probUp, probDown, probBreakout, score: Math.round(score * 10) / 10, support: sup, resistance: res };
}

// ──────────────────────────────────────────────
export default function Dashboard() {
  const SYMBOLS   = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT'];
  const INTERVALS = ['1m', '5m', '15m', '1h'];

  const [selectedCrypto, setSelectedCrypto]   = useState('BTCUSDT');
  const [selectedInterval, setSelectedInterval] = useState('1m');
  const [marketData, setMarketData]             = useState<any>({});
  const [liveCandle, setLiveCandle]             = useState<CandlestickData | null>(null);
  const [historicalData, setHistoricalData]     = useState<CandlestickData[]>([]);
  const [scores, setScores]                     = useState<any>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch historical klines from Binance REST
  useEffect(() => {
    setHistoricalData([]);
    setScores(null);
    const sym = selectedCrypto;
    const inter = selectedInterval;
    fetch(`${BINANCE_REST}/klines?symbol=${sym}&interval=${inter}&limit=200`)
      .then(r => r.json())
      .then((raw: any[]) => {
        const candles: CandlestickData[] = raw.map(k => ({
          time: Math.floor(k[0] / 1000) as any,
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
        }));
        setHistoricalData(candles);

        // Calculate initial score
        const closes  = raw.map(k => parseFloat(k[4]));
        const volumes = raw.map(k => parseFloat(k[5]));
        const highs   = raw.map(k => parseFloat(k[2]));
        const lows    = raw.map(k => parseFloat(k[3]));
        const price   = closes[closes.length - 1];
        const sc = calcScore(closes, volumes, highs, lows);
        setScores({ price, ...sc });
        setMarketData((prev: any) => ({ ...prev, [sym]: { price, scores: sc } }));
      })
      .catch(console.error);
  }, [selectedCrypto, selectedInterval]);

  // Live WebSocket from Binance (all symbols, all intervals)
  useEffect(() => {
    if (wsRef.current) wsRef.current.close();

    const streams = SYMBOLS.flatMap(s =>
      INTERVALS.map(i => `${s.toLowerCase()}@kline_${i}`)
    ).join('/');

    const ws = new WebSocket(`${BINANCE_WS}/${streams}`);
    wsRef.current = ws;

    // Keep a rolling candle buffer per symbol+interval for scoring
    const buffers: Record<string, { closes: number[], volumes: number[], highs: number[], lows: number[] }> = {};

    ws.onmessage = (event) => {
      const msg  = JSON.parse(event.data);
      const k    = msg.k;
      const sym  = msg.s;        // e.g. "BTCUSDT"
      const inter = k.i;         // e.g. "1m"
      const key   = `${sym}_${inter}`;

      if (!buffers[key]) {
        buffers[key] = { closes: [], volumes: [], highs: [], lows: [] };
      }
      const buf = buffers[key];
      buf.closes.push(parseFloat(k.c));
      buf.volumes.push(parseFloat(k.v));
      buf.highs.push(parseFloat(k.h));
      buf.lows.push(parseFloat(k.l));
      if (buf.closes.length > 200) { buf.closes.shift(); buf.volumes.shift(); buf.highs.shift(); buf.lows.shift(); }

      const price = parseFloat(k.c);

      // Only calculate scores when we have enough data
      if (inter === selectedInterval) {
        setMarketData((prev: any) => {
          let sc = prev[sym]?.scores;
          if (buf.closes.length >= 50) {
            sc = calcScore(buf.closes, buf.volumes, buf.highs, buf.lows);
          }
          return { ...prev, [sym]: { price, scores: sc } };
        });
      }

      if (sym === selectedCrypto && inter === selectedInterval) {
        const candle: CandlestickData = {
          time: Math.floor(parseInt(k.t) / 1000) as any,
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
        };
        setLiveCandle(candle);

        if (buf.closes.length >= 50) {
          const sc = calcScore(buf.closes, buf.volumes, buf.highs, buf.lows);
          setScores({ price, ...sc });
        }
      }
    };

    ws.onerror = (e) => console.error('Binance WS error', e);
    ws.onclose = () => console.log('Binance WS closed');

    return () => ws.close();
  }, [selectedCrypto, selectedInterval]);

  const currentAsset = marketData[selectedCrypto];

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="header">
        <div className="logo flex items-center gap-2">
          <Activity color="#2962FF" />
          <span>CryptoSaaS <span className="pro-badge">PRO</span></span>
        </div>
        <div className="flex gap-4 items-center">
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Live · Binance Data</span>
        </div>
      </header>

      {/* Sidebar Left */}
      <aside className="sidebar-left">
        <h3 style={{ padding: '0 20px', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px' }}>MARKETS</h3>
        {SYMBOLS.map(sym => {
          const d     = marketData[sym];
          const price = d ? d.price.toFixed(2) : '···';
          const score = d?.scores?.score ?? 0;
          return (
            <div
              key={sym}
              className={`nav-item ${selectedCrypto === sym ? 'active' : ''}`}
              onClick={() => setSelectedCrypto(sym)}
            >
              <div>
                <div style={{ fontWeight: 'bold' }}>{sym.replace('USDT', '')}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>${price}</div>
              </div>
              <div style={{ color: score > 65 ? 'var(--accent-up)' : 'var(--text-muted)' }}>
                ★ {score}
              </div>
            </div>
          );
        })}
      </aside>

      {/* Chart */}
      <main className="main-chart" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '10px', display: 'flex', gap: '10px', borderBottom: '1px solid var(--border)' }}>
          {INTERVALS.map(inter => (
            <button
              key={inter}
              onClick={() => setSelectedInterval(inter)}
              style={{
                background: selectedInterval === inter ? '#2962FF' : 'transparent',
                color: selectedInterval === inter ? '#fff' : 'var(--text-muted)',
                border: '1px solid #2B3139',
                padding: '5px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {inter}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          {historicalData.length > 0 ? (
            <ChartComponent
              key={`${selectedCrypto}-${selectedInterval}`}
              data={historicalData}
              liveCandle={liveCandle}
              support={scores?.support}
              resistance={scores?.resistance}
            />
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)' }}>
              Cargando datos de Binance...
            </div>
          )}
        </div>
      </main>

      {/* Sidebar Right */}
      <aside className="sidebar-right">
        {scores && currentAsset ? (
          <>
            <div className="panel-card">
              <h3>Asset</h3>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>{selectedCrypto.replace('USDT', '')} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>({selectedInterval})</span></div>
              <div style={{ fontSize: '1.8rem', fontFamily: 'monospace' }}>${currentAsset.price.toFixed(2)}</div>
            </div>

            <div className="panel-card">
              <h3>AI Engine Score</h3>
              <div className="score-display">{scores.score} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/ 100</span></div>
            </div>

            <div className="panel-card">
              <h3>Prediction Probabilities</h3>

              <div className="prob-row">
                <span><TrendingUp size={14} style={{ display: 'inline', marginRight: '5px' }} />Up</span>
                <span>{(scores.probUp * 100).toFixed(0)}%</span>
              </div>
              <div className="prob-bar-container up">
                <div className="prob-bar" style={{ width: `${scores.probUp * 100}%` }} />
              </div>

              <div className="prob-row">
                <span><TrendingDown size={14} style={{ display: 'inline', marginRight: '5px' }} />Down</span>
                <span>{(scores.probDown * 100).toFixed(0)}%</span>
              </div>
              <div className="prob-bar-container down">
                <div className="prob-bar" style={{ width: `${scores.probDown * 100}%` }} />
              </div>

              <div className="prob-row">
                <span><Target size={14} style={{ display: 'inline', marginRight: '5px' }} />Breakout</span>
                <span>{(scores.probBreakout * 100).toFixed(0)}%</span>
              </div>
              <div className="prob-bar-container breakout">
                <div className="prob-bar" style={{ width: `${scores.probBreakout * 100}%` }} />
              </div>
            </div>

            <div className="panel-card">
              <h3>Key Levels (Auto)</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ color: 'var(--accent-down)' }}>Resistance</span>
                <strong>${scores.resistance.toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--accent-up)' }}>Support</span>
                <strong>${scores.support.toFixed(2)}</strong>
              </div>
            </div>

            <div className="panel-card" style={{ border: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
              <div style={{ marginBottom: '10px' }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem' }}>Telegram Alerts</h4>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Activas vía backend</p>
              </div>
              <button className="button telegram-btn" style={{ width: '100%' }}>
                <Bell size={16} /> @G5realmoney
              </button>
            </div>
          </>
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Conectando a Binance...
          </div>
        )}
      </aside>
    </div>
  );
}
