from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from binance_ws import binance_ws_manager, connections, current_state, market_data
from macro_monitor import update_macro_data
from auth import validate_license
import sqlite3
import os

app = FastAPI(title="CriptoBot Pro API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = os.path.join(os.path.dirname(__file__), "crypto_pro.db")

@app.on_event("startup")
async def startup_event():
    # Start background tasks
    asyncio.create_task(binance_ws_manager())
    asyncio.create_task(update_macro_data())

@app.get("/")
def read_root():
    return {"status": "online", "service": "CriptoBot Pro"}

@app.post("/api/validate-key")
async def check_key(payload: dict = Body(...)):
    key = payload.get("key")
    fingerprint = payload.get("fingerprint")
    if not key or not fingerprint:
        raise HTTPException(status_code=400, detail="Key and fingerprint required")
    
    valid, msg = validate_license(key, fingerprint)
    return {"valid": valid, "message": msg}

@app.get("/api/state/{symbol}")
def get_symbol_state(symbol: str, key: str = None, fingerprint: str = None):
    sym = symbol.lower()
    # BTC is PUBLIC
    if sym != "btcusdt":
        if not key or not fingerprint:
            return {"error": "locked", "message": "Subscripción requerida"}
        valid, _ = validate_license(key, fingerprint)
        if not valid:
            return {"error": "locked", "message": "Licencia inválida o ya en uso"}
    
    if sym in current_state:
        return current_state[sym]
    return {"error": "not_found"}

@app.get("/api/macro")
def get_macro():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT symbol, price, change_pct FROM macro_data")
        rows = cursor.fetchall()
        conn.close()
        return [{"symbol": r[0], "price": r[1], "change": r[2]} for r in rows]
    except:
        return []

@app.websocket("/ws/stream")
async def websocket_endpoint(websocket: WebSocket, key: str = None, fingerprint: str = None):
    await websocket.accept()
    
    # We allow the connection, but we will filter the broadcast in the frontend 
    # or we can filter it here if we want more security.
    # For now, we'll keep it simple: frontend handles locking UI, 
    # but actual trade signals for premium coins are only useful if you have access.
    
    connections.add(websocket)
    try:
        # Send current state
        for sym_data in current_state.values():
            for state in sym_data.values():
                await websocket.send_json(state)
            
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        connections.remove(websocket)

@app.get("/api/history/{symbol}")
def get_history(symbol: str, interval: str = "1h", key: str = None, fingerprint: str = None):
    sym = symbol.lower()
    if sym != "btcusdt":
        if not key or not fingerprint:
            raise HTTPException(status_code=403, detail="Subscription required")
        valid, _ = validate_license(key, fingerprint)
        if not valid:
            raise HTTPException(status_code=403, detail="Invalid license")

    if sym in market_data and interval in market_data[sym]:
        df = market_data[sym][interval].tail(500)
        formatted = []
        for _, r in df.iterrows():
            formatted.append({
                "time": int(r['timestamp'].timestamp()),
                "open": r['open'],
                "high": r['high'],
                "low": r['low'],
                "close": r['close'],
                "volume": r['volume']
            })
        return formatted
    return []
