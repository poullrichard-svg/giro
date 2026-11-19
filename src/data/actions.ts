/** Ações que mexem em mais de uma coleção ao mesmo tempo. */
import { useCallback } from 'react';
import type { Debt, DebtInstallment, FixedBill } from '../types';
import { useData } from './DataProvider';
import { localISODate, monthLabel } from '../lib/format';

/**
 * Marca uma conta fixa como paga (ou receita fixa como recebida) no mês:
 * registra o pagamento e um lançamento interno na conta padrão, para o saldo da conta ficar certo.
 * O lançamento é "interno" porque a conta fixa já entra nos totais do mês — não conta duas vezes.
 */
export function usePayFixed() {
  const { data, insert } = useData();
  return useCallback(async (bill: FixedBill, month: string) => {
    const account = data.accounts.find((a) => !a.archived);
    const today = localISODate();
    const date = month === today.slice(0, 7) ? today : `${month}-${String(Math.min(bill.dueDay ?? 1, 28)).padStart(2, '0')}`;
    const tx = await insert('transactions', {
      type: bill.type, amount: bill.amount, category: bill.category, paymentMethod: 'Pix', date,
      description: `${bill.description} (${bill.type === 'income' ? 'recebido' : 'pago'} · ${monthLabel(month).toLowerCase()})`,
      accountId: account?.id ?? null, internal: 'fixed-payment',
    });
    if (!tx) return false;
    return !!(await insert('fixedPayments', { fixedId: bill.id, month, amount: bill.amount, transactionId: tx[0].id }));
  }, [data.accounts, insert]);
}


/**
 * Paga uma parcela de dívida: cria a saída na conta padrão e marca a parcela como paga.
 * É um gasto de verdade (não interno): entra nos totais do mês.
 */
export function usePayDebt() {
  const { data, insert, update, remove } = useData();
  const pay = useCallback(async (debt: Debt, inst: DebtInstallment, accountId?: string | null) => {
    const account = accountId ?? data.accounts.find((a) => !a.archived)?.id ?? null;
    const sorted = [...debt.installments].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const k = sorted.findIndex((i) => i.id === inst.id) + 1;
    const n = sorted.length;
    const today = localISODate();
    const tx = await insert('transactions', {
      type: 'expense', amount: inst.amount, category: debt.category, paymentMethod: 'Pix', date: today, accountId: account,
      description: n > 1 ? `${debt.creditor} (${k}/${n})` : debt.creditor,
    });
    if (!tx) return false;
    return update('debts', debt.id, { installments: debt.installments.map((i) => (i.id === inst.id ? { ...i, paidAt: today, transactionId: tx[0].id } : i)) });
  }, [data.accounts, insert, update]);
  /** Desfaz o pagamento: apaga o lançamento (o banco desmarca a parcela junto). */
  const unpay = useCallback(async (debt: Debt, inst: DebtInstallment) => {
    if (inst.transactionId && data.transactions.some((t) => t.id === inst.transactionId)) return remove('transactions', inst.transactionId);
    return update('debts', debt.id, { installments: debt.installments.map((i) => (i.id === inst.id ? { ...i, paidAt: null, transactionId: null } : i)) });
  }, [data.transactions, remove, update]);
  return { pay, unpay };
}
