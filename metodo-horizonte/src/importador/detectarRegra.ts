import { anoMesDoIndice } from "@/motor/meses";
import type { AnoMes, Regra } from "@/motor/tipos";

const TOLERANCIA = 0.005;
const iguais = (a: number, b: number) => Math.abs(a - b) < TOLERANCIA;

/**
 * Descobre a regra de lançamento que reproduz uma linha da planilha.
 * Ordem: único → fixo → decrescente → anual → manual (valores como estão).
 */
export function detectarRegra(valores: number[], inicio: AnoMes): Regra {
  const n = valores.length;
  const preenchidos = valores.flatMap((v, m) => (Math.abs(v) > TOLERANCIA ? [m] : []));
  if (preenchidos.length === 0) return { tipo: "manual", valores: {} };

  const primeiro = preenchidos[0]!;
  const ultimo = preenchidos.at(-1)!;
  const continuo = preenchidos.length === ultimo - primeiro + 1;
  const fim = ultimo === n - 1 ? undefined : ultimo;
  const v0 = valores[primeiro]!;

  if (preenchidos.length === 1) return { tipo: "unico", valor: v0, mes: primeiro };

  if (continuo && preenchidos.every((m) => iguais(valores[m]!, v0))) {
    return { tipo: "fixo", valor: v0, inicio: primeiro, ...(fim !== undefined && { fim }) };
  }

  if (continuo && preenchidos.length >= 3) {
    const reducao = v0 - valores[primeiro + 1]!;
    const constante = preenchidos.every((m) => iguais(valores[m]!, v0 - reducao * (m - primeiro)));
    if (reducao > 0 && constante) {
      return { tipo: "decrescente", valorInicial: v0, reducaoMensal: reducao, inicio: primeiro, ...(fim !== undefined && { fim }) };
    }
  }

  if (!continuo && preenchidos.length >= 2 && preenchidos.every((m) => iguais(valores[m]!, v0))) {
    const mesesDoAno = [...new Set(preenchidos.map((m) => anoMesDoIndice(inicio, m).mes))].sort((a, b) => a - b);
    let reproduz = true;
    for (let m = primeiro; m <= ultimo; m++) {
      const esperado = mesesDoAno.includes(anoMesDoIndice(inicio, m).mes) ? v0 : 0;
      if (!iguais(valores[m]!, esperado)) reproduz = false;
    }
    if (reproduz) {
      return { tipo: "anual", valor: v0, mesesDoAno, inicio: primeiro, ...(fim !== undefined && { fim }) };
    }
  }

  return {
    tipo: "manual",
    valores: Object.fromEntries(preenchidos.map((m) => [m, valores[m]!])),
  };
}
