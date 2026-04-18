# Crypto SaaS Full-Stack Platform

Plataforma de análisis de criptomonedas (BTC, ETH, BNB, SOL) empoderada con IA para predecir tendencias, calcular soportes/resistencias en vivo y gestionar alertas vía Telegram de forma automática.

## Estructura del proyecto
- `/backend`: Servidor de Procesamiento de IA y WebSockets contínuo construído en FastAPI.
- `/frontend`: Dashboard interactivo ReactJS/Next.js con Next App Router.

## 1. Instalación Local

### Requisitos Previos:
- Python 3.9+
- Node.js 18+
- Archivo `.env` (crear uno en `/backend` con `TELEGRAM_BOT_TOKEN`, `SUPABASE_URL`, `STRIPE_SECRET_KEY`)

### Backend (Python/FastAPI)
Ejecutar desde el directorio `/backend`:
```bash
python3 -m venv venv
source venv/bin/activate
pip install fastapi uvicorn websockets pandas numpy scikit-learn xgboost supabase stripe requests
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend (Next.js)
Ejecutar desde el directorio `/frontend`:
```bash
npm install
npm run dev
```
La aplicación se servirá en http://localhost:3000

## 2. Deploy a Producción

### Despliegue de Frontend (Vercel)
1. Has un commit de la carpeta `/frontend` a GitHub.
2. En [Vercel](https://vercel.com) importa tu repositorio seleccionando el Root Directory como `frontend/`.
3. Vercel detectará el framework "Next.js" de manera automática.

### Despliegue de Backend (Render / Heroku)
1. Sube tu carpeta `/backend` a un repo de GitHub o usa un Monorepo de servidor (asegurándote que haya un archivo `requirements.txt`).
2. Configura el Web Service en en Render:
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
3. Agrega tus Environment Variables (`TELEGRAM...`, `STRIPE...`, `SUPABASE...`).

## Funciones Actuales
* **WebSocket In-Memory Streaming:** Se alimenta de `wss://stream.binance.com` y pre-procesa indicadores para el fronent en cada velar de 1s de diferencia.
* **Sistema de AI:** XGBoost emulado integrado en `analysis.py` que calcula puntajes `score` para cada oportunidad de subida, bajada y breaking-out de resistencias.
* **Lightweight Charts Client-side Rendering:** Integración en Next.js App Router (React) renderizada como directiva "use client".
