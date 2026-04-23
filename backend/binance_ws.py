import asyncio
import json
import websockets
import pandas as pd
import requests
import logging
from analysis import calculate_indicators, calculate_scores
from alert_manager import check_and_send_alerts
from typing import Dict

logger = logging.getLogger("criptobot.ws")

# InMemory Datastores
market_data: Dict[str, Dict[str, pd.DataFrame]] = {}
current_state: Dict[str, Dict[str, dict]] = {}
connections: set = set()

SYMBOLS = ["btcusdt", "ethusdt", "bnbusdt", "solusdt"]
INTERVALS = ["1m", "1h", "1d"]  # 1m will be used to aggregate 10m


def fetch_historical_data(symbol: str, interval: str):
    url = f"https://api.binance.com/api/v3/klines?symbol={symbol.upper()}&interval={interval}&limit=1000"
    resp = requests.get(url, timeout=15)
    if resp.status_code != 200:
        logger.error(f"Failed to fetch history for {symbol} {interval}: {resp.status_code}")
        return pd.DataFrame()
    data = resp.json()

    df = pd.DataFrame(data, columns=[
        'timestamp', 'open', 'high', 'low', 'close', 'volume',
        'close_time', 'quote_av', 'trades', 'tb_base_av', 'tb_quote_av', 'ignore'
    ])
    df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
    for col in ['open', 'high', 'low', 'close', 'volume']:
        df[col] = df[col].astype(float)

    return df[['timestamp', 'open', 'high', 'low', 'close', 'volume']]


def aggregate_dataframe(df: pd.DataFrame, minutes: int):
    """Aggregates 1m dataframe into X minute candles"""
    if df.empty:
        return df
    df = df.set_index('timestamp')
    agg_df = df.resample(f'{minutes}min').agg({
        'open': 'first',
        'high': 'max',
        'low': 'min',
        'close': 'last',
        'volume': 'sum'
    }).dropna()
    return agg_df.reset_index()


async def binance_ws_manager():
    # Pre-fetch historical data
    for sym in SYMBOLS:
        market_data[sym] = {}
        current_state[sym] = {}
        for inter in INTERVALS:
            logger.info(f"Fetching history for {sym} {inter}")
            market_data[sym][inter] = fetch_historical_data(sym, inter)

        # Pre-build 10m aggregation from 1m data
        if "1m" in market_data[sym] and not market_data[sym]["1m"].empty:
            market_data[sym]["10m"] = aggregate_dataframe(market_data[sym]["1m"], 10)
            logger.info(f"Aggregated 10m data for {sym}: {len(market_data[sym]['10m'])} candles")

    streams = [f"{sym}@kline_{inter}" for sym in SYMBOLS for inter in INTERVALS]
    url = f"wss://stream.binance.com:9443/ws/{'/'.join(streams)}"

    async for websocket in websockets.connect(url):
        try:
            logger.info("Connected to Binance WebSocket")
            async for message in websocket:
                data = json.loads(message)
                sym = data['s'].lower()
                k = data['k']
                inter = k['i']

                new_row = {
                    'timestamp': pd.to_datetime(k['t'], unit='ms'),
                    'open': float(k['o']),
                    'high': float(k['h']),
                    'low': float(k['l']),
                    'close': float(k['c']),
                    'volume': float(k['v'])
                }

                df = market_data[sym][inter]
                if not df.empty and df['timestamp'].iloc[-1] == new_row['timestamp']:
                    df.iloc[-1] = [new_row['timestamp'], new_row['open'], new_row['high'], new_row['low'], new_row['close'], new_row['volume']]
                else:
                    df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True).tail(1000)
                market_data[sym][inter] = df

                # Aggregate 10m from 1m and store it
                if inter == "1m":
                    df_10m = aggregate_dataframe(df, 10)
                    market_data[sym]["10m"] = df_10m
                    process_and_broadcast(sym, "10m", df_10m)

                process_and_broadcast(sym, inter, df)

        except Exception as e:
            logger.error(f"Binance WS Error: {e}")
            await asyncio.sleep(5)


def process_and_broadcast(sym: str, interval: str, df: pd.DataFrame):
    if len(df) < 50:
        return

    analyzed_df = calculate_indicators(df)
    last_row = analyzed_df.tail(1).iloc[0]
    scores = calculate_scores(analyzed_df, last_row['close'], sym)

    payload = {
        "symbol": sym.upper(),
        "interval": interval,
        "price": last_row['close'],
        "time": int(last_row['timestamp'].timestamp()),
        "open": last_row['open'],
        "high": last_row['high'],
        "low": last_row['low'],
        "close": last_row['close'],
        "scores": scores,
    }

    current_state[sym][interval] = payload

    asyncio.create_task(check_and_send_alerts(sym, scores, last_row['close'], interval))
    asyncio.create_task(broadcast(json.dumps(payload)))


async def broadcast(message: str):
    if connections:
        dead = set()
        for ws in connections:
            try:
                await ws.send_text(message)
            except Exception:
                dead.add(ws)
        connections.difference_update(dead)
