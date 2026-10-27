# Método Horizonte — MVP

Sistema web do Método Horizonte: planejamento financeiro pessoal e familiar com horizonte de até 48 meses, controle planejado × realizado e simulação de decisões. Este diretório contém os releases **R1** (motor de cálculo, grade e importação da planilha), **R2 — uso mensal** (lançamentos, cartões, acompanhamento semanal, fechamento do mês, uso offline; exceto login e banco de dados) e **R3 — cenários e dívidas**.

## O que já funciona

- **Motor de cálculo** (`src/motor`): módulo TypeScript puro, sem dependência de tela ou banco.
  - 7 blocos da metodologia e regras de lançamento: fixo (com reajuste anual), decrescente, parcelado, anual, único, manual e dívida (Price/SAC, com amortização extra).
  - Fechamento mensal: saldo, saldo conservador (sem entradas possíveis), acumulado, Fundo (com aporte, resgate e rendimento opcional), saldo devedor e patrimônio.
  - Planejado × realizado: lançamentos com data entram no mês de competência (fatura do cartão pelo dia de fechamento e vencimento; renda após o dia de corte vai para o mês seguinte). Mês fechado usa o realizado e o saldo real em conta.
  - Acompanhamento em tempo real: em cada mês aberto, o valor vigente de um objeto é o pago mais o que falta pagar. Por padrão falta a diferença entre previsto e pago; o objeto pode ser marcado como quitado (a sobra volta para o saldo) ou ter o restante ajustado.
  - Linha de base: o previsto de cada mês é congelado quando o mês começa (previsto original), e fica no histórico mesmo que o previsto seja alterado depois. O saldo é mostrado em três versões: original, previsto atual e retrato atual (vigente).
  - Revisões semanais: registro com data do retrato do mês (saldo, pago, a pagar, acumulado e patrimônio final), formando o histórico da evolução.
  - Alertas: caixa negativo, mês negativo, desvio de objeto (em tempo real, assim que o pago passa do previsto), vencimento anual e fim de dívida.
  - Cenários: simulações aplicadas sobre a base, sem alterar o plano, e comparação lado a lado. Simulações prontas (`src/motor/simulacoes.ts`): compra à vista, parcelada sem juros ou financiada (Price/SAC, com entrada e opção de usar o Fundo), mudança de valor de renda ou gasto, novo gasto ou receita, amortização extra e quitação antecipada de dívida (com juros economizados e novo prazo). Aplicar um cenário incorpora as simulações ao plano e registra no histórico.
- **Importador da planilha .xlsx** (`src/importador`): reconhece os blocos pelos nomes, respeita as fórmulas de subtotal, detecta a regra de cada linha e confere o resultado contra as linhas Saldo, Acumulado e Fundo. Ajustes digitados nas fórmulas viram uma linha visível de "Ajuste da planilha", e linhas fora da soma geram aviso.
- **Interface** (Next.js, PWA instalável):
  - Painel com indicadores do mês, curva de patrimônio, alertas e totais por bloco.
  - Grade objetos × meses com edição de células (ajustes manuais), editor de regras e inclusão/exclusão de objetos.
  - Assistente de criação de plano, importação com relatório de conferência e um plano de exemplo fictício.
  - Tela do mês (pensada para o celular): lançar gasto ou recebimento com data, cartão e descrição; pago, a pagar e situação de cada objeto (quitado, restante ajustado); saldo do mês comparado ao previsto e ao original; revisão semanal com histórico; fechar e reabrir o mês com o saldo real; troca de mês deslizando.
  - Cenários: painel das dívidas (saldo devedor, parcela, juros a pagar, quitação), nova simulação, comparação de até 3 cenários com o plano atual (curvas de patrimônio e tabela com patrimônio final, menor saldo em conta, meses no vermelho, juros e Fundo), aplicar e excluir cenários, histórico dos aplicados.
  - Conta: dados do plano, rendimento do Fundo, dia de corte, cartões, backup, restauração e exclusão dos dados.
  - Painel avisa os meses passados sem fechamento.
  - Uso sem internet: um service worker guarda as telas; lançamentos feitos offline ficam salvos no aparelho.

Nesta etapa o plano fica salvo **apenas no navegador** (localStorage), e a planilha importada é lida no próprio navegador, sem envio a servidor. O acesso aos dados passa pela interface `Armazenamento` (`src/estado/armazenamento.ts`): o banco na nuvem entra como outra implementação dela, sem mudar as telas. Até lá, use o backup em Conta.

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
src/app/          páginas: painel, mês, grade, cenários, novo plano, importar, conta
public/sw.js      service worker (uso offline)
tests/            testes do motor, do importador e da planilha de referência
```

## Próximos passos (releases da especificação)

- **R2 — pendente:** conta de usuário (login com e-mail/Google e 2FA) e banco de dados com isolamento por plano. Depende da escolha e criação da conta no provedor (sugestão da especificação: PostgreSQL gerenciado com autenticação, como o Supabase, em região de São Paulo).
- **R4 — Consultor e família:** lista de clientes, comentários, rateio familiar, projetos, histórico e exportação.
