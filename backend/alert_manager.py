import os
import requests
import time
import asyncio

# Cooldown per symbol and interval to avoid spam
LAST_ALERT_TIME = {}
COOLDOWN_SECONDS = 3600  # 1 hour between alerts of the same type/interval for higher quality

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")

async def send_telegram_msg(message: str):
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        # print(f"Mock Telegram: {message}")
        return
    
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": message,
        "parse_mode": "Markdown"
    }
    try:
        # Run in executor to avoid blocking the event loop
        loop = asyncio.get_event_loop()
        res = await loop.run_in_executor(None, lambda: requests.post(url, json=payload, timeout=5))
        if not res.ok:
            print(f"Telegram error: {res.text}")
    except Exception as e:
        print(f"Error sending telegram alert: {e}")

async def check_and_send_alerts(symbol: str, scores: dict, current_price: float, interval: str):
    score = scores.get('score', 0)
    reasons = scores.get('reasons', [])
    sym_name = symbol.upper().replace('USDT', '')
    
    alert_type = None
    emoji = ""
    
    if score >= 80:
        alert_type = "STRONG_BULL"
        emoji = "🚀"
    elif score <= 20:
        alert_type = "STRONG_BEAR"
        emoji = "📉"
    
    if not alert_type: return

    key = f"{symbol}_{interval}_{alert_type}"
    now = time.time()
    if now - LAST_ALERT_TIME.get(key, 0) < COOLDOWN_SECONDS:
        return

    LAST_ALERT_TIME[key] = now
    
    # Format message
    reason_str = "\n".join([f"• {r}" for r in reasons[:3]])
    msg = (
        f"{emoji} *SEÑAL {alert_type.replace('_', ' ')}* {emoji}\n\n"
        f"Activo: *{sym_name}/USDT*\n"
        f"Temporalidad: `{interval}`\n"
        f"Precio: `${current_price:,.2f}`\n"
        f"Score IA: `{score}%` ✅\n\n"
        f"*Análisis:*\n{reason_str}\n\n"
        f"🔗 [Ver en CriptoBot.cl](https://criptobot.cl)"
    )
    
    await send_telegram_msg(msg)
