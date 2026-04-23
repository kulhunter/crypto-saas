import pandas as pd
import numpy as np
from analysis import calculate_indicators, calculate_scores


def fetch_historical_binance(symbol: str, interval="1h", limit=1000):
    import requests
    url = f"https://api.binance.com/api/v3/klines?symbol={symbol.upper()}&interval={interval}&limit={limit}"
    data = requests.get(url).json()
    df = pd.DataFrame(data, columns=[
        'timestamp', 'open', 'high', 'low', 'close', 'volume',
        'close_time', 'quote_av', 'trades', 'tb_base_av', 'tb_quote_av', 'ignore'
    ])
    df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
    for c in ['open', 'high', 'low', 'close', 'volume']:
        df[c] = df[c].astype(float)
    return df


def run_backtest(df: pd.DataFrame):
    """
    Simulación de estrategia:
    - Entrar cuando prob_up > 0.6
    - Salir cuando prob_down > 0.6
    """
    capital = 1000.0
    position = 0
    entry_price = 0
    trade_log = []

    if len(df) < 50:
        print("Not enough data for backtest")
        return

    df = calculate_indicators(df)

    for i in range(50, len(df)):
        window = df.iloc[:i]
        current = df.iloc[i]
        cur_price = current['close']

        scores = calculate_scores(window, cur_price, "BTCUSDT")

        if position == 0:
            if scores['prob_up'] > 0.6:
                position = capital / cur_price
                capital = 0
                entry_price = cur_price
        elif position > 0:
            if scores['prob_down'] > 0.6:
                capital = position * cur_price
                trade_log.append({
                    'entry': entry_price,
                    'exit': cur_price,
                    'profit': (cur_price - entry_price) / entry_price
                })
                position = 0
                entry_price = 0

    if position > 0:
        capital = position * df.iloc[-1]['close']

    returns = [t['profit'] for t in trade_log]
    win_rate = len([r for r in returns if r > 0]) / len(returns) if returns else 0

    print("=== BACKTEST RESULT ===")
    print(f"Total Capital Final: ${capital:.2f}")
    print(f"Total Trades: {len(trade_log)}")
    print(f"Win Rate: {win_rate * 100:.1f}%")


if __name__ == "__main__":
    print("Descargando datos históricos para Backtesting (BTCUSDT, 1h)...")
    df = fetch_historical_binance("BTCUSDT")
    run_backtest(df)
