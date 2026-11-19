/** Resumo de privacidade e termos de uso. Modelo simples — revise com um profissional antes de crescer. */
export function PrivacyText() {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-slate-300">
      <p className="font-display font-black text-white">Privacidade</p>
      <ul className="list-disc space-y-1.5 pl-5">
        <li>Guardamos o seu e-mail, o seu perfil (nome, data de nascimento, foto opcional, ocupação, renda se você informar, cidade e estado) e os dados que você lança no app (lançamentos, contas, metas, turnos, veículos e fotos de comprovantes) para sincronizar entre os seus aparelhos.</li>
        <li><b className="text-white">Estatísticas anônimas (opcional):</b> se você marcar essa opção no perfil, seus números entram em médias gerais do Giro (por exemplo, gasto médio por categoria ou ganho por hora por aplicativo). Só aparecem grupos com pelo menos 5 pessoas e nunca dados individuais. Você pode desligar quando quiser.</li>
        <li>É preciso ter 18 anos ou mais para usar o Giro.</li>
        <li>Os dados ficam no Supabase (servidor na nuvem) e só a sua conta tem acesso a eles. Não vendemos nem compartilhamos seus dados.</li>
        <li>O app também guarda uma cópia no seu aparelho para funcionar sem internet. Ao sair da conta, essa cópia é apagada.</li>
        <li>Se você usar o assistente de IA, um resumo dos seus números é enviado à Anthropic (Claude) só quando você faz uma pergunta.</li>
        <li>Você pode baixar seus dados (Ajustes → Backup) e excluir a conta com todos os dados a qualquer momento (Ajustes → Conta).</li>
      </ul>
      <p className="font-display font-black text-white">Termos de uso</p>
      <ul className="list-disc space-y-1.5 pl-5">
        <li>O Giro é uma ferramenta de organização. Cálculos e sugestões (inclusive da IA) são estimativas e não substituem orientação financeira, contábil ou jurídica.</li>
        <li>Você é responsável pelos dados que cadastra e por manter sua senha em segredo.</li>
        <li>O serviço pode mudar ou ficar fora do ar temporariamente. Mantenha backups do que for importante.</li>
      </ul>
    </div>
  );
}
