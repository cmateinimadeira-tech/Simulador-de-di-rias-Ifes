import type { RegraDivida } from "./tipos";

export interface CronogramaDivida {
  /** Valor pago em cada mês do horizonte (parcela + amortização extra). */
  parcelas: number[];
  juros: number[];
  amortizacao: number[];
  /** Saldo devedor após o pagamento do mês. */
  saldoDevedor: number[];
  /** Juros pagos dentro do horizonte. */
  jurosTotais: number;
  /** Índice do mês da última parcela, ou null se a dívida não termina no horizonte. */
  mesQuitacao: number | null;
}

const CENTAVO = 0.005;

/** Parcela fixa do sistema Price. */
export function parcelaPrice(valorPresente: number, taxaMensal: number, prazo: number): number {
  if (prazo <= 0) return 0;
  if (taxaMensal === 0) return valorPresente / prazo;
  return (valorPresente * taxaMensal) / (1 - Math.pow(1 + taxaMensal, -prazo));
}

/**
 * Gera o cronograma de uma dívida dentro do horizonte.
 * Amortizações extras reduzem o prazo, mantendo a parcela (Price) ou a amortização (SAC).
 */
export function cronogramaDivida(regra: RegraDivida, horizonte: number): CronogramaDivida {
  const parcelas = new Array<number>(horizonte).fill(0);
  const juros = new Array<number>(horizonte).fill(0);
  const amortizacao = new Array<number>(horizonte).fill(0);
  const saldoDevedor = new Array<number>(horizonte).fill(0);

  const { taxaMensal: i, prazo, sistema, inicio } = regra;
  const extras = regra.amortizacoesExtras ?? {};
  const parcelaFixa = parcelaPrice(regra.saldoDevedor, i, prazo);
  const amortizacaoFixa = prazo > 0 ? regra.saldoDevedor / prazo : regra.saldoDevedor;

  let saldo = regra.saldoDevedor;
  let jurosTotais = 0;
  let mesQuitacao: number | null = null;

  // Antes da primeira parcela o saldo devedor fica em 0: a dívida passa a contar
  // no patrimônio a partir do mês em que começa a ser paga.
  for (let m = Math.max(inicio, 0); m < horizonte && saldo > CENTAVO; m++) {
    const jurosMes = saldo * i;
    let amortizado: number;
    if (sistema === "price") {
      const parcela = Math.min(parcelaFixa, saldo + jurosMes);
      amortizado = parcela - jurosMes;
    } else {
      amortizado = Math.min(amortizacaoFixa, saldo);
    }
    const extra = Math.max(0, Math.min(extras[m] ?? 0, saldo - amortizado));
    amortizado += extra;

    saldo -= amortizado;
    if (saldo < CENTAVO) saldo = 0;

    juros[m] = jurosMes;
    amortizacao[m] = amortizado;
    parcelas[m] = amortizado + jurosMes;
    saldoDevedor[m] = saldo;
    jurosTotais += jurosMes;
    if (saldo === 0) mesQuitacao = m;
  }

  return { parcelas, juros, amortizacao, saldoDevedor, jurosTotais, mesQuitacao };
}
