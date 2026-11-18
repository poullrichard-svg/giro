/**
 * Camada de serviço da IA (Claude). Todo acesso à API passa por aqui —
 * as telas nunca falam com a Anthropic diretamente.
 *
 * A chave fica só neste aparelho e a chamada sai direto do navegador para a API
 * (uso pessoal). Para abrir o app a outras pessoas, troque `createClient` por uma
 * função no servidor (ex.: api/ia.js na Vercel) que guarda a chave em variável de ambiente.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { AI_MODEL, getAIConfig } from './config';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export class AIError extends Error {
  constructor(message: string, public kind: 'no-key' | 'auth' | 'limit' | 'network' | 'refusal' | 'other') { super(message); }
}

async function createClient() {
  const { apiKey } = getAIConfig();
  if (!apiKey) throw new AIError('Configure sua chave da API do Claude em Ajustes.', 'no-key');
  // Import sob demanda: o SDK só é baixado por quem usa a IA.
  const { default: AnthropicSDK } = await import('@anthropic-ai/sdk');
  return { client: new AnthropicSDK({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 }), AnthropicSDK };
}

function friendly(e: unknown, SDK?: typeof Anthropic): AIError {
  if (e instanceof AIError) return e;
  if (SDK) {
    if (e instanceof SDK.AuthenticationError || e instanceof SDK.PermissionDeniedError) return new AIError('Chave inválida ou sem permissão. Confira em Ajustes.', 'auth');
    if (e instanceof SDK.RateLimitError) return new AIError('Muitas perguntas seguidas. Espere um pouco e tente de novo.', 'limit');
    if (e instanceof SDK.APIConnectionError) return new AIError('Sem conexão com a IA. Verifique sua internet.', 'network');
    if (e instanceof SDK.APIError) return new AIError(`A IA não respondeu (${e.status ?? 'erro'}). Tente de novo em instantes.`, 'other');
  }
  return new AIError('Não foi possível falar com a IA agora.', 'other');
}

/**
 * Pergunta ao Claude e devolve o texto da resposta.
 * `onText` recebe os pedaços conforme chegam (para mostrar a resposta "sendo escrita").
 */
export async function askClaude(opts: { system: string; messages: ChatMessage[]; onText?: (delta: string) => void; signal?: AbortSignal; maxTokens?: number }): Promise<string> {
  let SDK: typeof Anthropic | undefined;
  try {
    const { client, AnthropicSDK } = await createClient();
    SDK = AnthropicSDK;
    const stream = client.beta.messages.stream({
      model: AI_MODEL,
      max_tokens: opts.maxTokens ?? 8000,
      // Perguntas do dia a dia: esforço baixo responde rápido e gasta menos.
      output_config: { effort: 'low' },
      // Se o modelo recusar por engano, a própria API tenta de novo num modelo alternativo.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: opts.system,
      messages: opts.messages,
    }, { signal: opts.signal });
    if (opts.onText) stream.on('text', opts.onText);
    const msg = await stream.finalMessage();
    if (msg.stop_reason === 'refusal') throw new AIError('A IA não pôde responder a essa pergunta. Tente reformular.', 'refusal');
    const text = msg.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('').trim();
    if (!text) throw new AIError('A IA não devolveu resposta. Tente de novo.', 'other');
    return text;
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    throw friendly(e, SDK);
  }
}

/** Confere se a chave funciona com uma pergunta mínima. */
export async function testKey(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await askClaude({ system: 'Responda apenas "ok".', messages: [{ role: 'user', content: 'teste' }], maxTokens: 1024 });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
