"use client";

import React, { useState, useEffect, useCallback } from 'react';
import ChartComponent from '../components/Chart';
import { Activity, Zap, TrendingUp, TrendingDown, Target, Bell } from 'lucide-react';
import { CandlestickData } from 'lightweight-charts';

export default function Dashboard() {
  const [selectedCrypto, setSelectedCrypto] = useState('BTCUSDT');
  const [marketData, setMarketData] = useState<any>({});
  const [liveCandle, setLiveCandle] = useState<CandlestickData | null>(null);
  
  // Dummy initial data to initialize the chart properly while waiting for websocket (In a real app, fetch historical first)
  const initialData: CandlestickData[] = [];

  useEffect(() => {
    let ws: WebSocket;
    
    const connectWS = () => {
      ws = new WebSocket('ws://localhost:8000/ws/stream');
      
      ws.onopen = () => console.log("Connected to Backend WS");
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setMarketData(prev => ({
          ...prev,
          [data.symbol]: data
        }));

        if (data.symbol === selectedCrypto) {
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
  }, [selectedCrypto]);

  const cryptoSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT'];
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
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>user@example.com</span>
          <button className="button" style={{ background: 'transparent', border: '1px solid var(--border)' }}>Log Out</button>
        </div>
      </header>

      {/* Sidebar Left: Asset Selector */}
      <aside className="sidebar-left">
        <h3 style={{ padding: '0 20px', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px' }}>MARKETS</h3>
        {cryptoSymbols.map(sym => {
          const symData = marketData[sym];
          const price = symData ? symData.price.toFixed(sym.startsWith('SHIB') ? 6 : 2) : 'Loading...';
          const score = symData ? symData.scores.score : 0;
          
          return (
            <div 
              key={sym}
              className={`nav-item ${selectedCrypto === sym ? 'active' : ''}`}
              onClick={() => setSelectedCrypto(sym)}
            >
              <div>
                <div style={{ fontWeight: 'bold' }}>{sym.replace('USDT', '')}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{price}</div>
              </div>
              <div style={{ color: score > 70 ? 'var(--accent-up)' : 'var(--text-muted)' }}>
                ★ {score}
              </div>
            </div>
          );
        })}
      </aside>

      {/* Main Chart Area */}
      <main className="main-chart">
        {/* We recreate the chart component on symbol change to reset series simply for this demo */}
        <ChartComponent 
          key={selectedCrypto}
          data={initialData} 
          liveCandle={liveCandle}
          support={currentAsset?.scores.support}
          resistance={currentAsset?.scores.resistance}
        />
      </main>

      {/* Sidebar Right: AI Prediction Engine */}
      <aside className="sidebar-right">
        {currentAsset ? (
          <>
            <div className="panel-card">
              <h3>Target Asset</h3>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '5px' }}>
                {selectedCrypto.replace('USDT', '')}
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

            <button className="button telegram-btn mt-auto">
              <Bell size={18} /> Configure Telegram Alerts
            </button>
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
