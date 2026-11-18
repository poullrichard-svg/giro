import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ExternalLink, KeyRound, Sparkles, Trash2 } from 'lucide-react';
import { looksLikeKey, maskKey, setAIConfig, useAIConfig } from '../ai/config';
import { testKey } from '../ai/client';
import { useToast } from '../data/toast';
import { Button, Card, Check, Field, Input } from './ui';
import { go } from '../router';

/** Cartão de Ajustes: chave da API do Claude e privacidade. */
export function AISettings({ focus }: { focus?: boolean }) {
  const cfg = useAIConfig();
  const toast = useToast();
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (focus) setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300); }, [focus]);
  useEffect(() => setError(null), [key]);

  const save = async () => {
    const k = key.trim();
    if (!looksLikeKey(k)) { setError('A chave começa com "sk-ant-". Copie ela inteira do console da Anthropic.'); return; }
    setAIConfig({ apiKey: k }); setTesting(true);
    const r = await testKey();
    setTesting(false);
    if (r.ok) { setKey(''); toast('Assistente ativado'); }
    else { setAIConfig({ apiKey: '' }); setError(r.error); }
  };

  return (
    <div ref={ref} id="ia" className="scroll-mt-6">
      <Card title={<span className="flex items-center gap-2"><Sparkles size={16} className="text-brand-400" /> Inteligência artificial (Claude)</span>}>
        {cfg.apiKey ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-300"><CheckCircle2 size={16} /> Assistente ativo · chave {maskKey(cfg.apiKey)}</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => go('assistente')}><Sparkles size={15} /> Abrir assistente</Button>
              <Button variant="danger" onClick={() => { setAIConfig({ apiKey: '' }); toast('Chave removida deste aparelho'); }}><Trash2 size={15} /> Remover chave</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-400">Cole sua chave da API da Anthropic para conversar com o assistente sobre seus gastos. Cada pergunta é cobrada na sua conta da Anthropic (centavos por pergunta).</p>
            <Field label="Chave da API" error={error ?? undefined}>
              <Input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-..." />
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={save} disabled={testing || !key.trim()}><KeyRound size={15} /> {testing ? 'Testando…' : 'Salvar e testar'}</Button>
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="label flex items-center gap-1 text-brand-300">Pegar uma chave <ExternalLink size={12} /></a>
            </div>
          </div>
        )}
        <div className="mt-4 space-y-2 border-t border-white/[.06] pt-4">
          <div className="flex items-center gap-3">
            <Check checked={cfg.shareDescriptions} onChange={() => setAIConfig({ shareDescriptions: !cfg.shareDescriptions })} label="Enviar nomes de gastos recorrentes" />
            <span className="text-sm text-slate-300">Enviar nomes de gastos recorrentes (ex.: Netflix) para achar assinaturas esquecidas</span>
          </div>
          <p className="text-[11px] text-slate-500">Privacidade: a chave fica só neste aparelho e não vai no backup. A cada pergunta o app envia um resumo (totais por mês e categoria, metas, painel do motorista) direto para a Anthropic. Fotos, contas bancárias e lançamentos individuais não são enviados. Veja exatamente o que vai em "O que é enviado", no assistente.</p>
        </div>
      </Card>
    </div>
  );
}
