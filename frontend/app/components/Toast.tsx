"use client";
import React, { useEffect, useState } from "react";

let showToastFn: (msg: string) => void = () => {};

export function toast(msg: string) { showToastFn(msg); }

export default function ToastProvider() {
  const [msg, setMsg] = useState("");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    showToastFn = (m: string) => {
      setMsg(m);
      setVisible(true);
      setTimeout(() => setVisible(false), 2500);
    };
  }, []);

  if (!visible) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] toast bg-surface-2 border border-brand/30 text-brand px-5 py-3 rounded-xl text-sm font-semibold shadow-lg shadow-brand/10">
      {msg}
    </div>
  );
}
