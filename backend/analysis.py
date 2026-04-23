import pandas as pd
import numpy as np
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "crypto_pro.db")

def get_macro_sentiment():
    """Fetches current macro data from SQLite"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT symbol, price, change_pct FROM macro_data")
        rows = cursor.fetchall()
        conn.close()
        
        # Simple sentiment logic
        sentiment = {"score": 0, "reason": "Neutral Macro"}
        if not rows: return sentiment
        
        macro_map = {row[0]: row[2] for row in rows} # symbol -> change_pct
        
        spy_change = macro_map.get('SPY', 0)
        dxy_change = macro_map.get('DXY', 0)
        
        # Crypto correlates with SPY positive, DXY negative
        score = (spy_change * 1.5) - (dxy_change * 1.0)
        
        if score > 0.5: sentiment = {"score": 20, "reason": "Risk-On (SPY Up/DXY Down)"}
        elif score < -0.5: sentiment = {"score": -20, "reason": "Risk-Off (SPY Down/DXY Up)"}
        
        return sentiment
    except:
        return {"score": 0, "reason": "Macro Data N/A"}

def calculate_indicators(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    close = df['close']
    
    # EMA
    df['ema_20'] = close.ewm(span=20, adjust=False).mean()
    df['ema_50'] = close.ewm(span=50, adjust=False).mean()
    df['ema_200'] = close.ewm(span=200, adjust=False).mean()
    
    # RSI
    delta = close.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    df['rsi'] = 100 - (100 / (1 + (gain / loss)))
    
    # ATR for stop loss / volatility
    high_low = df['high'] - df['low']
    high_close = np.abs(df['high'] - close.shift())
    low_close = np.abs(df['low'] - close.shift())
    df['atr'] = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1).rolling(14).mean()
    
    # Support & Resistance (Swing Highs/Lows)
    df['local_max'] = df['high'] == df['high'].rolling(window=20, center=True).max()
    df['local_min'] = df['low'] == df['low'].rolling(window=20, center=True).min()
    
    # Fair Value Gaps (FVG) - Important for scalpers
    # Bullish FVG: Low of candle 3 > High of candle 1
    df['fvg_up'] = (df['low'] > df['high'].shift(2)) & (df['close'].shift(1) > df['open'].shift(1))
    # Bearish FVG: High of candle 3 < Low of candle 1
    df['fvg_down'] = (df['high'] < df['low'].shift(2)) & (df['close'].shift(1) < df['open'].shift(1))
    
    return df

def calculate_scores(df: pd.DataFrame, current_price: float, symbol: str):
    last_row = df.iloc[-1]
    prev_row = df.iloc[-2]
    
    # Technical base probability
    prob_up = 0.50
    reasons = []
    
    # 1. Trend Alignment
    if current_price > last_row['ema_50']:
        prob_up += 0.10
        reasons.append("Above EMA50 (Bullish Trend)")
    else:
        prob_up -= 0.10
        reasons.append("Below EMA50 (Bearish Trend)")
        
    # 2. RSI Reversion/Momentum
    if last_row['rsi'] < 30:
        prob_up += 0.15
        reasons.append("RSI Oversold (Potential Bounce)")
    elif last_row['rsi'] > 70:
        prob_up -= 0.15
        reasons.append("RSI Overbought (Overextended)")
        
    # 3. Fair Value Gaps (Smart Money Concepts)
    if last_row['fvg_up']:
        prob_up += 0.10
        reasons.append("Bullish FVG Detected")
    elif last_row['fvg_down']:
        prob_up -= 0.10
        reasons.append("Bearish FVG Detected")
        
    # 4. Macro Influence
    macro = get_macro_sentiment()
    prob_up += (macro['score'] / 100)
    reasons.append(macro['reason'])
    
    # Final Clamping
    prob_up = min(0.95, max(0.05, prob_up))
    prob_down = 1.0 - prob_up
    
    # Score calculation
    score = prob_up * 100
    
    # Levels
    atr = last_row['atr']
    support = df[df['local_min']]['low'].tail(5).max() if not df[df['local_min']].empty else current_price * 0.98
    resistance = df[df['local_max']]['high'].tail(5).min() if not df[df['local_max']].empty else current_price * 1.02

    return {
        "prob_up": round(prob_up, 2),
        "prob_down": round(prob_down, 2),
        "score": round(score, 1),
        "reasons": reasons,
        "support": float(support),
        "resistance": float(resistance),
        "atr": float(atr)
    }
