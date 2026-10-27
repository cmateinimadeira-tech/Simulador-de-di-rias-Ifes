# Método Horizonte — MVP

Sistema web do Método Horizonte: planejamento financeiro pessoal e familiar com horizonte de até 48 meses, controle planejado × realizado e simulação de decisões. Este diretório contém o release **R1** da especificação (motor de cálculo, grade e importação da planilha) e o início do painel.

## O que já funciona

- **Motor de cálculo** (`src/motor`): módulo TypeScript puro, sem dependência de tela ou banco.
  - 7 blocos da metodologia e regras de lançamento: fixo (com reajuste anual), decrescente, parcelado, anual, único, manual e dívida (Price/SAC, com amortização extra).
  - Fechamento mensal: saldo, saldo conservador (sem entradas possíveis), acumulado, Fundo (com aporte, resgate e rendimento opcional), saldo devedor e patrimônio.
  - Planejado × realizado: mês fechado usa o realizado e o saldo real em conta.
  - Alertas: caixa negativo, mês negativo, desvio de objeto, vencimento anual e fim de dívida.
  - Cenários: alterações aplicadas sobre a base, sem alterar o plano, e comparação lado a lado.
- **Importador da planilha .xlsx** (`src/importador`): reconhece os blocos pelos nomes, respeita as fórmulas de subtotal, detecta a regra de cada linha e confere o resultado contra as linhas Saldo, Acumulado e Fundo. Ajustes digitados nas fórmulas viram uma linha visível de "Ajuste da planilha", e linhas fora da soma geram aviso.
- **Interface** (Next.js, PWA instalável):
  - Painel com indicadores do mês, curva de patrimônio, alertas e totais por bloco.
  - Grade objetos × meses com edição de células (ajustes manuais), editor de regras e inclusão/exclusão de objetos.
  - Assistente de criação de plano, importação com relatório de conferência e um plano de exemplo fictício.

Nesta etapa o plano fica salvo **apenas no navegador** (localStorage), e a planilha importada é lida no próprio navegador, sem envio a servidor. Login, banco de dados e área do consultor entram nos próximos releases.

## Como rodar

Requer Node.js 20 ou mais recente.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # testes do motor e do importador
npm run typecheck
npm run build
```

### Teste com a planilha real

A planilha de referência tem dados pessoais e não fica no repositório (o `.gitignore` bloqueia `*.xlsx`). Para rodar o caso de teste obrigatório da especificação:

```bash
PLANILHA_REFERENCIA=/caminho/para/planilha.xlsx PLANILHA_ANO_INICIAL=2025 npm test
```

O teste confere se o importador reproduz Saldo, Acumulado e Fundo de todos os meses, comparando com a própria planilha (nenhum valor dela fica no código).

## Estrutura

```
src/motor/        cálculo do método (tipos, regras, dívidas, fechamento, cenários)
src/importador/   leitura da planilha .xlsx e conferência
src/estado/       estado do plano no navegador e plano de exemplo
src/componentes/  gráfico, editor de objetos, navegação e formatação
src/app/          páginas: painel, grade, novo plano, importar
tests/            testes do motor, do importador e da planilha de referência
```

## Próximos passos (releases da especificação)

- **R2 — Uso mensal:** lançamento do realizado com data e cartão, fechamento do mês, visão de celular com um mês por vez, uso offline, conta de usuário e banco de dados com isolamento por plano.
- **R3 — Cenários e dívidas:** telas de criação e comparação de cenários e simulação de quitação (o motor já calcula).
- **R4 — Consultor e família:** lista de clientes, comentários, rateio familiar, projetos, histórico e exportação.
