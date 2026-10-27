import type { AnoMes } from "./tipos";

export const NOMES_MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

export const ABREVIACOES_MESES = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const;

/** Minúsculas, sem acentos, espaços simples. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function anoMesDoIndice(inicio: AnoMes, indice: number): AnoMes {
  const total = inicio.ano * 12 + (inicio.mes - 1) + indice;
  return { ano: Math.floor(total / 12), mes: (total % 12) + 1 };
}

export function indiceDoAnoMes(inicio: AnoMes, alvo: AnoMes): number {
  return alvo.ano * 12 + (alvo.mes - 1) - (inicio.ano * 12 + (inicio.mes - 1));
}

/** "mai/26" */
export function rotuloMes(am: AnoMes): string {
  return `${ABREVIACOES_MESES[am.mes - 1]}/${String(am.ano).slice(-2)}`;
}

/** "maio de 2026" */
export function rotuloMesLongo(am: AnoMes): string {
  return `${NOMES_MESES[am.mes - 1]} de ${am.ano}`;
}

/** Reconhece "maio", "Março", "mar", "set." e devolve 1 a 12. */
export function mesPorNome(nome: string): number | undefined {
  const chave = normalizar(nome).replace(/\.$/, "");
  if (chave.length < 3) return undefined;
  const indice = NOMES_MESES.findIndex((m) => {
    const completo = normalizar(m);
    return completo === chave || completo.startsWith(chave);
  });
  return indice >= 0 ? indice + 1 : undefined;
}
