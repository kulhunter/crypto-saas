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
    Lógica de scoring y probabilidad basada en IA/Heurística (Dummy ML output integration)
    Devuelve probabilidades y un score general
    """
    # Dummy ML Output (Reemplazar con el modelo XGBoost cuando esté entrenado)
    dist_res = max(0, res - current_price) / res
    dist_sup = max(0, current_price - sup) / sup
    
    # Simple Heuristic para imitar un modelo entrenado
    prob_up = 0.5
    prob_down = 0.5
    prob_breakout = 0.1
    
    if current_rsi < 30 and dist_sup < 0.01:
        prob_up = 0.75
        prob_down = 0.25
        prob_breakout = 0.4
    
    if current_rsi > 70 and dist_res < 0.01:
        prob_up = 0.20
        prob_down = 0.80
        prob_breakout = 0.6
        
    score = (prob_up * 0.4) + (prob_breakout * 0.4) + ((1 - dist_res) * 0.2)
    
    return {
        "prob_up": round(prob_up, 2),
        "prob_down": round(prob_down, 2),
        "prob_breakout": round(prob_breakout, 2),
        "score": round(score * 100, 1),
        "support": sup,
        "resistance": res
    }
