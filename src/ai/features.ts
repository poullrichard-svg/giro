/**
 * Pontos de entrada da IA no app. Cada um diz o que pergunta e com quais dados.
 * Os marcados como "em breve" já têm o prompt pronto; falta só a tela.
 */
export type AIFeatureId = 'chat' | 'semana' | 'alertas' | 'motorista' | 'voz-foto';

export interface AIFeature { id: AIFeatureId; title: string; description: string; ready: boolean; question?: string }

export const AI_FEATURES: AIFeature[] = [
  { id: 'chat', title: 'Pergunte ao Giro', description: 'Tire dúvidas sobre o seu dinheiro em linguagem normal.', ready: true },
  { id: 'semana', title: 'Resumo da semana', description: 'Como foi a semana comparada à anterior.', ready: true,
    question: 'Faça um resumo curto da minha semana: quanto entrou, quanto saiu, comparação com a semana anterior e 1 ou 2 pontos de atenção.' },
  { id: 'alertas', title: 'Gastos fora do normal', description: 'Categorias acima da média e assinaturas que você pode ter esquecido.', ready: true,
    question: 'Tem algum gasto fora do normal este mês ou alguma assinatura/gasto recorrente que eu possa ter esquecido? Se não houver, diga isso.' },
  { id: 'motorista', title: 'Dicas para motorista', description: 'Melhores dias, horários e aplicativos pelos seus números.', ready: true,
    question: 'Com base nos meus turnos, quais dias, horários e aplicativos me dão mais lucro por hora? Dê 3 dicas práticas.' },
  { id: 'voz-foto', title: 'Lançar por voz ou foto', description: 'Fale "gastei 50 no mercado" ou fotografe o comprovante.', ready: false },
];

export const SYSTEM_PROMPT = `Você é o assistente financeiro do Giro, um app brasileiro de controle de gastos usado muito por motoristas de aplicativo e entregadores.

Responda em português do Brasil, em tom próximo e direto, sem jargão. Seja breve: no máximo uns 6 a 10 linhas, a não ser que a pessoa peça detalhes. Use valores em reais (R$ 1.234,56). Pode usar listas curtas com "-".

Baseie-se somente nos dados do resumo abaixo. Se faltar informação para responder, diga o que falta e como registrar no app. Não invente números. Não recomende investimentos específicos (ações, fundos ou produtos de bancos); pode explicar conceitos gerais.

Sobre os dados: valores mensais incluem contas fixas; "projectedEndOfMonth" é o saldo previsto no fim do mês; "recurringExpenses" são gastos que se repetiram em 3+ meses com valor parecido (possíveis assinaturas); "unusualSpending" são categorias bem acima da média dos 3 meses anteriores; "driver" vem do painel do motorista (pode ser null se a pessoa não registra turnos).`;

/** Prompt já preparado para o lançamento por voz/foto (ainda sem tela). */
export const ENTRY_PROMPT = `Extraia um lançamento financeiro do texto ou da imagem. Responda só com JSON no formato
{"type":"expense"|"income","amount":number,"description":string,"category":string,"date":"YYYY-MM-DD"|null}.`;
