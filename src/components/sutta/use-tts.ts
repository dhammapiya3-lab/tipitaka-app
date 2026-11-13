"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** 읽어 줄 문장 하나 */
export interface TtsItem {
  key: string;
  text: string;
}

export type TtsLang = "ko" | "pli";

/**
 * 빠알리는 빠알리 음성이 없어, 소리값이 비슷한 언어 음성을 고른다 (싱할라 → 힌디 → 이탈리아 → 기본).
 * 기기마다 깔린 음성이 달라 소리가 다를 수 있다.
 */
const PALI_VOICE_LANGS = ["si", "hi", "it", "es", "en"];

function pickVoice(lang: TtsLang): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (lang === "ko") return voices.find((v) => v.lang.toLowerCase().startsWith("ko")) ?? null;
  for (const prefix of PALI_VOICE_LANGS) {
    const v = voices.find((x) => x.lang.toLowerCase().startsWith(prefix));
    if (v) return v;
  }
  return null;
}

/**
 * 브라우저 음성 합성(Web Speech API)으로 문장을 하나씩 읽는다.
 * 문장마다 따로 읽어서, 지금 읽는 문장을 표시하고 앞뒤로 옮길 수 있다.
 */
export function useTts(items: TtsItem[], onItem?: (key: string) => void, onError?: (error: string) => void) {
  const onItemRef = useRef(onItem);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onItemRef.current = onItem;
    onErrorRef.current = onError;
  }, [onItem, onError]);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [current, setCurrent] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  const runId = useRef(0);

  const speakFrom = useCallback(
    (key: string, opts: { lang: TtsLang; rate: number }) => {
      if (!supported) return;
      const synth = window.speechSynthesis;
      const id = ++runId.current;
      synth.cancel();
      const list = itemsRef.current;
      let index = list.findIndex((i) => i.key === key);
      if (index < 0) index = 0;
      const step = () => {
        if (id !== runId.current) return;
        const item = itemsRef.current[index];
        if (!item) {
          setPlaying(false);
          setCurrent(null);
          return;
        }
        setCurrent(item.key);
        onItemRef.current?.(item.key);
        const u = new SpeechSynthesisUtterance(item.text);
        const voice = pickVoice(opts.lang);
        if (voice) u.voice = voice;
        u.lang = voice?.lang ?? (opts.lang === "ko" ? "ko-KR" : "it-IT");
        u.rate = opts.rate;
        u.onend = () => {
          if (id !== runId.current) return;
          index++;
          step();
        };
        u.onerror = (e) => {
          if (id !== runId.current || e.error === "interrupted" || e.error === "canceled") return;
          // 이 기기에 맞는 음성이 없거나 소리를 낼 수 없으면 멈추고 알린다
          runId.current++;
          setPlaying(false);
          setCurrent(null);
          onErrorRef.current?.(e.error);
        };
        synth.speak(u);
      };
      setPlaying(true);
      step();
    },
    [supported],
  );

  const stop = useCallback(() => {
    runId.current++;
    if (supported) window.speechSynthesis.cancel();
    setPlaying(false);
    setCurrent(null);
  }, [supported]);

  const pause = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.pause();
    setPlaying(false);
  }, [supported]);

  const resume = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.resume();
    setPlaying(true);
  }, [supported]);

  // 화면을 떠나면 멈춘다
  useEffect(
    () => () => {
      runId.current++;
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    },
    [],
  );
  // 음성 목록은 늦게 채워지는 브라우저가 있다 (크롬)
  useEffect(() => {
    if (!supported) return;
    window.speechSynthesis.getVoices();
  }, [supported]);

  return { supported, current, playing, rate, setRate, speakFrom, stop, pause, resume };
}
