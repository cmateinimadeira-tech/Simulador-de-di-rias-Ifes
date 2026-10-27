import { calcularPlano } from "@/motor/calculo";
import { mesPorNome, normalizar, rotuloMes, anoMesDoIndice } from "@/motor/meses";
import { BLOCOS } from "@/motor/tipos";
import type { AnoMes, Bloco, FuncaoObjeto, Objeto, Plano } from "@/motor/tipos";
import { detectarRegra } from "./detectarRegra";

/** Leitura neutra de uma célula, independente da biblioteca de planilhas. */
export interface CelulaLida {
  numero: number | null;
  texto: string | null;
  formula: string | null;
  erro: string | null;
}

/** Acesso 1-based às células de uma aba. */
export interface GradeLida {
  nome: string;
  linhas: number;
  colunas: number;
  celula(linha: number, coluna: number): CelulaLida;
}

export interface OpcoesImportacao {
  /** Ano do primeiro mês da planilha (a linha 1 só traz o nome dos meses). */
  anoInicial: number;
  /** Se verdadeiro, a linha "Reserva" das entradas vira resgate do Fundo. */
  reservaSaiDoFundo: boolean;
  nomePlano?: string;
}

export type LinhaConferida = "saldo" | "acumulado" | "fundo";

export interface Divergencia {
  linha: LinhaConferida;
  mes: number;
  rotulo: string;
  planilha: number;
  sistema: number;
}

export interface RelatorioImportacao {
  aba: string;
  inicio: AnoMes;
  horizonte: number;
  objetosPorBloco: Record<Bloco, number>;
  /** Linhas de controle encontradas na planilha e usadas na conferência. */
  conferidas: LinhaConferida[];
  divergencias: Divergencia[];
  avisos: string[];
  finalPlanilha: Partial<Record<LinhaConferida, number>>;
  finalSistema: Record<LinhaConferida, number>;
}

export interface ResultadoImportacao {
  plano: Plano;
  relatorio: RelatorioImportacao;
}

const TOLERANCIA_CONFERENCIA = 1;

function blocoDoCabecalho(chave: string): Bloco | undefined {
  if (chave.startsWith("fixo")) return "fixo";
  if (chave.startsWith("despesas anuais") || chave === "anuais") return "anual";
  if (chave.startsWith("variavel")) return "variavel";
  if (chave.startsWith("cartao parcelado")) return "cartaoParcelado";
  if (chave.startsWith("cartao a vista") || chave.startsWith("cartao avista")) return "cartaoAVista";
  if (chave === "planejamento") return "planejamento";
  if (chave === "entradas") return "entradas";
  return undefined;
}

/** Linhas citadas por uma fórmula: SUM(H3:H9) → 3..9; H38+H39 → 38, 39. */
export function linhasDaFormula(formula: string): Set<number> {
  const linhas = new Set<number>();
  const semAbasExternas = formula.replace(/'[^']*'![$A-Z0-9:#!]+/gi, "").replace(/\b[A-Za-z_]+![$A-Z0-9:]+/g, "");
  const intervalo = /\$?[A-Z]{1,3}\$?(\d+)\s*:\s*\$?[A-Z]{1,3}\$?(\d+)/gi;
  let resto = semAbasExternas;
  for (const m of semAbasExternas.matchAll(intervalo)) {
    const de = Number(m[1]);
    const ate = Number(m[2]);
    for (let l = Math.min(de, ate); l <= Math.max(de, ate); l++) linhas.add(l);
    resto = resto.replace(m[0], " ");
  }
  for (const m of resto.matchAll(/\$?[A-Z]{1,3}\$?(\d+)/gi)) linhas.add(Number(m[1]));
  return linhas;
}

type PapelLinha =
  | { tipo: "cabecalho"; bloco: Bloco }
  | { tipo: "objeto"; bloco: Bloco }
  | { tipo: "totalDespesas" }
  | { tipo: "conferencia"; linha: LinhaConferida };

interface LinhaClassificada {
  linha: number;
  nome: string;
  chave: string;
  papel: PapelLinha;
}

export function importarDeGrade(grade: GradeLida, opcoes: OpcoesImportacao): ResultadoImportacao {
  const avisos: string[] = [];

  // 1. Meses: linha 1, da coluna B até a primeira célula que não é mês.
  const mesesDoAno: number[] = [];
  for (let c = 2; c <= grade.colunas; c++) {
    const texto = grade.celula(1, c).texto;
    const mes = texto ? mesPorNome(texto) : undefined;
    if (!mes) break;
    if (mesesDoAno.length > 0) {
      const esperado = (mesesDoAno.at(-1)! % 12) + 1;
      if (mes !== esperado) {
        avisos.push(`A coluna ${c} traz "${texto}", mas o mês esperado era outro. A importação parou nessa coluna.`);
        break;
      }
    }
    mesesDoAno.push(mes);
  }
  if (mesesDoAno.length === 0) {
    throw new Error("Não encontrei os meses na linha 1 (a partir da coluna B). Confira se é a planilha do método.");
  }
  const horizonte = mesesDoAno.length;
  const inicio: AnoMes = { ano: opcoes.anoInicial, mes: mesesDoAno[0]! };
  const colunaDoMes = (m: number) => m + 2;

  // 2. Classificação das linhas pelo nome da coluna A.
  const classificadas: LinhaClassificada[] = [];
  let blocoAtual: Bloco | null = null;
  let depoisDoSaldo = false;
  for (let l = 2; l <= grade.linhas; l++) {
    const nome = grade.celula(l, 1).texto?.trim();
    if (!nome) continue;
    const chave = normalizar(nome);
    let papel: PapelLinha | null = null;

    if (chave === "despesas" || chave === "total despesas") {
      papel = { tipo: "totalDespesas" };
      blocoAtual = null;
    } else if (chave === "saldo") {
      papel = { tipo: "conferencia", linha: "saldo" };
      depoisDoSaldo = true;
      blocoAtual = null;
    } else if (depoisDoSaldo && chave === "acumulado") {
      papel = { tipo: "conferencia", linha: "acumulado" };
    } else if (depoisDoSaldo && chave === "fundo") {
      papel = { tipo: "conferencia", linha: "fundo" };
    } else {
      const cabecalho = blocoDoCabecalho(chave);
      if (cabecalho && !depoisDoSaldo) {
        papel = { tipo: "cabecalho", bloco: cabecalho };
        blocoAtual = cabecalho;
      } else if (blocoAtual) {
        papel = { tipo: "objeto", bloco: blocoAtual };
      }
    }

    if (papel) classificadas.push({ linha: l, nome, chave, papel });
    else avisos.push(`Linha ${l} ("${nome}") está fora dos blocos do método e foi ignorada.`);
  }

  // 3. Quais linhas cada subtotal soma, coluna a coluna (fórmulas como SUM(H19:H21)).
  const membrosPorCabecalho = new Map<number, Map<number, Set<number>>>();
  for (const cab of classificadas.filter((c) => c.papel.tipo === "cabecalho" && c.papel.bloco !== "entradas")) {
    const porColuna = new Map<number, Set<number>>();
    for (let m = 0; m < horizonte; m++) {
      const formula = grade.celula(cab.linha, colunaDoMes(m)).formula;
      if (formula) porColuna.set(m, linhasDaFormula(formula));
    }
    membrosPorCabecalho.set(cab.linha, porColuna);
  }
  // As entradas que contam são as citadas na fórmula do Saldo.
  const linhaSaldo = classificadas.find((c) => c.papel.tipo === "conferencia" && c.papel.linha === "saldo");
  const membrosEntradas = new Map<number, Set<number>>();
  if (linhaSaldo) {
    for (let m = 0; m < horizonte; m++) {
      const formula = grade.celula(linhaSaldo.linha, colunaDoMes(m)).formula;
      if (formula) membrosEntradas.set(m, linhasDaFormula(formula));
    }
  }

  const numero = (l: number, m: number, nome: string): number => {
    const cel = grade.celula(l, colunaDoMes(m));
    if (cel.erro) {
      avisos.push(`"${nome}" em ${rotuloMes(anoMesDoIndice(inicio, m))} tem erro (${cel.erro}); usei 0.`);
      return 0;
    }
    return cel.numero ?? 0;
  };

  // 4. Objetos.
  const objetos: Objeto[] = [];
  const somaPorCabecalho = new Map<number, number[]>();
  let cabecalhoAtual: LinhaClassificada | null = null;
  for (const item of classificadas) {
    if (item.papel.tipo === "cabecalho") {
      cabecalhoAtual = item;
      somaPorCabecalho.set(item.linha, new Array<number>(horizonte).fill(0));
    }
    const ehRendaDoCabecalho = item.papel.tipo === "cabecalho" && item.papel.bloco === "entradas";
    if (item.papel.tipo !== "objeto" && !ehRendaDoCabecalho) continue;
    const bloco = (item.papel as { bloco: Bloco }).bloco;

    const valores: number[] = [];
    let foraDaSoma = 0;
    for (let m = 0; m < horizonte; m++) {
      const v = numero(item.linha, m, item.nome);
      const membros =
        bloco === "entradas" ? membrosEntradas.get(m) : cabecalhoAtual ? membrosPorCabecalho.get(cabecalhoAtual.linha)?.get(m) : undefined;
      const conta = !membros || membros.has(item.linha);
      if (!conta && v !== 0) foraDaSoma++;
      valores.push(conta ? v : 0);
    }
    if (cabecalhoAtual && !ehRendaDoCabecalho) {
      const soma = somaPorCabecalho.get(cabecalhoAtual.linha)!;
      valores.forEach((v, m) => (soma[m]! += v));
    }
    if (foraDaSoma > 0) {
      avisos.push(
        `"${item.nome}" (linha ${item.linha}) tem ${foraDaSoma} valor(es) fora da soma do bloco na planilha; esses valores não foram importados.`,
      );
    }

    let funcao: FuncaoObjeto | undefined;
    if (bloco === "planejamento" && (item.chave === "fundo" || item.chave.startsWith("aporte"))) funcao = "aporteFundo";
    if (bloco === "entradas" && item.chave.startsWith("reserva") && opcoes.reservaSaiDoFundo) funcao = "resgateFundo";
    if (bloco === "entradas" && item.chave.startsWith("entrada possivel")) funcao = "entradaPossivel";

    objetos.push({
      id: `imp-${item.linha}`,
      bloco,
      nome: ehRendaDoCabecalho ? "Renda principal" : item.nome,
      regra: detectarRegra(valores, inicio),
      ...(funcao && { funcao }),
    });
  }

  // Subtotais com ajuste digitado na fórmula (ex.: =SUM(B3:B9)-2265) viram uma linha
  // de ajuste visível, para o plano reproduzir a planilha sem esconder a diferença.
  for (const cab of classificadas) {
    if (cab.papel.tipo !== "cabecalho" || cab.papel.bloco === "entradas") continue;
    const soma = somaPorCabecalho.get(cab.linha)!;
    const diferencas: Record<number, number> = {};
    for (let m = 0; m < horizonte; m++) {
      const subtotal = grade.celula(cab.linha, colunaDoMes(m)).numero;
      if (subtotal === null) continue;
      const dif = subtotal - soma[m]!;
      if (Math.abs(dif) > 0.005) diferencas[m] = dif;
    }
    const meses = Object.keys(diferencas).map(Number);
    if (meses.length === 0) continue;
    const exemplo = meses[0]!;
    objetos.push({
      id: `imp-ajuste-${cab.linha}`,
      bloco: cab.papel.bloco,
      nome: `Ajuste da planilha (${cab.nome})`,
      regra: { tipo: "manual", valores: diferencas },
    });
    avisos.push(
      `O subtotal "${cab.nome}" difere da soma das linhas em ${meses.length} mês(es) ` +
        `(ex.: ${diferencas[exemplo]!.toLocaleString("pt-BR")} em ${rotuloMes(anoMesDoIndice(inicio, exemplo))}), ` +
        `provavelmente por um valor digitado na fórmula. Criei a linha "Ajuste da planilha (${cab.nome})" para reproduzir a planilha; revise-a.`,
    );
  }

  const plano: Plano = {
    id: `plano-${Date.now().toString(36)}`,
    nome: opcoes.nomePlano ?? `Plano importado de ${grade.nome}`,
    inicio,
    horizonte,
    saldoInicialConta: 0,
    saldoInicialFundo: 0,
    taxaFundoMensal: 0,
    objetos,
  };

  // 5. Conferência contra as linhas Saldo, Acumulado e Fundo da planilha.
  const resultado = calcularPlano(plano);
  const serieSistema: Record<LinhaConferida, number[]> = {
    saldo: resultado.saldo,
    acumulado: resultado.acumulado,
    fundo: resultado.fundo,
  };
  const conferidas: LinhaConferida[] = [];
  const divergencias: Divergencia[] = [];
  const finalPlanilha: Partial<Record<LinhaConferida, number>> = {};
  for (const item of classificadas) {
    if (item.papel.tipo !== "conferencia") continue;
    const linha = item.papel.linha;
    conferidas.push(linha);
    for (let m = 0; m < horizonte; m++) {
      const cel = grade.celula(item.linha, colunaDoMes(m));
      if (cel.numero === null) continue;
      const sistema = serieSistema[linha][m]!;
      if (m === horizonte - 1) finalPlanilha[linha] = cel.numero;
      if (Math.abs(sistema - cel.numero) > TOLERANCIA_CONFERENCIA) {
        divergencias.push({ linha, mes: m, rotulo: rotuloMes(anoMesDoIndice(inicio, m)), planilha: cel.numero, sistema });
      }
    }
  }

  const objetosPorBloco = Object.fromEntries(
    BLOCOS.map((b) => [b.id, objetos.filter((o) => o.bloco === b.id).length]),
  ) as Record<Bloco, number>;

  return {
    plano,
    relatorio: {
      aba: grade.nome,
      inicio,
      horizonte,
      objetosPorBloco,
      conferidas,
      divergencias,
      avisos,
      finalPlanilha,
      finalSistema: {
        saldo: resultado.saldo.at(-1) ?? 0,
        acumulado: resultado.resumo.acumuladoFinal,
        fundo: resultado.resumo.fundoFinal,
      },
    },
  };
}
