"use client";
import React, { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, LineData, Time, CandlestickData } from 'lightweight-charts';

interface ChartProps {
  data: CandlestickData[];
  liveCandle: CandlestickData | null;
  support?: number;
  resistance?: number;
}

export default function ChartComponent({ data, liveCandle, support, resistance }: ChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const supportSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const resistanceSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  useEffect(() => {
    if (chartContainerRef.current) {
      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { type: 'solid', color: '#151924' },
          textColor: '#D1D4DC',
        },
        grid: {
          vertLines: { color: '#2B3139' },
          horzLines: { color: '#2B3139' },
        },
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight,
        timeScale: {
          timeVisible: true,
          secondsVisible: true,
        }
      });
      chartRef.current = chart;

      const candleSeries = chart.addCandlestickSeries({
        upColor: '#26A69A',
        downColor: '#EF5350',
        borderVisible: false,
        wickUpColor: '#26A69A',
        wickDownColor: '#EF5350',
      });
      candleSeriesRef.current = candleSeries;
      
      const supSeries = chart.addLineSeries({
        color: '#26A69A',
        lineWidth: 2,
        lineStyle: 2,
        title: 'Support',
      });
      supportSeriesRef.current = supSeries;
      
      const resSeries = chart.addLineSeries({
        color: '#EF5350',
        lineWidth: 2,
        lineStyle: 2,
        title: 'Resistance',
      });
      resistanceSeriesRef.current = resSeries;

      candleSeries.setData(data);

      const handleResize = () => {
        chart.applyOptions({
          width: chartContainerRef.current?.clientWidth,
          height: chartContainerRef.current?.clientHeight,
        });
      };
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        chart.remove();
      };
    }
  }, [data]); // Data should ideally be set once or controlled differently, but for simplicity we assume it loads.

  useEffect(() => {
    if (liveCandle && candleSeriesRef.current) {
      candleSeriesRef.current.update(liveCandle);
      
      if (supportSeriesRef.current && support) {
        supportSeriesRef.current.update({ time: liveCandle.time, value: support });
      }
      if (resistanceSeriesRef.current && resistance) {
        resistanceSeriesRef.current.update({ time: liveCandle.time, value: resistance });
      }
    }
  }, [liveCandle, support, resistance]);

  return (
    <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
  );
}
