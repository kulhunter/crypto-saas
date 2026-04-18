"use client";

import React, { useState, useEffect } from 'react';
import ChartComponent from '../components/Chart';
import { Activity, TrendingUp, TrendingDown, Target, Bell } from 'lucide-react';
import { CandlestickData } from 'lightweight-charts';

export default function Dashboard() {
  // Auth removed - direct access
  const isPro = true;
  
  const [selectedCrypto, setSelectedCrypto] = useState('BTCUSDT');
  const [selectedInterval, setSelectedInterval] = useState('1m');
  const [marketData, setMarketData] = useState<any>({});
  const [liveCandle, setLiveCandle] = useState<CandlestickData | null>(null);
  const [historicalData, setHistoricalData] = useState<CandlestickData[]>([]);

  // Fetch initial history
  useEffect(() => {
    setHistoricalData([]);
    fetch(`http://localhost:8000/api/history/${selectedCrypto}?interval=${selectedInterval}`)
      .then(res => res.json())
      .then(data => {
        setHistoricalData(data);
      })
      .catch(console.error);
  }, [selectedCrypto, selectedInterval]);

  useEffect(() => {
    let ws: WebSocket;
    
    const connectWS = () => {
      ws = new WebSocket('ws://localhost:8000/ws/stream');
      
      ws.onopen = () => console.log("Connected to Backend WS");
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        // Mantener data solo del intervalo actual en memoria visual o todos
        if (data.interval === selectedInterval) {
          setMarketData((prev: any) => ({
            ...prev,
            [data.symbol]: data
          }));
        }

        if (data.symbol === selectedCrypto && data.interval === selectedInterval) {
          setLiveCandle({
            time: data.time as any,
            open: data.open,
            high: data.high,
            low: data.low,
            close: data.close,
          });
        }
      };

      ws.onclose = () => {
        console.log("Disconnected, trying to reconnect...");
        setTimeout(connectWS, 3000);
      };
    };

    connectWS();
    return () => {
      if (ws) ws.close();
    };
  }, [selectedCrypto, selectedInterval]);

  const cryptoSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT'];
  const intervals = ['1m', '5m', '15m', '1h'];
  const currentAsset = marketData[selectedCrypto];

  const handleCryptoSelect = (sym: string) => {
    setSelectedCrypto(sym);
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="header">
        <div className="logo flex items-center gap-2">
          <Activity color="#2962FF" />
          <span>CryptoSaaS <span className="pro-badge">PRO</span></span>
        </div>
        <div className="flex gap-4 items-center">
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Crypto Scanner Live</span>
        </div>
      </header>

      {/* Sidebar Left: Asset Selector */}
      <aside className="sidebar-left">
        <h3 style={{ padding: '0 20px', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px' }}>MARKETS</h3>
        {cryptoSymbols.map(sym => {
          const symData = marketData[sym];
          const price = symData ? symData.price.toFixed(sym.startsWith('SHIB') ? 6 : 2) : 'Loading...';
          const score = symData && symData.scores ? symData.scores.score : 0;
          const isLocked = false; // All unlocked
          
          return (
            <div 
              key={sym}
              className={`nav-item ${selectedCrypto === sym ? 'active' : ''}`}
              onClick={() => handleCryptoSelect(sym)}
              style={{ opacity: isLocked ? 0.5 : 1, position: 'relative' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ fontWeight: 'bold' }}>{sym.replace('USDT', '')}</div>
                {isLocked && <Lock size={12} color="var(--text-muted)" />}
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{price}</div>
              </div>
              {!isLocked && (
                <div style={{ color: score > 70 ? 'var(--accent-up)' : 'var(--text-muted)', position: 'absolute', right: '15px' }}>
                  ★ {score}
                </div>
              )}
            </div>
          );
        })}
      </aside>

      {/* Main Chart Area */}
      <main className="main-chart" style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Toolbar superior para el chart */}
        <div style={{ padding: '10px', display: 'flex', gap: '10px', borderBottom: '1px solid var(--border)' }}>
          {intervals.map(inter => (
            <button 
              key={inter} 
              onClick={() => setSelectedInterval(inter)}
              style={{
                background: selectedInterval === inter ? '#2962FF' : 'transparent',
                color: selectedInterval === inter ? '#fff' : 'var(--text-muted)',
                border: '1px solid #2B3139',
                padding: '5px 12px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {inter}
            </button>
          ))}
        </div>
        
        <div style={{ flex: 1, position: 'relative' }}>
          {/* We recreate the chart component on symbol change to reset series simply for this demo */}
          {historicalData.length > 0 ? (
            <ChartComponent 
              key={`${selectedCrypto}-${selectedInterval}`}
              data={historicalData} 
              liveCandle={liveCandle}
              support={currentAsset?.scores?.support}
              resistance={currentAsset?.scores?.resistance}
            />
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)' }}>
              Loading historical data...
            </div>
          )}
        </div>
      </main>

      {/* Sidebar Right: AI Prediction Engine */}
      <aside className="sidebar-right">
        {currentAsset && currentAsset.scores ? (
          <>
            <div className="panel-card">
              <h3>Target Asset & Interval</h3>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '5px' }}>
                {selectedCrypto.replace('USDT', '')} <span style={{fontSize:'1rem', color:'var(--text-muted)'}}>({selectedInterval})</span>
              </div>
              <div style={{ fontSize: '2rem', fontFamily: 'monospace' }}>
                ${currentAsset.price.toFixed(2)}
              </div>
            </div>

            <div className="panel-card">
              <h3>AI Engine Score</h3>
              <div className="score-display">
                {currentAsset.scores.score} <span style={{fontSize: '1rem', color: "var(--text-muted)"}}>/ 100</span>
              </div>
            </div>

            <div className="panel-card">
              <h3>Prediction Probabilities</h3>
              
              <div className="prob-row">
                <span><TrendingUp size={14} style={{display:'inline', marginRight:'5px'}}/> Up</span>
                <span>{(currentAsset.scores.prob_up * 100).toFixed(0)}%</span>
              </div>
              <div className="prob-bar-container up">
                <div className="prob-bar" style={{ width: `${currentAsset.scores.prob_up * 100}%` }}></div>
              </div>

              <div className="prob-row">
                <span><TrendingDown size={14} style={{display:'inline', marginRight:'5px'}}/> Down</span>
                <span>{(currentAsset.scores.prob_down * 100).toFixed(0)}%</span>
              </div>
              <div className="prob-bar-container down">
                <div className="prob-bar" style={{ width: `${currentAsset.scores.prob_down * 100}%` }}></div>
              </div>

              <div className="prob-row">
                <span><Target size={14} style={{display:'inline', marginRight:'5px'}}/> Breakout</span>
                <span>{(currentAsset.scores.prob_breakout * 100).toFixed(0)}%</span>
              </div>
              <div className="prob-bar-container breakout">
                <div className="prob-bar" style={{ width: `${currentAsset.scores.prob_breakout * 100}%` }}></div>
              </div>
            </div>

            <div className="panel-card">
              <h3>Key Levels (Auto)</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ color: 'var(--accent-down)' }}>Resistance</span>
                <strong>{currentAsset.scores.resistance.toFixed(2)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--accent-up)' }}>Support</span>
                <strong>{currentAsset.scores.support.toFixed(2)}</strong>
              </div>
            </div>

            <div className="panel-card mt-auto" style={{ border: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
              <div style={{ marginBottom: '10px' }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem' }}>Telegram Alerts</h4>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Get notified on breakouts</p>
              </div>
              {isPro ? (
                <button className="button telegram-btn" style={{ width: '100%' }}>
                  <Bell size={16} /> Configure Bot
                </button>
              ) : (
                <button onClick={() => router.push('/pricing')} className="button" style={{ width: '100%', background: '#333', color: '#888' }}>
                  <Lock size={16} /> PRO Feature
                </button>
              )}
            </div>
          </>
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Waiting for data stream...
          </div>
        )}
      </aside>
    </div>
  );
}
