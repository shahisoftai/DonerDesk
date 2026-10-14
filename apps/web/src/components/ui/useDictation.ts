"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Minimal typing for the (prefixed) Web Speech API; not in lib.dom. */
type SpeechResultEvent = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
};
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Writes through the native setter so React's onChange fires for controlled and uncontrolled fields alike. */
export function insertAtCaret(el: HTMLTextAreaElement, text: string) {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  const before = el.value.slice(0, start);
  const after = el.value.slice(end);
  const needsSpace = before.length > 0 && !/\s$/.test(before);
  let chunk = (needsSpace ? " " : "") + text;
  if (el.maxLength > 0) {
    const room = el.maxLength - (el.value.length - (end - start));
    if (room <= 0) return;
    chunk = chunk.slice(0, room);
  }
  const next = before + chunk + after;
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(el, next);
  const caret = before.length + chunk.length;
  el.setSelectionRange(caret, caret);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

export type DictationState = "idle" | "listening" | "denied" | "error";

/** `onStart` runs before listening begins (e.g. place the caret); `onText` receives each finished phrase. */
export function useDictation(onText: (text: string) => void, onStart?: () => void) {
  const [state, setState] = useState<DictationState>("idle");
  const [supported, setSupported] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const textRef = useRef(onText);
  textRef.current = onText;

  useEffect(() => {
    setSupported(getCtor() !== null);
    return () => recRef.current?.stop();
  }, []);

  const stop = useCallback(() => recRef.current?.stop(), []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    onStart?.();
    const rec = new Ctor();
    rec.lang = document.documentElement.lang === "en" || !document.documentElement.lang ? navigator.language || "en-US" : document.documentElement.lang;
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r?.[0]?.transcript.trim();
        if (r?.isFinal && text) textRef.current(text);
      }
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setState("denied");
      else if (e.error !== "no-speech" && e.error !== "aborted") setState("error");
    };
    rec.onend = () => {
      recRef.current = null;
      setState((s) => (s === "denied" || s === "error" ? s : "idle"));
    };
    recRef.current = rec;
    setState("listening");
    try {
      rec.start();
    } catch {
      setState("error");
    }
  }, [onStart]);

  const toggle = useCallback(() => (recRef.current ? stop() : start()), [start, stop]);

  return { supported, state, toggle };
}
