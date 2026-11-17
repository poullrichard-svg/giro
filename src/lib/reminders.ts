/**
 * Lembretes de vencimento pelo sistema do celular/computador.
 * Sem servidor, só dá para avisar quando o app é aberto: aqui avisamos uma vez por dia
 * sobre o que vence hoje ou amanhã (ou já venceu). No iPhone, só funciona com o app instalado na tela inicial.
 */
import type { DueItem } from './planning';
import { formatBRL } from './format';

const KEY = 'giro.reminders';
const SENT = 'giro.reminders.sent';

export const remindersSupported = () => typeof window !== 'undefined' && 'Notification' in window;
export const remindersEnabled = () => { try { return remindersSupported() && Notification.permission === 'granted' && localStorage.getItem(KEY) !== 'off'; } catch { return false; } };

export async function enableReminders(): Promise<boolean> {
  if (!remindersSupported()) return false;
  const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  try { localStorage.setItem(KEY, perm === 'granted' ? 'on' : 'off'); } catch { /* sem storage */ }
  return perm === 'granted';
}
export function disableReminders() { try { localStorage.setItem(KEY, 'off'); } catch { /* sem storage */ } }

/** Envia (no máximo uma vez por item por dia) os avisos do que vence até amanhã. */
export async function sendDueReminders(items: DueItem[], today: string) {
  if (!remindersEnabled()) return 0;
  let sent: Record<string, string> = {};
  try { sent = JSON.parse(localStorage.getItem(SENT) || '{}'); } catch { /* ok */ }
  const due = items.filter((i) => i.daysLeft <= 1 && sent[i.id] !== today);
  if (!due.length) return 0;
  const title = due.length === 1 ? due[0].title : `${due.length} contas vencendo`;
  const body = due.slice(0, 4).map((i) => `${i.title}: ${formatBRL(i.amount)} · ${i.daysLeft < 0 ? 'atrasada' : i.daysLeft === 0 ? 'vence hoje' : 'vence amanhã'}`).join('\n');
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, icon: '/icon.svg', tag: `giro-due-${today}` });
    else new Notification(title, { body, icon: '/icon.svg' });
  } catch { return 0; }
  for (const i of due) sent[i.id] = today;
  try { localStorage.setItem(SENT, JSON.stringify(sent)); } catch { /* ok */ }
  return due.length;
}
