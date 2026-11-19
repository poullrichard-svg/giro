/** Bancos e carteiras digitais mais usados no Brasil (nome + cor da marca, aproximada). */
export const BANKS: Array<{ name: string; color: string; short: string }> = [
  { name: 'Nubank', color: '#8a05be', short: 'Nu' },
  { name: 'Itaú', color: '#ec7000', short: 'Itaú' },
  { name: 'Bradesco', color: '#cc092f', short: 'Bra' },
  { name: 'Banco do Brasil', color: '#f8d117', short: 'BB' },
  { name: 'Caixa', color: '#005ca9', short: 'Cx' },
  { name: 'Santander', color: '#ec0000', short: 'San' },
  { name: 'Inter', color: '#ff7a00', short: 'Inter' },
  { name: 'C6 Bank', color: '#242424', short: 'C6' },
  { name: 'Mercado Pago', color: '#00b1ea', short: 'MP' },
  { name: 'PicPay', color: '#21c25e', short: 'Pic' },
  { name: 'PagBank', color: '#1bb99a', short: 'Pag' },
  { name: 'Next', color: '#00ff5f', short: 'Next' },
  { name: 'Neon', color: '#0ac5f9', short: 'Neon' },
  { name: 'BTG Pactual', color: '#0a2a52', short: 'BTG' },
  { name: 'XP', color: '#1a1a1a', short: 'XP' },
  { name: 'Sicredi', color: '#3fa110', short: 'Sic' },
  { name: 'Sicoob', color: '#003641', short: 'Sicoob' },
  { name: 'Banrisul', color: '#0058a1', short: 'Ban' },
];
export const bankByName = (name: string) => BANKS.find((b) => b.name.toLowerCase() === name.trim().toLowerCase());
