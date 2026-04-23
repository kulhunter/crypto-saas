import yfinance as yf
import sqlite3
import os
import asyncio
import time

DB_PATH = os.path.join(os.path.dirname(__file__), "crypto_pro.db")

SYMBOLS = {
    "SPY": "S&P 500 ETF",
    "DX-Y.NYB": "US Dollar Index", # DXY
    "^VIX": "Volatility Index"
}

async def update_macro_data():
    while True:
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            
            for symbol, name in SYMBOLS.items():
                ticker = yf.Ticker(symbol)
                history = ticker.history(period="2d")
                
                if not history.empty:
                    current_price = history['Close'].iloc[-1]
                    prev_price = history['Close'].iloc[-2]
                    change_pct = ((current_price - prev_price) / prev_price) * 100
                    
                    # Normalize symbol name for DB
                    db_sym = "DXY" if "DX-Y" in symbol else ("SPY" if "SPY" in symbol else "VIX")
                    
                    cursor.execute("""
                        INSERT OR REPLACE INTO macro_data (symbol, price, change_pct, updated_at)
                        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                    """, (db_sym, current_price, change_pct))
                    
                    print(f"✅ Macro Updated: {db_sym} | Price: {current_price:.2f} | Change: {change_pct:.2f}%")
            
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"❌ Macro Monitor Error: {e}")
            
        # Update every 30 minutes (Macro data doesn't move as fast as crypto klines)
        await asyncio.sleep(1800)

if __name__ == "__main__":
    # Test run
    asyncio.run(update_macro_data())
