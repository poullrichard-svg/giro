import { COLLECTIONS, type CollectionKey } from './db';
import { localISODate } from '../lib/format';

export const BACKUP_KEY = 'giro.lastBackupAt';

export function buildBackup(data: Record<CollectionKey, unknown[]>) {
  return { app: 'giro', version: 1, exportedAt: new Date().toISOString(), data };
}

export function downloadBackup(data: Record<CollectionKey, unknown[]>) {
  const blob = new Blob([JSON.stringify(buildBackup(data), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: `giro-backup-${localISODate()}.json` }).click();
  URL.revokeObjectURL(url);
  try { localStorage.setItem(BACKUP_KEY, new Date().toISOString()); } catch { /* sem storage */ }
}

/**
 * Lê um backup do Giro ou o "Backup completo (JSON)" exportado pela versão antiga.
 * Retorna as coleções reconhecidas, ou lança erro se o arquivo não for válido.
 */
export function parseBackup(text: string): Partial<Record<CollectionKey, any[]>> {
  let json: any;
  try { json = JSON.parse(text); } catch { throw new Error('Arquivo inválido: não é um JSON.'); }
  const src = json?.app === 'giro' ? json.data : json;
  if (!src || typeof src !== 'object') throw new Error('Arquivo sem dados reconhecíveis.');
  const out: Partial<Record<CollectionKey, any[]>> = {};
  for (const c of COLLECTIONS) {
    if (!Array.isArray(src[c])) continue;
    out[c] = src[c].filter((x: any) => x && typeof x === 'object' && typeof x.id === 'string');
  }
  if (!Object.keys(out).length) throw new Error('Nenhum dado do Giro encontrado no arquivo.');
  return out;
}
