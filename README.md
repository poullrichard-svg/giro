# Giro

Finanças pessoais, painel do motorista de app e controle de veículos — num app que funciona no celular e no computador, **sem servidor e sem login**.

## Como funciona hoje

- **Os dados ficam no aparelho** (IndexedDB do navegador). Funciona offline e não depende de nenhum serviço externo.
- **Backup:** Ajustes → *Fazer backup* gera um arquivo `.json`. Para passar os dados para outro aparelho, use *Restaurar backup* lá.
- **Importar histórico:** Ajustes → *Importar lançamentos (CSV)* aceita o CSV do próprio Giro ou a tabela `transactions` exportada de um Supabase.
- **Instalar como app:** pelo navegador do celular, “Adicionar à tela inicial”.

## O que tem

| Área | Recursos |
|---|---|
| Início | Saldo do mês, gráficos, alertas (contas a vencer, IPVA, licenciamento, seguro, troca de óleo), **lançamento rápido** em linguagem natural (“gastei 35 almoço no pix”) |
| Lançamentos | Entradas e saídas por mês, busca, filtros, edição, exporta para Excel |
| Contas fixas | Recorrentes com dia de vencimento e marcação de pago por mês |
| Motorista | Fechamento do dia por app, corridas, km, horas, combustível; visão dia/semana/mês; R$/hora, R$/km; lucro real descontando os custos fixos do carro; meta diária |
| Veículos | Placa, RENAVAM, IPVA, licenciamento, seguro, parcela/aluguel, hodômetro, troca de óleo, gastos e consumo real (km/l) |
| Calculadoras | Financiamento (veículo/imóvel, Price × SAC), consórcio (com lance, comparado ao financiamento), renda fixa com IR, juros compostos/metas, reserva de emergência, renda passiva, custo por km |
| Metas e lista de compras | Aportes com prazo; lista que lança o total no financeiro |

## Desenvolvimento

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # testes dos cálculos, importação e backup
npm run build   # gera dist/ (site estático)
```

Publicar: qualquer hospedagem estática (Vercel, Netlify, Cloudflare Pages) com build `npm run build` e pasta `dist`.

## Estrutura

```
src/
  lib/          cálculos puros e testados (finance, stats, quickParse, csvImport, format)
  data/         banco local (db.ts), provider, backup, avisos
  components/   UI reutilizável, gráficos, navegação, formulário de lançamento
  pages/        uma tela por arquivo; calculators/ tem uma calculadora por arquivo
```

Para trocar a cor do app inteiro, edite `--color-brand-*` em `src/index.css`.

## Próximos passos

1. **Sincronização entre aparelhos** — conta própria na nuvem (ex.: Supabase novo + Vercel). Todo registro já tem `id`, `createdAt` e `updatedAt` para facilitar a sincronização; o app continuará funcionando offline.
2. **Lançar pelo WhatsApp** — webhook recebe a mensagem, `src/lib/quickParse.ts` interpreta e grava o lançamento (depende do passo 1).
3. Cartão de crédito com faturas e parcelamentos; orçamento por categoria.
