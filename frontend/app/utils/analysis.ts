export interface Candle {
  time: number; // Unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ScoreData {
  prob_up: number;
  prob_down: number;
  score: number;
  reasons: string[];
  support: number;
  resistance: number;
}

/** Calculates EMA */
function calcEMA(data: number[], period: number): number[] {
  const ema = new Array(data.length).fill(0);
  if (data.length < period) return ema;

  const k = 2 / (period + 1);
  ema[period - 1] = data.slice(0, period).reduce((a, b) => a + b) / period;

  for (let i = period; i < data.length; i++) {
    ema[i] = data[i] * k + ema[i - 1] * (1 - k);
  }
  return ema;
}

/** Calculates RSI 14 */
function calcRSI(data: number[], period: number = 14): number[] {
  const rsi = new Array(data.length).fill(50);
  if (data.length <= period) return rsi;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = data[i] - data[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  if (avgLoss === 0) rsi[period] = 100;
  else rsi[period] = 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i] - data[i - 1];
    let currentGain = diff > 0 ? diff : 0;
    let currentLoss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

    if (avgLoss === 0) rsi[i] = 100;
    else rsi[i] = 100 - 100 / (1 + avgGain / avgLoss);
  }

  return rsi;
}

/** Port of Python calculate_scores */
export function calculateRealScore(candles: Candle[], macroScore: number = 0, macroReason: string = ""): ScoreData {
  if (candles.length < 50) {
    return {
      prob_up: 0.5, prob_down: 0.5, score: 50,
      reasons: ["Esperando más datos para análisis..."],
      support: 0, resistance: 0
    };
  }

  const closes = candles.map(c => c.close);
  const ema50 = calcEMA(closes, 50);
  const rsi14 = calcRSI(closes, 14);

  const lastCandle = candles[candles.length - 1];
  const lastEma = ema50[ema50.length - 1];
  const lastRsi = rsi14[rsi14.length - 1];

  let probUp = 0.50;
  const reasons: string[] = [];

  // 1. Trend Alignment
  if (lastCandle.close > lastEma) {
    probUp += 0.10;
    reasons.push("Sobre EMA50 (Tendencia Alcista)");
  } else {
    probUp -= 0.10;
    reasons.push("Bajo EMA50 (Tendencia Bajista)");
  }

  // 2. RSI
  if (lastRsi < 30) {
    probUp += 0.15;
    reasons.push("RSI Sobrevendido (Posible Rebote)");
  } else if (lastRsi > 70) {
    probUp -= 0.15;
    reasons.push("RSI Sobrecomprado (Sobre extendido)");
  } else {
    reasons.push("RSI Neutral");
  }

  // 3. FVG (Fair Value Gaps) - Smart Money Concepts
  if (candles.length > 3) {
    const c1 = candles[candles.length - 3];
    const c2 = candles[candles.length - 2]; // The FVG candle
    const c3 = candles[candles.length - 1];
    
    // Bullish FVG: Low of candle 3 > High of candle 1, and candle 2 was bullish
    if (c3.low > c1.high && c2.close > c2.open) {
      probUp += 0.10;
      reasons.push("Bullish FVG Detectado");
    }
    // Bearish FVG: High of candle 3 < Low of candle 1, and candle 2 was bearish
    else if (c3.high < c1.low && c2.close < c2.open) {
      probUp -= 0.10;
      reasons.push("Bearish FVG Detectado");
    }
  }

  // 4. Macro Influence
  if (macroScore !== 0) {
    probUp += (macroScore / 100);
    if (macroReason) reasons.push(macroReason);
  }

  // Final Clamping
  probUp = Math.min(0.95, Math.max(0.05, probUp));
  const probDown = 1.0 - probUp;
  const score = probUp * 100;

  // Support & Resistance (Swing Highs/Lows in last 20 candles)
  const window20 = candles.slice(-20);
  const support = Math.min(...window20.map(c => c.low));
  const resistance = Math.max(...window20.map(c => c.high));

  return {
    prob_up: Number(probUp.toFixed(2)),
    prob_down: Number(probDown.toFixed(2)),
    score: Number(score.toFixed(1)),
    reasons,
    support,
    resistance
  };
}
