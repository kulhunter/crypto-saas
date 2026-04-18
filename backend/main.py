from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from binance_ws import binance_ws_manager, connections, current_state
from stripe_manager import create_checkout_session

app = FastAPI(title="Crypto SaaS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    # Start the Binance WS background process
    asyncio.create_task(binance_ws_manager())

@app.get("/")
def read_root():
    return {"status": "running"}

@app.get("/api/history/{symbol}")
def get_history(symbol: str):
    """
    Returns historical klines for the chart
    """
    from binance_ws import market_data
    sym = symbol.lower()
    if sym in market_data:
        df = market_data[sym]
        # Lightweight charts expects [{time: SECONDS, open: X, high: Y...}]
        records = df.to_dict('records')
        
        # Convert timestamp objects to ints
        formatted = []
        for r in records:
            formatted.append({
                "time": int(r['timestamp'].timestamp()),
                "open": r['open'],
                "high": r['high'],
                "low": r['low'],
                "close": r['close'],
                "value": r['volume']
            })
        return formatted
    return []

@app.get("/api/ranking")
def get_ranking():
    """
    Returns current ranking ordered by score
    """
    items = list(current_state.values())
    sorted_items = sorted(items, key=lambda x: x['scores']['score'], reverse=True)
    return {"ranking": sorted_items}

@app.post("/api/checkout")
def checkout(user_id: str):
    res = create_checkout_session(user_id)
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    return res

@app.websocket("/ws/stream")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connections.add(websocket)
    try:
        # Send current initial state for all pairs immediately
        for sym, state in current_state.items():
            await websocket.send_json(state)
            
        while True:
            # Client must keep connection alive
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        connections.remove(websocket)
