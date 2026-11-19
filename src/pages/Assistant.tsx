import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, CalendarRange, Car, Eye, KeyRound, Mic, Send, Sparkles, Square, TriangleAlert, User } from 'lucide-react';
import { useData } from '../data/DataProvider';
import { useAIConfig } from '../ai/config';
import { askClaude, AIError, type ChatMessage } from '../ai/client';
import { AI_FEATURES, SYSTEM_PROMPT, type AIFeatureId } from '../ai/features';
import { buildContext } from '../ai/summary';
import { Button, Card, PageHeader, cx } from '../components/ui';
import { localISODate } from '../lib/format';
import { go } from '../router';

const ICON: Record<AIFeatureId, typeof Bot> = { chat: Sparkles, semana: CalendarRange, alertas: TriangleAlert, motorista: Car, 'voz-foto': Mic };

/** Mostra a resposta com listas e **negrito**, sem injetar HTML. */
function RichText({ text }: { text: string }) {
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <strong key={i} className="font-extrabold text-white">{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>));
  return (
    <div className="space-y-1.5">
      {text.split('\n').map((line, i) => {
        const t = line.trim();
        if (!t) return <div key={i} className="h-1" />;
        const bullet = /^[-•*]\s+/.test(t);
        const h = /^#{1,4}\s+/.test(t);
        if (h) return <p key={i} className="pt-1 font-display font-black text-white">{inline(t.replace(/^#{1,4}\s+/, ''))}</p>;
        return bullet ? <p key={i} className="flex gap-2"><span className="text-brand-400">•</span><span>{inline(t.replace(/^[-•*]\s+/, ''))}</span></p> : <p key={i}>{inline(t)}</p>;
      })}
    </div>
  );
}

export default function Assistant() {
  const { data } = useData();
  const cfg = useAIConfig();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCtx, setShowCtx] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const context = useMemo(() => buildContext(data, localISODate(), { shareDescriptions: cfg.shareDescriptions }), [data, cfg.shareDescriptions]);

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages]);
  useEffect(() => () => abort.current?.abort(), []);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setError(null); setDraft('');
    const history: ChatMessage[] = [...messages, { role: 'user', content: q }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setBusy(true);
    abort.current = new AbortController();
    try {
      const answer = await askClaude({
        system: `${SYSTEM_PROMPT}\n\nResumo dos dados (JSON):\n${context}`,
        messages: history.slice(-12),
        signal: abort.current.signal,
        onText: (d) => setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: 'assistant', content: c[c.length - 1].content + d }; return c; }),
      });
      setMessages([...history, { role: 'assistant', content: answer }]);
    } catch (e) {
      setMessages(history.slice(0, -1));
      setDraft(q);
      if ((e as Error).name !== 'AbortError') setError(e instanceof AIError ? e.message : 'Não foi possível falar com a IA agora.');
    } finally { setBusy(false); abort.current = null; }
  };

  if (!cfg.apiKey) {
    return (
      <div>
        <PageHeader eyebrow="Inteligência artificial" title="Assistente" subtitle="Pergunte sobre seu dinheiro em linguagem normal" />
        <div className="tinted relative overflow-hidden rounded-[2rem] p-7" style={{ '--tone': '#16a34a' } as React.CSSProperties}>
          <span className="watermark text-brand-400"><Sparkles size={140} strokeWidth={1.3} /></span>
          <div className="relative max-w-lg">
            <span className="solid mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ '--tone': '#16a34a' } as React.CSSProperties}><KeyRound size={24} /></span>
            <p className="font-display text-2xl font-black text-white">Ative o assistente</p>
            <p className="mt-2 text-sm text-slate-300">O assistente usa o Claude, da Anthropic. Para ligar, cole sua chave da API em Ajustes. A chave fica só neste aparelho e cada pergunta é cobrada na sua conta da Anthropic.</p>
            <Button className="mt-5" onClick={() => go('mais', 'ia')}><KeyRound size={16} /> Configurar chave</Button>
          </div>
        </div>
        <FeatureList onPick={() => go('mais', 'ia')} />
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-14rem)] flex-col">
      <PageHeader eyebrow="Inteligência artificial" title="Assistente" subtitle="Respostas com base nos seus números deste aparelho"
        actions={<Button variant="soft" onClick={() => setShowCtx((v) => !v)}><Eye size={15} /> O que é enviado</Button>} />
      {showCtx && (
        <Card title="Dados enviados a cada pergunta" className="mb-4">
          <p className="mb-3 text-xs text-slate-400">Só totais e categorias — sem fotos, sem contas bancárias. {cfg.shareDescriptions ? 'Descrições de gastos recorrentes estão incluídas.' : 'Descrições dos lançamentos não são enviadas.'}</p>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-2xl bg-black/30 p-3 font-mono text-[10px] text-slate-400">{JSON.stringify(JSON.parse(context), null, 1)}</pre>
        </Card>
      )}

      {messages.length === 0 ? <FeatureList onPick={(q) => send(q)} /> : (
        <div className="flex-1 space-y-3 pb-4">
          {messages.map((m, i) => (
            <div key={i} className={cx('flex gap-2.5', m.role === 'user' && 'flex-row-reverse')}>
              <span className={cx('mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', m.role === 'user' ? 'bg-white/[.06] text-slate-300' : 'solid')} style={m.role === 'assistant' ? ({ '--tone': '#16a34a' } as React.CSSProperties) : undefined}>
                {m.role === 'user' ? <User size={15} /> : <Bot size={15} />}
              </span>
              <div className={cx('min-w-0 max-w-[85%] rounded-[1.4rem] px-4 py-3 text-[14px] leading-relaxed', m.role === 'user' ? 'bg-brand-600/25 text-white ring-1 ring-brand-400/20' : 'surface text-slate-200')} data-role={m.role}>
                {m.content ? (m.role === 'assistant' ? <RichText text={m.content} /> : m.content) : <span className="label animate-pulse text-slate-500">Pensando…</span>}
              </div>
            </div>
          ))}
          <div ref={end} />
        </div>
      )}

      {error && <p role="alert" className="mb-3 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300 ring-1 ring-rose-500/20">{error}</p>}
      <form className="surface sticky bottom-28 z-10 mt-2 flex !bg-[#0d0b17]/95 backdrop-blur-md items-end gap-2 rounded-[1.6rem] p-2 md:bottom-4" onSubmit={(e) => { e.preventDefault(); send(draft); }}>
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={1} maxLength={600} placeholder="Pergunte sobre seus gastos…"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(draft); } }}
          className="max-h-32 min-h-11 min-w-0 flex-1 resize-none bg-transparent px-3 py-2.5 text-base text-white outline-none placeholder:text-slate-500" aria-label="Sua pergunta" />
        {busy
          ? <Button type="button" variant="soft" aria-label="Parar" className="h-11 w-11 min-h-11 px-0" onClick={() => abort.current?.abort()}><Square size={16} /></Button>
          : <Button type="submit" aria-label="Enviar" className="h-11 w-11 min-h-11 px-0" disabled={!draft.trim()}><Send size={17} /></Button>}
      </form>
      <p className="mt-2 text-center text-[10px] font-medium text-slate-600">A IA pode errar. Confira os números antes de decidir.</p>
    </div>
  );
}

function FeatureList({ onPick }: { onPick: (question: string) => void }) {
  return (
    <div className="stagger mt-5 grid gap-3 sm:grid-cols-2">
      {AI_FEATURES.filter((f) => f.id !== 'chat').map((f) => {
        const Icon = ICON[f.id];
        return (
          <button key={f.id} type="button" disabled={!f.ready} onClick={() => f.question && onPick(f.question)}
            className={cx('surface press flex items-start gap-3 rounded-[1.6rem] p-4 text-left', f.ready ? 'surface-hover' : 'opacity-60')}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300"><Icon size={18} /></span>
            <span className="min-w-0">
              <span className="block font-display font-black text-white">{f.title}{!f.ready && <span className="label ml-2 rounded-full bg-white/10 px-2 py-0.5 text-slate-400">em breve</span>}</span>
              <span className="mt-0.5 block text-xs text-slate-400">{f.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
