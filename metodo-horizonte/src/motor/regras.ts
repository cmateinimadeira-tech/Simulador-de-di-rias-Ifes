import { anoMesDoIndice } from "./meses";
import { cronogramaDivida } from "./dividas";
import type { AnoMes, Objeto, Plano, Reajuste, Regra } from "./tipos";

interface Horizonte {
  inicio: AnoMes;
  horizonte: number;
}

/** Fator acumulado do reajuste anual entre o mês de início da regra e o mês m. */
function fatorReajuste(reajuste: Reajuste | undefined, plano: Horizonte, inicioRegra: number, m: number): number {
  if (!reajuste || reajuste.percentualAnual === 0) return 1;
  let aplicacoes = 0;
  for (let k = inicioRegra + 1; k <= m; k++) {
    if (anoMesDoIndice(plano.inicio, k).mes === reajuste.mesDoAno) aplicacoes++;
  }
  return Math.pow(1 + reajuste.percentualAnual, aplicacoes);
}

function intervalo(horizonte: number, inicio: number | undefined, fim: number | undefined): [number, number] {
  return [Math.max(0, inicio ?? 0), Math.min(horizonte - 1, fim ?? horizonte - 1)];
}

/** Valores planejados que a regra gera em cada mês do horizonte. */
export function gerarValores(regra: Regra, plano: Horizonte): number[] {
  const n = plano.horizonte;
  const valores = new Array<number>(n).fill(0);

  switch (regra.tipo) {
    case "fixo": {
      const [de, ate] = intervalo(n, regra.inicio, regra.fim);
      for (let m = de; m <= ate; m++) valores[m] = regra.valor * fatorReajuste(regra.reajuste, plano, de, m);
      break;
    }
    case "decrescente": {
      const [de, ate] = intervalo(n, regra.inicio, regra.fim);
      for (let m = de; m <= ate; m++) {
        valores[m] = Math.max(0, regra.valorInicial - regra.reducaoMensal * (m - regra.inicio));
      }
      break;
    }
    case "parcelado": {
      for (let k = 0; k < regra.parcelas; k++) {
        const m = regra.inicio + k;
        if (m >= 0 && m < n) valores[m] = regra.parcela;
      }
      break;
    }
    case "anual": {
      const [de, ate] = intervalo(n, regra.inicio, regra.fim);
      for (let m = de; m <= ate; m++) {
        if (regra.mesesDoAno.includes(anoMesDoIndice(plano.inicio, m).mes)) {
          valores[m] = regra.valor * fatorReajuste(regra.reajuste, plano, de, m);
        }
      }
      break;
    }
    case "unico": {
      if (regra.mes >= 0 && regra.mes < n) valores[regra.mes] = regra.valor;
      break;
    }
    case "manual": {
      for (const [chave, valor] of Object.entries(regra.valores)) {
        const m = Number(chave);
        if (m >= 0 && m < n) valores[m] = valor;
      }
      break;
    }
    case "divida": {
      return cronogramaDivida(regra, n).parcelas;
    }
  }
  return valores;
}

/** Previsto atual do objeto: valores da regra, com os ajustes manuais por cima. */
export function planejadoDoObjeto(objeto: Objeto, plano: Plano): number[] {
  const valores = gerarValores(objeto.regra, plano);
  for (const [chave, valor] of Object.entries(objeto.ajustes ?? {})) {
    const m = Number(chave);
    if (m >= 0 && m < plano.horizonte) valores[m] = valor;
  }
  return valores;
}

export const NOMES_REGRAS: Record<Regra["tipo"], string> = {
  fixo: "Fixo",
  decrescente: "Decrescente",
  parcelado: "Parcelado",
  anual: "Anual",
  unico: "Único",
  manual: "Manual",
  divida: "Dívida (Price/SAC)",
};
