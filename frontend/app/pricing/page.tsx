"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, Check, ArrowLeft } from 'lucide-react';

export default function Pricing() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      // In a real app, send actual User ID from Supabase
      const response = await fetch('http://localhost:8000/api/checkout?user_id=mock_user_123', {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        alert('Error creating checkout session');
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      alert('Network error connecting to Backend Checkout API');
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column', backgroundColor: 'var(--bg-dark)' }}>
      <header className="header" style={{ padding: '20px 40px' }}>
        <div className="logo flex items-center gap-2" style={{ cursor: 'pointer' }} onClick={() => router.push('/')}>
          <Activity color="#2962FF" />
          <span>CryptoSaaS <span className="pro-badge">PRO</span></span>
        </div>
        <button 
          onClick={() => router.push('/')}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
      </header>

      <main style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px' }}>
        <div style={{ maxWidth: '800px', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '50px' }}>
            <h1 style={{ fontSize: '2.5rem', marginBottom: '15px' }}>Upgrade to <span style={{ color: '#2962FF' }}>PRO</span></h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>
              Unlock the full power of AI predictions and real-time market opportunities.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '30px', justifyContent: 'center', flexWrap: 'wrap' }}>
            
            {/* Free Tier */}
            <div className="panel-card" style={{ flex: '1 1 300px', padding: '30px', border: '1px solid var(--border)' }}>
              <h2>Free</h2>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '20px 0' }}>$0<span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/mo</span></div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 30px 0', color: 'var(--text-muted)' }}>
                <li style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}><Check size={16} color="#26A69A" /> Real-time Bitcoin (BTC) Chart</li>
                <li style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}><Check size={16} color="#26A69A" /> Multiple Timeframes</li>
                <li style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px', opacity: 0.3 }}>❌ Access to ETH, BNB, SOL</li>
                <li style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px', opacity: 0.3 }}>❌ Automated AI Scoring</li>
                <li style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px', opacity: 0.3 }}>❌ Telegram Breakout Alerts</li>
              </ul>
              <button className="button" style={{ width: '100%', background: 'transparent', border: '1px solid var(--border)' }} disabled>
                Current Plan
              </button>
            </div>

            {/* Pro Tier */}
            <div className="panel-card" style={{ flex: '1 1 300px', padding: '30px', border: '2px solid #2962FF', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: '#2962FF', color: '#fff', padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' }}>MOST POPULAR</div>
              <h2>Pro Trader</h2>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '20px 0', color: '#2962FF' }}>$29<span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/mo</span></div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 30px 0', color: '#fff' }}>
                <li style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}><Check size={16} color="#2962FF" /> All Free features</li>
                <li style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}><Check size={16} color="#2962FF" /> Full Access to ETH, BNB, SOL</li>
                <li style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}><Check size={16} color="#2962FF" /> Advanced AI Quant Model</li>
                <li style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}><Check size={16} color="#2962FF" /> Auto Support & Resistance</li>
                <li style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}><Check size={16} color="#2962FF" /> Telegram Breakout Alerts</li>
              </ul>
              <button 
                className="button telegram-btn" 
                style={{ width: '100%', padding: '15px', fontSize: '1.1rem' }}
                onClick={handleCheckout}
                disabled={loading}
              >
                {loading ? 'Connecting to Stripe...' : 'Upgrade Now'}
              </button>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
