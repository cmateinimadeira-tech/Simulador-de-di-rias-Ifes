// Acompanhamento do mês: o previsto original fica congelado no histórico, e o valor
// vigente de cada objeto (pago + a pagar) mantém o retrato da situação em tempo real.
import { planejadoDoObjeto } from "./regras";
import { definicaoBloco } from "./tipos";
import type { Plano, Revisao, SituacaoMes } from "./tipos";
import type { ResultadoPlano } from "./calculo";

export interface ValorDoMes {
  /** O que o objeto pesa no mês: pago + a pagar. */
  vigente: number;
  aPagar: number;
}

/**
 * Valor vigente de um objeto num mês.
 * - Mês fechado: o pago (ou o previsto, se nada foi lançado), sem nada a pagar.
 * - Mês aberto sem pagamento nem situação: o previsto inteiro ainda está a pagar.
 * - Quitado: só o que foi pago. Restante informado: pago + restante.
 * - Padrão: falta a diferença entre o previsto e o pago (nunca negativa; se pagou
 *   mais que o previsto, vale o pago).
 */
export function valorVigente(previsto: number, pago: number | null, situacao: SituacaoMes | undefined, fechado: boolean): ValorDoMes {
  if (fechado) return { vigente: pago ?? previsto, aPagar: 0 };
  if (pago === null && !situacao) return { vigente: previsto, aPagar: previsto };
  const jaPago = pago ?? 0;
  let aPagar: number;
  if (situacao?.situacao === "quitado") aPagar = 0;
  else if (situacao?.situacao === "restante") aPagar = Math.max(0, situacao.valor);
  else aPagar = Math.max(0, previsto - jaPago);
  return { vigente: jaPago + aPagar, aPagar };
}

/** Congela o previsto atual do mês como original (ou redefine o original, se já existir). */
export function congelarMes(plano: Plano, mes: number, data: string): Plano {
  const valores: Record<string, number> = {};
  for (const objeto of plano.objetos) {
    const v = planejadoDoObjeto(objeto, plano)[mes] ?? 0;
    if (v !== 0) valores[objeto.id] = v;
  }
  return { ...plano, linhaDeBase: { ...plano.linhaDeBase, [mes]: { congeladoEm: data, valores } } };
}

/**
 * Garante o previsto original de todos os meses até `ateMes` (o mês atual).
 * Devolve o mesmo objeto quando não há nada a congelar, para não regravar à toa.
 */
export function garantirLinhaDeBase(plano: Plano, ateMes: number, data: string): Plano {
  let atual = plano;
  for (let m = 0; m <= Math.min(ateMes, plano.horizonte - 1); m++) {
    if (!atual.linhaDeBase?.[m]) atual = congelarMes(atual, m, data);
  }
  return atual;
}

/** Define (ou limpa, com null) a situação de um objeto num mês. */
export function definirSituacao(plano: Plano, objetoId: string, mes: number, situacao: SituacaoMes | null): Plano {
  return {
    ...plano,
    objetos: plano.objetos.map((o) => {
      if (o.id !== objetoId) return o;
      const acompanhamento = { ...o.acompanhamento };
      if (situacao) acompanhamento[mes] = situacao;
      else delete acompanhamento[mes];
      return { ...o, acompanhamento };
    }),
  };
}

export interface ResumoDoMes {
  despesasPrevistas: number;
  despesasPagas: number;
  despesasAPagar: number;
  entradasPrevistas: number;
  entradasRecebidas: number;
  entradasAReceber: number;
  /** Entradas previstas − despesas previstas. */
  saldoPrevisto: number;
  /** Saldo com o acompanhamento (pago + a pagar). */
  saldoVigente: number;
  /** Saldo do previsto original congelado, se houver. */
  saldoOriginal: number | null;
}

export function resumoDoMes(plano: Plano, resultado: ResultadoPlano, mes: number): ResumoDoMes {
  const r: ResumoDoMes = {
    despesasPrevistas: 0,
    despesasPagas: 0,
    despesasAPagar: 0,
    entradasPrevistas: 0,
    entradasRecebidas: 0,
    entradasAReceber: 0,
    saldoPrevisto: resultado.saldoPrevisto[mes] ?? 0,
    saldoVigente: resultado.saldo[mes] ?? 0,
    saldoOriginal: resultado.saldoOriginal[mes] ?? null,
  };
  for (const objeto of plano.objetos) {
    const previsto = resultado.planejado[objeto.id]?.[mes] ?? 0;
    const pago = resultado.realizado[objeto.id]?.[mes] ?? 0;
    const aPagar = resultado.aPagar[objeto.id]?.[mes] ?? 0;
    if (definicaoBloco(objeto.bloco).natureza === "receita") {
      r.entradasPrevistas += previsto;
      r.entradasRecebidas += pago;
      r.entradasAReceber += aPagar;
    } else {
      r.despesasPrevistas += previsto;
      r.despesasPagas += pago;
      r.despesasAPagar += aPagar;
    }
  }
  return r;
}

/** Registra o retrato do mês (revisão semanal) no histórico do plano. */
export function registrarRevisao(plano: Plano, resultado: ResultadoPlano, mes: number, data: string, id: string, nota?: string): Plano {
  const resumo = resumoDoMes(plano, resultado, mes);
  const revisao: Revisao = {
    id,
    data,
    mes,
    saldoVigente: resumo.saldoVigente,
    saldoOriginal: resumo.saldoOriginal,
    despesasPagas: resumo.despesasPagas,
    despesasAPagar: resumo.despesasAPagar,
    entradasRecebidas: resumo.entradasRecebidas,
    entradasAReceber: resumo.entradasAReceber,
    acumuladoMes: resultado.acumulado[mes] ?? 0,
    patrimonioFinal: resultado.resumo.patrimonioFinal,
    ...(nota?.trim() && { nota: nota.trim() }),
  };
  return { ...plano, revisoes: [...(plano.revisoes ?? []), revisao] };
}

export function revisoesDoMes(plano: Plano, mes: number): Revisao[] {
  return (plano.revisoes ?? []).filter((r) => r.mes === mes).sort((a, b) => a.data.localeCompare(b.data));
}

/** Dias desde a última revisão de qualquer mês (null se nunca houve). */
export function diasDesdeUltimaRevisao(plano: Plano, hoje: string): number | null {
  const ultima = (plano.revisoes ?? []).map((r) => r.data).sort().at(-1);
  if (!ultima) return null;
  return Math.round((Date.parse(hoje) - Date.parse(ultima)) / 86_400_000);
}
