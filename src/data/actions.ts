/** Ações que mexem em mais de uma coleção ao mesmo tempo. */
import { useCallback } from 'react';
import type { FixedBill } from '../types';
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

