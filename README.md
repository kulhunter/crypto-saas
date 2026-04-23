# CriptoBot Pro - Advanced Crypto Prediction SaaS

Premium analytics platform built for scalpers. Powered by a hybrid AI algorithm combining technical indicators, market structure (FVG), and macroeconomic data.

## Features

- **Hybrid Prediction Engine**: BTC, ETH, SOL, BNB scores based on RSI, EMA, Fair Value Gaps, and Macro (SP500/DXY).
- **Public/Private Access**: Bitcoin projections are public; Ethereum, Solana, and BNB require a Pro license.
- **Micro-Timeframes**: Optimized for 10m, 1h, and 1d analysis.
- **Device Locking**: Licenses are bound to the first browser/device to prevent account sharing.
- **Telegram Signals**: Real-time "Criptomiau" alerts for high-probability setups.
- **Mobile First**: Built with a "Noir Pro" responsive design.

## Subscription & Payments

- **Cost**: 10 USD (One-time payment).
- **Method**: USDT via BSC (BEP20).
- **Address**: `0x1362e63dba3bbc05076a9e8d0f1c5b5e52208427`
- **Activation**: Send proof of payment to `dan.tagle2023@gmail.com`.

## Technology Stack

- **Frontend**: Next.js 15+, Tailwind CSS 4, Lightweight Charts.
- **Backend**: FastAPI (Python 3.9+), SQLite, WebSockets.
- **Data Source**: Binance WebSocket API & yfinance.

## Setup

### Backend
1. Install dependencies: `pip install fastapi websockets pandas requests yfinance`
2. Initialize DB: `python local_db.py`
3. Run: `uvicorn main:app --reload`

### Frontend
1. Install dependencies: `npm install`
2. Run: `npm run dev`

---
Developed by [dantagle.cl](https://dantagle.cl)
