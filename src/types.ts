export type TxType = 'income' | 'expense';

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: TxType;
  category: string;
  paymentMethod: string;
  date: string; // YYYY-MM-DD
  vehicleId?: string | null;
  /** Conta de onde saiu/entrou o dinheiro. Compras no cartão não têm conta (têm cartão). */
  accountId?: string | null;
  cardId?: string | null;
  /** Mês da fatura do cartão (YYYY-MM). A compra conta no orçamento deste mês. */
  invoiceMonth?: string | null;
  installmentGroup?: string | null;
  installmentIndex?: number | null; // 1..N
  installmentCount?: number | null;
  /**
   * Movimentação interna: transferência entre contas ou pagamento de fatura.
   * Mexe no saldo das contas, mas não conta como receita/despesa (evita contar em dobro).
   */
  internal?: 'transfer' | 'invoice-payment' | 'fixed-payment' | null;
  transferGroup?: string | null;
  /** Identificador do banco (FITID do OFX) — evita importar o mesmo lançamento duas vezes. */
  externalId?: string | null;
  /** Foto do comprovante (coleção "attachments"). */
  attachmentId?: string | null;
}

export type AccountKind = 'corrente' | 'poupanca' | 'carteira' | 'investimento' | 'outro';

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  color: string;
  initialBalance: number;
  archived?: boolean;
}

export interface Card {
  id: string;
  name: string;
  color: string;
  limit: number;
  closingDay: number;
  dueDay: number;
  /** Conta usada por padrão para pagar a fatura. */
  accountId?: string | null;
  archived?: boolean;
}

/** Conta fixa (recorrente todo mês). Tabela: fixed_transactions */
export interface FixedBill {
  id: string;
  description: string;
  amount: number;
  type: TxType;
  category: string;
  dueDay?: number | null;
}

/** Marca uma conta fixa como paga/recebida em um mês. Tabela: fixed_payments */
export interface FixedPayment {
  id: string;
  fixedId: string;
  month: string; // YYYY-MM
  amount: number;
  paidAt: string;
  /** Lançamento (interno) que tirou/colocou o dinheiro na conta. */
  transactionId?: string | null;
}

/** Tipo de serviço: transporte de passageiros, entregas, ou trabalho fixo/diária. */
export type WorkKind = 'passageiro' | 'entrega' | 'fixo';
export type VehicleKind = 'carro' | 'moto' | 'bike' | 'van';

export interface DriverSession {
  id: string;
  date: string;
  /** Nome da plataforma (Uber, iFood, Mercado Livre…). */
  app: string;
  platformId?: string | null;
  workKind?: WorkKind | null;
  amount: number;
  trips: number;
  kmDriven: number;
  hoursWorked: string; // HH:mm
  /** Horário em que começou a trabalhar (HH:mm) — usado na análise de melhores horários. */
  startTime?: string | null;
  fuelSpent: number;
  foodSpent: number;
  fuelConsumption: number;
  observation?: string | null;
  vehicleId?: string | null;
}

export type VehicleOwnership = 'owned' | 'financed' | 'rented';

export interface Vehicle {
  id: string;
  name: string;
  brand?: string | null;
  model?: string | null;
  year?: number | null;
  plate: string;
  color?: string | null;
  renavam?: string | null;
  fuelType: string;
  ownership: VehicleOwnership;
  kind?: VehicleKind | null;
  odometer: number;
  fuelConsumption: number; // km/l
  ipvaValue: number;
  ipvaDueDate?: string | null;
  licensingValue: number;
  licensingDueDate?: string | null;
  insuranceValue: number; // mensal
  insuranceDueDate?: string | null;
  installmentValue: number; // parcela do financiamento ou aluguel semanal->mensal
  installmentsRemaining?: number | null;
  oilIntervalKm: number;
  lastOilChangeKm?: number | null;
  /** Reserva de manutenção: custos para calcular quanto separar por km. */
  oilChangeCost?: number | null;
  tireSetCost?: number | null;
  tireLifeKm?: number | null;
  revisionCost?: number | null;
  revisionIntervalKm?: number | null;
  /** Hodômetro e data em que a reserva começou a ser contada. */
  reserveStartKm?: number | null;
  reserveStartDate?: string | null;
  notes?: string | null;
  active: boolean;
}

export interface VehicleExpense {
  id: string;
  vehicleId: string;
  date: string;
  category: string;
  amount: number;
  odometer?: number | null;
  liters?: number | null;
  description?: string | null;
}

export type GoalType = 'financial' | 'activity';

export interface Goal {
  id: string;
  description: string;
  targetAmount: number;
  currentAmount: number;
  type: GoalType;
  deadline?: string | null;
  /** Ícone (nome da lista GOAL_ICONS) e cor escolhidos pelo usuário. */
  icon?: string | null;
  color?: string | null;
}

/** Aporte (positivo) ou retirada (negativo) numa meta. */
export interface GoalContribution {
  id: string;
  goalId: string;
  amount: number;
  date: string;
  note?: string | null;
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  estimatedPrice: number;
  completed: boolean;
}

export interface Platform {
  id: string;
  name: string;
  color: string;
  kind: WorkKind;
  vehicle?: VehicleKind;
  enabled: boolean;
  custom?: boolean;
}

/** Perfil de trabalho do usuário (fica na coleção "settings", id "work"). */
export interface WorkProfile {
  id: string;
  types: string[];
  platforms: Platform[];
  dailyGoal: number;
}

/** Limite mensal de gastos para uma categoria. */
export interface Budget {
  id: string;
  category: string;
  limit: number;
}

/** Foto de comprovante, já comprimida (JPEG em data URL). */
export interface Attachment {
  id: string;
  transactionId?: string | null;
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
}

/** Simulação salva de uma calculadora (valores digitados + resumo do resultado). */
export interface Simulation {
  id: string;
  calc: string;
  title: string;
  values: Record<string, unknown>;
  summary: string;
}

/** Dívidas: acordos, faculdade, empréstimos, cartão… Cada uma com suas parcelas. */
export type DebtKind = 'acordo' | 'faculdade' | 'cartao' | 'emprestimo' | 'financiamento' | 'contas' | 'pessoal' | 'outro';
export interface DebtInstallment {
  id: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  /** Data em que foi paga (null = em aberto). */
  paidAt?: string | null;
  /** Lançamento criado ao marcar como paga. */
  transactionId?: string | null;
}
export interface Debt {
  id: string;
  creditor: string;
  description?: string | null;
  kind: DebtKind;
  /** Categoria dos lançamentos ao pagar. */
  category: string;
  /** Juros ao mês (%), se souber. Usado para decidir qual quitar primeiro. */
  monthlyRate?: number | null;
  /** Quanto era a dívida antes de negociar (para mostrar o desconto conseguido). */
  originalAmount?: number | null;
  installments: DebtInstallment[];
  notes?: string | null;
}

/** Preferências do app (um registro só, id "app"). Sincroniza entre aparelhos. */
export interface AppPrefs {
  id: string;
  /** Modo motorista/entregador. null = decide sozinho (perfil, turnos registrados). */
  driver?: boolean | null;
  /** Abas ligadas/desligadas pelo usuário. Ausente = padrão. */
  tabs?: Record<string, boolean>;
  /** Ativos favoritos no painel de investimentos (tickers). */
  watchlist?: string[];
}

/** Operação da carteira de investimentos (compra, venda ou atualização de valor da renda fixa). */
export type InvestmentKind = 'acao' | 'fii' | 'etf' | 'bdr' | 'cripto' | 'renda-fixa' | 'outro';
export interface InvestmentOp {
  id: string;
  /** Código (PETR4, BTC) ou nome (ex.: "CDB Banco Inter 120% CDI"). */
  ticker: string;
  kind: InvestmentKind;
  side: 'compra' | 'venda' | 'valor';
  quantity: number;
  /** Preço unitário. Em "valor": valor total atual da posição. */
  price: number;
  fees?: number | null;
  date: string;
  note?: string | null;
  /** Para não importar a mesma linha duas vezes. */
  externalId?: string | null;
}
