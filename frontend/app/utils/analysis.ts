export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradingSignal {
  direction: "STRONG LONG" | "LONG" | "NEUTRAL" | "SHORT" | "STRONG SHORT";
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  riskReward: string;
}

export interface ScoreData {
  score: number;
  prob_up: number;
  prob_down: number;
  reasons: string[];
  support: number;
  resistance: number;
  signal: TradingSignal | null;
}

export interface HistoricalScore {
  time: number;
  value: number;
}

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

/** Calculates Score and Actionable Signal for the current candle */
export function calculateRealScore(candles: Candle[], macroScore: number = 0, macroReason: string = ""): ScoreData {
  if (candles.length < 50) {
    return {
      prob_up: 0.5, prob_down: 0.5, score: 50,
      reasons: ["Esperando más datos..."],
      support: 0, resistance: 0, signal: null
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

  // 3. FVG (Fair Value Gaps)
  if (candles.length > 3) {
    const c1 = candles[candles.length - 3];
    const c2 = candles[candles.length - 2];
    const c3 = candles[candles.length - 1];
    
    if (c3.low > c1.high && c2.close > c2.open) {
      probUp += 0.10;
      reasons.push("Bullish FVG Detectado");
    } else if (c3.high < c1.low && c2.close < c2.open) {
      probUp -= 0.10;
      reasons.push("Bearish FVG Detectado");
    }
  }

  // 4. Macro Influence
  if (macroScore !== 0) {
    probUp += (macroScore / 100);
    if (macroReason) reasons.push(macroReason);
  }

  probUp = Math.min(0.95, Math.max(0.05, probUp));
  const probDown = 1.0 - probUp;
  const score = probUp * 100;

  // Support & Resistance (Swing Highs/Lows in last 20 candles)
  const window20 = candles.slice(-20);
  const support = Math.min(...window20.map(c => c.low));
  const resistance = Math.max(...window20.map(c => c.high));

  // --- Generate Actionable Signal ---
  let direction: TradingSignal["direction"] = "NEUTRAL";
  if (score >= 80) direction = "STRONG LONG";
  else if (score >= 65) direction = "LONG";
  else if (score <= 20) direction = "STRONG SHORT";
  else if (score <= 35) direction = "SHORT";

  const entry = lastCandle.close;
  // Calculate ATR for dynamic SL/TP
  const atrWindow = candles.slice(-14);
  let trSum = 0;
  for (let i = 1; i < atrWindow.length; i++) {
    const prevC = atrWindow[i-1].close;
    const h = atrWindow[i].high;
    const l = atrWindow[i].low;
    trSum += Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC));
  }
  const atr = trSum / 14 || (entry * 0.01); // Fallback to 1%

  let stopLoss = 0;
  let takeProfit1 = 0;
  let takeProfit2 = 0;

  if (direction.includes("LONG")) {
    stopLoss = support < entry ? support - (atr * 0.5) : entry - (atr * 1.5);
    const risk = entry - stopLoss;
    takeProfit1 = entry + (risk * 1.5);
    takeProfit2 = entry + (risk * 3);
  } else if (direction.includes("SHORT")) {
    stopLoss = resistance > entry ? resistance + (atr * 0.5) : entry + (atr * 1.5);
    const risk = stopLoss - entry;
    takeProfit1 = entry - (risk * 1.5);
    takeProfit2 = entry - (risk * 3);
  }

  const signal: TradingSignal | null = direction === "NEUTRAL" ? null : {
    direction,
    entry,
    stopLoss: Number(stopLoss.toFixed(2)),
    takeProfit1: Number(takeProfit1.toFixed(2)),
    takeProfit2: Number(takeProfit2.toFixed(2)),
    riskReward: "1 : 1.5"
  };

  return {
    prob_up: Number(probUp.toFixed(2)),
    prob_down: Number(probDown.toFixed(2)),
    score: Number(score.toFixed(1)),
    reasons,
    support,
    resistance,
    signal
  };
}

/** Vectorized historical calculation for the secondary chart oscillator */
export function calculateHistoricalScores(candles: Candle[], macroScore: number = 0): HistoricalScore[] {
  if (candles.length < 50) return [];
  
  const closes = candles.map(c => c.close);
  const ema50 = calcEMA(closes, 50);
  const rsi14 = calcRSI(closes, 14);

  const history: HistoricalScore[] = [];

  for (let i = 50; i < candles.length; i++) {
    let probUp = 0.50;
    
    // Trend
    if (candles[i].close > ema50[i]) probUp += 0.10;
    else probUp -= 0.10;

    // RSI
    if (rsi14[i] < 30) probUp += 0.15;
    else if (rsi14[i] > 70) probUp -= 0.15;

    // FVG
    if (i > 3) {
      const c1 = candles[i - 2];
      const c2 = candles[i - 1];
      const c3 = candles[i];
      if (c3.low > c1.high && c2.close > c2.open) probUp += 0.10;
      else if (c3.high < c1.low && c2.close < c2.open) probUp -= 0.10;
    }

    if (macroScore !== 0) probUp += (macroScore / 100);

    probUp = Math.min(0.95, Math.max(0.05, probUp));
    history.push({
      time: candles[i].time,
      value: Number((probUp * 100).toFixed(1))
    });
  }

  return history;
}
