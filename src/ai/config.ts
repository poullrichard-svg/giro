import { useEffect, useState } from 'react';

/** Configuração da IA. Fica só neste aparelho (localStorage) e não entra no backup. */
export interface AIConfig {
  apiKey: string;
  /** Enviar descrições de lançamentos (ex.: "Netflix") — melhora alertas de assinatura, mas expõe mais dados. */
  shareDescriptions: boolean;
}

export const AI_KEY = 'giro.ai';
export const AI_MODEL = 'claude-opus-5-5';
const EVENT = 'giro-ai-config';
const DEFAULT: AIConfig = { apiKey: '', shareDescriptions: false };

export function getAIConfig(): AIConfig {
  try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem(AI_KEY) ?? '{}') }; } catch { return DEFAULT; }
}

export function setAIConfig(patch: Partial<AIConfig>) {
  const next = { ...getAIConfig(), ...patch };
  try {
    if (!next.apiKey && !next.shareDescriptions) localStorage.removeItem(AI_KEY);
    else localStorage.setItem(AI_KEY, JSON.stringify(next));
  } catch { /* armazenamento bloqueado: segue só na memória desta sessão */ }
  window.dispatchEvent(new Event(EVENT));
  return next;
}

/** Formato das chaves da Anthropic (sk-ant-…). Só uma checagem rápida; quem valida de verdade é a API. */
export const looksLikeKey = (k: string) => /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(k.trim());
export const maskKey = (k: string) => (k ? `${k.slice(0, 10)}…${k.slice(-4)}` : '');

export function useAIConfig() {
  const [cfg, setCfg] = useState(getAIConfig);
  useEffect(() => {
    const on = () => setCfg(getAIConfig());
    window.addEventListener(EVENT, on); window.addEventListener('storage', on);
    return () => { window.removeEventListener(EVENT, on); window.removeEventListener('storage', on); };
  }, []);
  return cfg;
}
