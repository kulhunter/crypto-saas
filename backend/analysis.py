import pandas as pd
import numpy as np

def calculate_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """
    Recibe un DF con columnas ['timestamp', 'open', 'high', 'low', 'close', 'volume']
    Calcula RSI, MACD, EMA20, EMA50, ATR, Support, Resistance
    """
    df = df.copy()
    
    close = df['close']
    
    # EMA
    df['ema_20'] = close.ewm(span=20, adjust=False).mean()
    df['ema_50'] = close.ewm(span=50, adjust=False).mean()
    
    # RSI
    delta = close.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    df['rsi'] = 100 - (100 / (1 + rs))
    
    # MACD
    ema_12 = close.ewm(span=12, adjust=False).mean()
    ema_26 = close.ewm(span=26, adjust=False).mean()
    df['macd'] = ema_12 - ema_26
    df['macd_signal'] = df['macd'].ewm(span=9, adjust=False).mean()
    
    # ATR (Average True Range)
    high_low = df['high'] - df['low']
    high_close = np.abs(df['high'] - df['close'].shift())
    low_close = np.abs(df['low'] - df['close'].shift())
    ranges = pd.concat([high_low, high_close, low_close], axis=1)
    df['true_range'] = np.max(ranges, axis=1)
    df['atr'] = df['true_range'].rolling(14).mean()
    
    # Bollinger Bands
    df['sma_20'] = close.rolling(window=20).mean()
    df['std_20'] = close.rolling(window=20).std()
    df['bb_upper'] = df['sma_20'] + (df['std_20'] * 2)
    df['bb_lower'] = df['sma_20'] - (df['std_20'] * 2)
    df['percent_b'] = (close - df['bb_lower']) / (df['bb_upper'] - df['bb_lower'])

    # OBV (On Balance Volume)
    df['obv'] = (np.sign(delta) * df['volume']).fillna(0).cumsum()
    df['obv_ema'] = df['obv'].ewm(span=20, adjust=False).mean()
    
    # Support & Resistance (Simple Local Min/Max Clustering)
    # We will use rolling windows to find local max and min
    df['local_max'] = df['high'] == df['high'].rolling(window=20, center=True).max()
    df['local_min'] = df['low'] == df['low'].rolling(window=20, center=True).min()
    
    return df

def get_current_support_resistance(df: pd.DataFrame, current_price: float):
    """
    Busca los soportes y resistencias más cercanos al precio actual
    """
    try:
        resistances = df[df['local_max']]['high'].dropna().values
        supports = df[df['local_min']]['low'].dropna().values
        
        nearest_resistance = [r for r in resistances if r > current_price]
        nearest_support = [s for s in supports if s < current_price]
        
        res = min(nearest_resistance) if nearest_resistance else current_price * 1.05
        sup = max(nearest_support) if nearest_support else current_price * 0.95
        
        return sup, res
    except:
        return current_price * 0.95, current_price * 1.05

def calculate_scores(df: pd.DataFrame, current_price: float, current_rsi: float, sup: float, res: float):
    """
    Score Modeled Using Technical Oscillators and Distance to Zones
    """
    # Safe distance calculation avoiding DivByZero
    dist_res = max(0.0001, res - current_price) / res
    dist_sup = max(0.0001, current_price - sup) / sup
    
    # Calculate MACD momentum
    try:
        macd_val = df['macd'].iloc[-1]
        macd_sig = df['macd_signal'].iloc[-1]
        momentum = macd_val - macd_sig
    except:
        momentum = 0
        
    # Moving average slopes for trend direction
    try:
        ema50_slope = (df['ema_50'].iloc[-1] - df['ema_50'].iloc[-5]) / df['ema_50'].iloc[-5]
    except:
        ema50_slope = 0
        
    try:
        obv_trend = (df['obv'].iloc[-1] - df['obv_ema'].iloc[-1]) / df['obv_ema'].iloc[-1]
        percent_b = df['percent_b'].iloc[-1]
    except:
        obv_trend = 0
        percent_b = 0.5

    # Base Probability
    prob_up = 0.5
    prob_down = 0.5
    prob_breakout = 0.1
    
    # RSI Influence (Mean Reversion, scaled dynamically)
    # If RSI > 70 (Overbought), it drops prob_up. If RSI < 30 (Oversold), raises prob_up.
    rsi_factor = (50 - current_rsi) / 100 
    prob_up += rsi_factor * 0.4
    
    # Momentum Influence
    momentum_factor = min(0.3, max(-0.3, momentum * 10))
    prob_up += momentum_factor
    
    # Trend Influence
    trend_factor = min(0.2, max(-0.2, ema50_slope * 100))
    prob_up += trend_factor
    
    # OBV Supply/Demand Influence
    obv_factor = min(0.2, max(-0.2, obv_trend * 5))
    prob_up += obv_factor
    
    # Bollinger Squeeze / Extremes
    if percent_b > 1.0: # Piercing upper band (Reversal likely)
        prob_up -= 0.15
        prob_down += 0.2
    elif percent_b < 0.0: # Piercing lower band (Bounce likely)
        prob_up += 0.15
        prob_down -= 0.2
        
    # Proximity Breakout Influence
    # If we are extremely close to resistance (< 0.5%) and momentum is positive
    if dist_res < 0.005 and momentum > 0:
        prob_breakout = 0.5 + (0.005 - dist_res) * 100 + (momentum_factor*0.5) + max(0, obv_factor)
        prob_up += 0.2
        
    # If we are close to support dropping
    if dist_sup < 0.005 and momentum < 0:
        prob_breakout = 0.4 + (0.005 - dist_sup) * 100
        prob_up -= 0.2
        
    # Clamp probabilities between 0.05 and 0.95
    prob_up = min(0.95, max(0.05, prob_up))
    prob_down = 1.0 - prob_up
    prob_breakout = min(0.95, max(0.05, prob_breakout))
        
    # Advanced Score Model
    score = (prob_up * 0.4) + (prob_breakout * 0.45) + ((1 - dist_res) * 0.15)
    
    return {
        "prob_up": round(prob_up, 2),
        "prob_down": round(prob_down, 2),
        "prob_breakout": round(prob_breakout, 2),
        "score": round(score * 100, 1),
        "support": float(sup),
        "resistance": float(res)
    }
