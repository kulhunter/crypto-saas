import yfinance as yf
import sqlite3
import os
import asyncio
import logging

logger = logging.getLogger("criptobot.macro")

DB_PATH = os.path.join(os.path.dirname(__file__), "crypto_pro.db")

SYMBOLS = {
    "SPY": "S&P 500 ETF",
    "DX-Y.NYB": "US Dollar Index",  # DXY
    "^VIX": "Volatility Index"
}


async def update_macro_data():
    while True:
        conn = None
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()

            for symbol, name in SYMBOLS.items():
                try:
                    ticker = yf.Ticker(symbol)
                    history = ticker.history(period="2d")

                    if not history.empty and len(history) >= 2:
                        current_price = history['Close'].iloc[-1]
                        prev_price = history['Close'].iloc[-2]
                        change_pct = ((current_price - prev_price) / prev_price) * 100

                        db_sym = "DXY" if "DX-Y" in symbol else ("SPY" if "SPY" in symbol else "VIX")

                        cursor.execute("""
                            INSERT OR REPLACE INTO macro_data (symbol, price, change_pct, updated_at)
                            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                        """, (db_sym, current_price, change_pct))

                        logger.info(f"✅ Macro Updated: {db_sym} | ${current_price:.2f} | {change_pct:+.2f}%")
                    else:
                        logger.warning(f"⚠️ No data for {symbol}")
                except Exception as e:
                    logger.error(f"❌ Error fetching {symbol}: {e}")

            conn.commit()
        except Exception as e:
            logger.error(f"❌ Macro Monitor DB Error: {e}")
        finally:
            if conn:
                conn.close()

        # Update every 30 minutes
        await asyncio.sleep(1800)


if __name__ == "__main__":
    asyncio.run(update_macro_data())
