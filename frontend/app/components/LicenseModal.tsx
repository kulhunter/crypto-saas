"use client";
import React, { useState } from "react";
import { X, ShieldCheck, Copy, Mail, ChevronRight } from "lucide-react";
import { toast } from "./Toast";

const WALLET = "0x1362e63dba3bbc05076a9e8d0f1c5b5e52208427";

interface Props {
  open: boolean;
  onClose: () => void;
  onActivate: (key: string) => void;
}

export default function LicenseModal({ open, onClose, onActivate }: Props) {
  const [key, setKey] = useState("");

  if (!open) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(WALLET);
    toast("✅ Dirección copiada");
  };

  const handleActivate = () => {
    if (key.trim()) {
      onActivate(key.trim());
      localStorage.setItem("cb_key", key.trim());
      toast("🔓 Licencia activada");
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[90] overlay flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-6 animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-brand" /> Plan Pro — $10 USD
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-surface-2 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-3 mb-6">
          {["Señales Pro en Telegram (Criptomiau)", "Predicciones ETH, SOL, BNB", "Algoritmo Macro Correlación", "Sin renovaciones, pago único"].map((t, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
              <ChevronRight className="w-4 h-4 text-brand shrink-0" /> {t}
            </div>
          ))}
        </div>

        <div className="bg-bg border border-border rounded-xl p-4 mb-4">
          <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">Envía 10 USDT (BSC BEP20) a:</p>
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono text-brand break-all flex-1">{WALLET}</code>
            <button onClick={handleCopy} className="p-2 hover:bg-surface-2 rounded-lg shrink-0 btn-press">
              <Copy className="w-4 h-4 text-brand" />
            </button>
          </div>
        </div>

        <p className="text-[11px] text-gray-500 text-center mb-4">
          Envía comprobante a <a href="mailto:dan.tagle2023@gmail.com" className="text-brand font-bold">dan.tagle2023@gmail.com</a> y recibe tu clave en 24h.
        </p>

        <div className="border-t border-border pt-4">
          <p className="text-xs text-gray-500 mb-2 font-semibold">¿Ya tienes tu clave?</p>
          <input
            type="text" placeholder="Ingresa tu clave aquí..."
            value={key} onChange={e => setKey(e.target.value)}
            className="w-full bg-bg border border-border p-3 rounded-xl mb-3 text-sm focus:border-brand outline-none transition-colors"
          />
          <button onClick={handleActivate} className="w-full py-3 bg-brand text-bg font-bold rounded-xl hover:brightness-110 transition-all btn-press">
            Activar Licencia
          </button>
        </div>
      </div>
    </div>
  );
}
