import os
import requests
import time

# Cooldown por símbolo y tipo de señal para evitar spam
LAST_ALERT_TIME = {}
COOLDOWN_SECONDS = 600  # 10 minutos entre alertas del mismo tipo

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "mock_token")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "mock_chat_id")

def send_alert(symbol: str, message: str, alert_type: str = "general"):
    key = f"{symbol}_{alert_type}"
    now = time.time()
    last = LAST_ALERT_TIME.get(key, 0)
    
    if now - last > COOLDOWN_SECONDS:
        print(f"📨 TELEGRAM [{alert_type}] {symbol}: {message}")
        LAST_ALERT_TIME[key] = now
        
        if TELEGRAM_BOT_TOKEN != "mock_token":
            url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
            payload = {
                "chat_id": TELEGRAM_CHAT_ID,
                "text": message,
                "parse_mode": "Markdown"
            }
            try:
                resp = requests.post(url, json=payload, timeout=5)
                if not resp.ok:
                    print(f"Telegram error: {resp.text}")
            except Exception as e:
                print(f"Error sending telegram alert: {e}")
    else:
        remaining = int(COOLDOWN_SECONDS - (now - last))
        print(f"⏳ Alert cooldown for {key}: {remaining}s remaining")


def check_and_send_alerts(symbol: str, scores: dict, current_price: float, interval: str):
    """
    Evalúa múltiples condiciones y envía alertas según corresponda.
    Corre en todos los intervalos, no solo en 1h.
    """
    prob_up = scores.get('prob_up', 0)
    prob_down = scores.get('prob_down', 0)
    prob_breakout = scores.get('prob_breakout', 0)
    score = scores.get('score', 0)
    support = scores.get('support', 0)
    resistance = scores.get('resistance', 0)
    sym_name = symbol.upper().replace('USDT', '')

    # 🚨 Alerta de Breakout (umbral reducido a 0.55 para ser más útil)
    if prob_breakout > 0.55:
        pct = round(prob_breakout * 100)
        msg = (
            f"🚨 *BREAKOUT ALERT* 🚨\n"
            f"Par: *{sym_name}/USDT* ({interval})\n"
            f"Precio: `${current_price:,.2f}`\n"
            f"Resistencia: `${resistance:,.2f}`\n"
            f"Probabilidad: *{pct}%*\n"
            f"Score IA: `{score}/100`"
        )
        send_alert(symbol, msg, alert_type="breakout")

    # 📈 Señal alcista fuerte
    if prob_up > 0.70 and score > 65:
        msg = (
            f"📈 *SEÑAL ALCISTA* ({interval})\n"
            f"Par: *{sym_name}/USDT*\n"
            f"Precio: `${current_price:,.2f}`\n"
            f"Prob. subida: *{round(prob_up*100)}%*\n"
            f"Soporte clave: `${support:,.2f}`"
        )
        send_alert(symbol, msg, alert_type="bullish")

    # 📉 Señal bajista fuerte
    if prob_down > 0.72:
        msg = (
            f"📉 *SEÑAL BAJISTA* ({interval})\n"
            f"Par: *{sym_name}/USDT*\n"
            f"Precio: `${current_price:,.2f}`\n"
            f"Prob. bajada: *{round(prob_down*100)}%*\n"
            f"Resistencia: `${resistance:,.2f}`"
        )
        send_alert(symbol, msg, alert_type="bearish")

    # ⭐ Score alto de oportunidad
    if score > 80:
        msg = (
            f"⭐ *OPORTUNIDAD ALTA* ({interval})\n"
            f"Par: *{sym_name}/USDT*\n"
            f"Precio: `${current_price:,.2f}`\n"
            f"Score IA: *{score}/100*\n"
            f"Zona compra: `${support:,.2f}` → Objetivo: `${resistance:,.2f}`"
        )
        send_alert(symbol, msg, alert_type="opportunity")

