import os
import requests
import time

# To avoid spamming, we will store the last time an alert was sent for a symbol
LAST_ALERT_TIME = {}
COOLDOWN_SECONDS = 300 # 5 minutes cooldown

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "mock_token")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "mock_chat_id")

def send_alert(symbol: str, message: str):
    now = time.time()
    last = LAST_ALERT_TIME.get(symbol, 0)
    
    if now - last > COOLDOWN_SECONDS:
        print(f"TELEGRAM ALERT for {symbol}: {message}")
        LAST_ALERT_TIME[symbol] = now
        
        if TELEGRAM_BOT_TOKEN != "mock_token":
            url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
            payload = {"chat_id": TELEGRAM_CHAT_ID, "text": message}
            try:
                requests.post(url, json=payload)
            except Exception as e:
                print(f"Error sending telegram alert: {e}")
