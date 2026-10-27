import { anoMesDoIndice, indiceDoAnoMes } from "./meses";
import { definicaoBloco } from "./tipos";
import type { AnoMes, Cartao, Fechamento, Lancamento, Plano } from "./tipos";

export interface Data {
  ano: number;
  mes: number;
  dia: number;
}

/** "2026-10-27" → { ano: 2026, mes: 10, dia: 27 } */
export function lerData(texto: string): Data | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!m) return null;
  const data = { ano: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]) };
  return data.mes >= 1 && data.mes <= 12 && data.dia >= 1 && data.dia <= 31 ? data : null;
}

export function formatarData(data: Data): string {
  return `${data.ano}-${String(data.mes).padStart(2, "0")}-${String(data.dia).padStart(2, "0")}`;
}

const somarMes = (am: AnoMes, n: number): AnoMes => anoMesDoIndice(am, n);

/**
 * Mês em que a fatura com a compra vence.
 * Compra no dia do fechamento ou depois entra na fatura seguinte; se o vencimento é
 * um dia menor ou igual ao fechamento, a fatura vence no mês seguinte ao fechamento.
 */
export function mesDaFatura(cartao: Cartao, compra: Data): AnoMes {
  const fechamento = somarMes({ ano: compra.ano, mes: compra.mes }, compra.dia >= cartao.diaFechamento ? 1 : 0);
  return cartao.diaVencimento > cartao.diaFechamento ? fechamento : somarMes(fechamento, 1);
}

/**
 * Índice do mês de competência de um lançamento (pode cair fora do horizonte).
 * Cartão → mês do vencimento da fatura. Renda a partir do dia de corte → mês seguinte.
 */
export function mesCompetencia(plano: Plano, lancamento: Lancamento): number | null {
  const data = lerData(lancamento.data);
  if (!data) return null;
  let alvo: AnoMes = { ano: data.ano, mes: data.mes };

  const cartao = lancamento.cartaoId ? plano.cartoes?.find((c) => c.id === lancamento.cartaoId) : undefined;
  if (cartao) {
    alvo = mesDaFatura(cartao, data);
  } else {
    const objeto = plano.objetos.find((o) => o.id === lancamento.objetoId);
    const receita = objeto ? definicaoBloco(objeto.bloco).natureza === "receita" : false;
    if (receita && plano.diaCorteRenda && data.dia >= plano.diaCorteRenda) alvo = somarMes(alvo, 1);
  }
  return indiceDoAnoMes(plano.inicio, alvo);
}

/** Realizado por objeto e mês: valor informado direto + soma dos lançamentos na competência. */
export function realizadoPorObjeto(plano: Plano): Record<string, Record<number, number>> {
  const mapa: Record<string, Record<number, number>> = {};
  for (const objeto of plano.objetos) mapa[objeto.id] = { ...objeto.realizado };
  for (const lancamento of plano.lancamentos ?? []) {
    const porMes = mapa[lancamento.objetoId];
    if (!porMes) continue; // objeto excluído
    const m = mesCompetencia(plano, lancamento);
    if (m === null || m < 0 || m >= plano.horizonte) continue;
    porMes[m] = (porMes[m] ?? 0) + lancamento.valor;
  }
  return mapa;
}

export function lancamentosDoMes(plano: Plano, mes: number): Lancamento[] {
  return (plano.lancamentos ?? [])
    .filter((l) => mesCompetencia(plano, l) === mes)
    .sort((a, b) => b.data.localeCompare(a.data));
}

export function adicionarLancamento(plano: Plano, lancamento: Lancamento): Plano {
  return { ...plano, lancamentos: [...(plano.lancamentos ?? []), lancamento] };
}

export function removerLancamento(plano: Plano, id: string): Plano {
  return { ...plano, lancamentos: (plano.lancamentos ?? []).filter((l) => l.id !== id) };
}

export function fecharMes(plano: Plano, mes: number, fechamento: Fechamento): Plano {
  return { ...plano, fechamentos: { ...plano.fechamentos, [mes]: fechamento } };
}

export function reabrirMes(plano: Plano, mes: number): Plano {
  const fechamentos = { ...plano.fechamentos };
  delete fechamentos[mes];
  return { ...plano, fechamentos };
}

/** Meses anteriores ao mês atual que ainda não foram fechados. */
export function mesesSemFechamento(plano: Plano, mesAtual: number): number[] {
  const pendentes: number[] = [];
  for (let m = 0; m < Math.min(mesAtual, plano.horizonte); m++) if (!plano.fechamentos?.[m]) pendentes.push(m);
  return pendentes;
}
