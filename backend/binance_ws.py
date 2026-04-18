import asyncio
import json
import websockets
import pandas as pd
import requests
from analysis import calculate_indicators, get_current_support_resistance, calculate_scores
from alert_manager import send_alert
from typing import Dict

# InMemory Datastores
market_data: Dict[str, pd.DataFrame] = {}
current_state: Dict[str, dict] = {}
connections: set = set()

SYMBOLS = ["btcusdt", "ethusdt", "bnbusdt", "solusdt"]

def fetch_historical_data(symbol: str):
    url = f"https://api.binance.com/api/v3/klines?symbol={symbol.upper()}&interval=1s&limit=200"
    resp = requests.get(url)
    data = resp.json()
    
    df = pd.DataFrame(data, columns=[
        'timestamp', 'open', 'high', 'low', 'close', 'volume', 
        'close_time', 'quote_av', 'trades', 'tb_base_av', 'tb_quote_av', 'ignore'
    ])
    df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
    for col in ['open', 'high', 'low', 'close', 'volume']:
        df[col] = df[col].astype(float)
        
    return df[['timestamp', 'open', 'high', 'low', 'close', 'volume']]

async def binance_ws_manager():
    # Pre-fetch historical data to prime the indicators
    for sym in SYMBOLS:
        market_data[sym] = fetch_historical_data(sym)
        
    streams = "/".join([f"{sym}@kline_1s" for sym in SYMBOLS])
    url = f"wss://stream.binance.com:9443/ws/{streams}"
    
    async for websocket in websockets.connect(url):
        try:
            print("Connected to Binance WS")
            async for message in websocket:
                data = json.loads(message)
                sym = data['s'].lower()
                k = data['k']
                
                # Append live candle
                new_row = pd.DataFrame([{
                    'timestamp': pd.to_datetime(k['t'], unit='ms'),
                    'open': float(k['o']),
                    'high': float(k['h']),
                    'low': float(k['l']),
                    'close': float(k['c']),
                    'volume': float(k['v'])
                }])
                
                df = market_data[sym]
                
                # If it's a closed candle or we are just updating the latest
                if df['timestamp'].iloc[-1] == pd.to_datetime(k['t'], unit='ms'):
                    df.iloc[-1, df.columns.get_loc('open')] = float(k['o'])
                    df.iloc[-1, df.columns.get_loc('high')] = float(k['h'])
                    df.iloc[-1, df.columns.get_loc('low')] = float(k['l'])
                    df.iloc[-1, df.columns.get_loc('close')] = float(k['c'])
                    df.iloc[-1, df.columns.get_loc('volume')] = float(k['v'])
                else:
                    df = pd.concat([df, new_row], ignore_index=True)
                    # Keep memory bounded
                    if len(df) > 500:
                        df = df.iloc[-500:]
                
                market_data[sym] = df
                
                # Calculate indicators & scores
                if len(df) > 50:
                    analyzed_df = calculate_indicators(df)
                    cur_price = float(k['c'])
                    sup, res = get_current_support_resistance(analyzed_df, cur_price)
                    rsi = analyzed_df['rsi'].iloc[-1]
                    scores = calculate_scores(analyzed_df, cur_price, rsi if pd.notna(rsi) else 50, sup, res)
                    
                    payload = {
                        "symbol": sym.upper(),
                        "price": cur_price,
                        "time": int(k['t'] / 1000),
                        "open": float(k['o']),
                        "high": float(k['h']),
                        "low": float(k['l']),
                        "close": float(k['c']),
                        "scores": scores,
                        "rsi": round(rsi, 2) if pd.notna(rsi) else 50
                    }
                    
                    current_state[sym] = payload
                    
                    # Logica de alertas
                    if scores['prob_breakout'] > 0.7:
                        msg = f"\U0001F6A8 BREAKOUT ALERT: {sym.upper()} \nPrecio: {cur_price}\nResistencia: {res}\nSuporte: {sup}\nProb. Breakout: {scores['prob_breakout']*100}%"
                        send_alert(sym, msg)
                    
                    # Broadcast to clients
                    await broadcast(json.dumps(payload))
                    
        except websockets.ConnectionClosed:
            print("Binance connection closed, reconnecting...")
            await asyncio.sleep(5)
            continue
        except Exception as e:
            print(f"Error in Binance WS: {e}")
            await asyncio.sleep(5)

async def broadcast(message: str):
    if connections:
        dead_connections = set()
        for ws in connections:
            try:
                await ws.send_text(message)
            except Exception:
                dead_connections.add(ws)
        connections.difference_update(dead_connections)
