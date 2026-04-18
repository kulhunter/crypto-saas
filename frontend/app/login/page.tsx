"use client";

import React, { useState } from 'react';
import { supabase } from '../../utils/supabase';
import { useRouter } from 'next/navigation';
import { Activity } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    
    // Simulate auth success for local dev if Supabase is not fully configured
    if (process.env.NEXT_PUBLIC_SUPABASE_URL === undefined) {
      if (email === 'demopro@example.com') {
        localStorage.setItem('mock_session', JSON.stringify({ user: { email }, is_pro: true }));
      } else {
        localStorage.setItem('mock_session', JSON.stringify({ user: { email }, is_pro: false }));
      }
      router.push('/');
      return;
    }

    try {
      if (isRegister) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        alert('Check your email for the login link!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push('/');
      }
    } catch (error: any) {
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--bg-dark)' }}>
      <div className="panel-card" style={{ width: '100%', maxWidth: '400px', padding: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <Activity color="#2962FF" size={48} />
        </div>
        <h2 style={{ textAlign: 'center', marginBottom: '30px', color: '#fff' }}>
          CryptoSaaS <span className="pro-badge">PRO</span>
        </h2>
        
        {errorMsg && <div style={{ color: 'var(--accent-down)', marginBottom: '15px', textAlign: 'center' }}>{errorMsg}</div>}
        
        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input 
            type="email" 
            placeholder="Email Address" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ 
              padding: '12px', 
              borderRadius: '4px', 
              border: '1px solid var(--border)', 
              background: 'var(--bg-panel)',
              color: '#fff',
              outline: 'none'
            }}
            required
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ 
              padding: '12px', 
              borderRadius: '4px', 
              border: '1px solid var(--border)', 
              background: 'var(--bg-panel)',
              color: '#fff',
              outline: 'none'
            }}
            required
          />
          
          <button 
            type="submit" 
            className="button telegram-btn" 
            style={{ marginTop: '10px' }}
            disabled={loading}
          >
            {loading ? 'Processing...' : (isRegister ? 'Sign Up' : 'Log In')}
          </button>
        </form>
        
        <div style={{ textAlign: 'center', marginTop: '20px', color: 'var(--text-muted)' }}>
          {isRegister ? 'Already have an account?' : 'Don\'t have an account?'}{' '}
          <button 
            type="button" 
            onClick={() => setIsRegister(!isRegister)}
            style={{ background: 'none', border: 'none', color: '#2962FF', cursor: 'pointer', padding: 0 }}
          >
            {isRegister ? 'Log In' : 'Sign Up'}
          </button>
        </div>
        
        <div style={{ marginTop: '30px', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', borderTop: '1px solid var(--border)', paddingTop: '15px' }}>
          Demo Credentials:<br/>
          <strong>Pro User:</strong> demopro@example.com<br/>
          <strong>Free User:</strong> free@example.com<br/>
          (Any password works in dev)
        </div>
      </div>
    </div>
  );
}
