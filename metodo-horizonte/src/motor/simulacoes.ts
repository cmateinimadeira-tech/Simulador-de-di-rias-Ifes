// Simulações prontas para os cenários: cada função traduz uma decisão em alterações do plano.
import { cronogramaDivida } from "./dividas";
import { anoMesDoIndice, rotuloMes } from "./meses";
import { planejadoDoObjeto } from "./regras";
import type { Alteracao, Bloco, Objeto, Plano, RegraDivida, Simulacao } from "./tipos";

export type GeradorId = (prefixo: string) => string;

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const mesTxt = (plano: Plano, m: number) => rotuloMes(anoMesDoIndice(plano.inicio, m));

function resgateDoFundo(plano: Plano, nome: string, valor: number, mes: number, novoId: GeradorId): Alteracao {
  return {
    tipo: "incluirObjeto",
    objeto: { id: novoId("sim"), bloco: "entradas", nome: `Resgate do Fundo: ${nome}`, funcao: "resgateFundo", regra: { tipo: "unico", valor, mes } },
  };
}

export interface ParametrosCompra {
  nome: string;
  valor: number;
  /** Mês da compra (ou da entrada, no financiamento). */
  mes: number;
  forma: "vista" | "parcelado" | "financiado";
  /** Parcelado: nº de parcelas sem juros. Financiado: prazo. */
  parcelas?: number;
  taxaMensal?: number;
  sistema?: "price" | "sac";
  /** Financiado: valor de entrada pago no mês da compra. */
  entrada?: number;
  /** Paga à vista (ou a entrada) com dinheiro do Fundo. */
  usarFundo?: boolean;
}

/** Compra à vista, parcelada sem juros no cartão ou financiada (1ª parcela no mês seguinte). */
export function simularCompra(plano: Plano, p: ParametrosCompra, novoId: GeradorId): Simulacao {
  const alteracoes: Alteracao[] = [];
  const quando = mesTxt(plano, p.mes);
  let descricao: string;

  if (p.forma === "vista") {
    alteracoes.push({ tipo: "incluirObjeto", objeto: { id: novoId("sim"), bloco: "planejamento", nome: p.nome, regra: { tipo: "unico", valor: p.valor, mes: p.mes } } });
    if (p.usarFundo) alteracoes.push(resgateDoFundo(plano, p.nome, p.valor, p.mes, novoId));
    descricao = `${p.nome}: ${moeda(p.valor)} à vista em ${quando}${p.usarFundo ? ", com dinheiro do Fundo" : ""}`;
  } else if (p.forma === "parcelado") {
    const parcelas = Math.max(1, Math.round(p.parcelas ?? 1));
    const parcela = p.valor / parcelas;
    alteracoes.push({
      tipo: "incluirObjeto",
      objeto: { id: novoId("sim"), bloco: "cartaoParcelado", nome: `${p.nome} (${parcelas}x)`, regra: { tipo: "parcelado", parcela, parcelas, inicio: p.mes } },
    });
    descricao = `${p.nome}: ${parcelas}x de ${moeda(parcela)} sem juros a partir de ${quando}`;
  } else {
    const entrada = Math.min(Math.max(p.entrada ?? 0, 0), p.valor);
    const prazo = Math.max(1, Math.round(p.parcelas ?? 12));
    const taxa = p.taxaMensal ?? 0;
    const sistema = p.sistema ?? "price";
    if (entrada > 0) {
      alteracoes.push({
        tipo: "incluirObjeto",
        objeto: { id: novoId("sim"), bloco: "planejamento", nome: `${p.nome} (entrada)`, regra: { tipo: "unico", valor: entrada, mes: p.mes } },
      });
      if (p.usarFundo) alteracoes.push(resgateDoFundo(plano, `${p.nome} (entrada)`, entrada, p.mes, novoId));
    }
    alteracoes.push({
      tipo: "incluirObjeto",
      objeto: {
        id: novoId("sim"),
        bloco: "planejamento",
        nome: `${p.nome} (financiamento)`,
        regra: { tipo: "divida", saldoDevedor: p.valor - entrada, taxaMensal: taxa, prazo, sistema, inicio: p.mes + 1 },
      },
    });
    const taxaTxt = `${(taxa * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% a.m.`;
    descricao =
      `${p.nome}: ${moeda(p.valor)} financiado em ${prazo}x (${sistema.toUpperCase()}, ${taxaTxt})` +
      (entrada > 0 ? ` com entrada de ${moeda(entrada)}${p.usarFundo ? " do Fundo" : ""}` : "") +
      ` em ${quando}`;
  }
  return { id: novoId("simulacao"), descricao, alteracoes };
}

export interface ParametrosMudanca {
  objetoId: string;
  novoValor: number;
  aPartirDe: number;
  /** Último mês com o novo valor; sem ele, até o fim do horizonte. */
  ate?: number;
}

/** Muda o valor mensal de um objeto (renda ou gasto) a partir de um mês. */
export function simularMudancaDeValor(plano: Plano, p: ParametrosMudanca, novoId: GeradorId): Simulacao {
  const objeto = plano.objetos.find((o) => o.id === p.objetoId);
  const fim = Math.min(p.ate ?? plano.horizonte - 1, plano.horizonte - 1);
  const alteracoes: Alteracao[] = [];
  for (let m = Math.max(0, p.aPartirDe); m <= fim; m++) alteracoes.push({ tipo: "ajustarValor", objetoId: p.objetoId, mes: m, valor: p.novoValor });
  const periodo = p.ate !== undefined ? `de ${mesTxt(plano, p.aPartirDe)} a ${mesTxt(plano, fim)}` : `a partir de ${mesTxt(plano, p.aPartirDe)}`;
  return { id: novoId("simulacao"), descricao: `${objeto?.nome ?? "Objeto"} passa a ${moeda(p.novoValor)} por mês ${periodo}`, alteracoes };
}

export interface ParametrosNovoItem {
  nome: string;
  bloco: Bloco;
  valor: number;
  aPartirDe: number;
  ate?: number;
}

/** Inclui um gasto ou uma receita mensal nova. */
export function simularNovoItem(plano: Plano, p: ParametrosNovoItem, novoId: GeradorId): Simulacao {
  const objeto: Objeto = {
    id: novoId("sim"),
    bloco: p.bloco,
    nome: p.nome,
    regra: { tipo: "fixo", valor: p.valor, inicio: p.aPartirDe, ...(p.ate !== undefined && { fim: p.ate }) },
  };
  const periodo = p.ate !== undefined ? `de ${mesTxt(plano, p.aPartirDe)} a ${mesTxt(plano, p.ate)}` : `a partir de ${mesTxt(plano, p.aPartirDe)}`;
  const tipo = p.bloco === "entradas" ? "Nova receita" : "Novo gasto";
  return { id: novoId("simulacao"), descricao: `${tipo}: ${p.nome}, ${moeda(p.valor)} por mês ${periodo}`, alteracoes: [{ tipo: "incluirObjeto", objeto }] };
}

function regraDivida(plano: Plano, objetoId: string): RegraDivida | null {
  const regra = plano.objetos.find((o) => o.id === objetoId)?.regra;
  return regra?.tipo === "divida" ? regra : null;
}

/** Horizonte longo o bastante para ver a dívida inteira, mesmo além do plano. */
const horizonteDaDivida = (plano: Plano, regra: RegraDivida) => Math.max(plano.horizonte, regra.inicio + regra.prazo + 1);

/** Saldo devedor no início do mês (antes da parcela do mês). */
export function saldoDevedorNoMes(plano: Plano, objetoId: string, mes: number): number {
  const regra = regraDivida(plano, objetoId);
  if (!regra) return 0;
  if (mes <= regra.inicio) return regra.saldoDevedor;
  return cronogramaDivida(regra, horizonteDaDivida(plano, regra)).saldoDevedor[mes - 1] ?? 0;
}

/**
 * Valor extra que quita a dívida no mês: o saldo devedor menos a amortização da
 * parcela normal do mês (que já está no plano).
 */
export function valorParaQuitar(plano: Plano, objetoId: string, mes: number): number {
  const regra = regraDivida(plano, objetoId);
  if (!regra) return 0;
  const amortizacaoNormal = cronogramaDivida(regra, horizonteDaDivida(plano, regra)).amortizacao[mes] ?? 0;
  return Math.max(0, saldoDevedorNoMes(plano, objetoId, mes) - amortizacaoNormal);
}

export interface EfeitoAmortizacao {
  jurosAntes: number;
  jurosDepois: number;
  jurosEconomizados: number;
  quitacaoAntes: number | null;
  quitacaoDepois: number | null;
  /** Parcelas a menos. */
  parcelasEliminadas: number;
}

/** Compara a dívida com e sem a amortização extra, considerando a dívida inteira. */
export function efeitoAmortizacao(plano: Plano, objetoId: string, mes: number, valor: number): EfeitoAmortizacao | null {
  const regra = regraDivida(plano, objetoId);
  if (!regra) return null;
  const h = horizonteDaDivida(plano, regra);
  const antes = cronogramaDivida(regra, h);
  const extra = Math.min(Math.max(valor, 0), valorParaQuitar(plano, objetoId, mes));
  const extras = { ...regra.amortizacoesExtras, [mes]: (regra.amortizacoesExtras?.[mes] ?? 0) + extra };
  const depois = cronogramaDivida({ ...regra, amortizacoesExtras: extras }, h);
  return {
    jurosAntes: antes.jurosTotais,
    jurosDepois: depois.jurosTotais,
    jurosEconomizados: antes.jurosTotais - depois.jurosTotais,
    quitacaoAntes: antes.mesQuitacao,
    quitacaoDepois: depois.mesQuitacao,
    parcelasEliminadas: antes.mesQuitacao !== null && depois.mesQuitacao !== null ? antes.mesQuitacao - depois.mesQuitacao : 0,
  };
}

export interface ParametrosAmortizacao {
  objetoId: string;
  mes: number;
  valor: number;
  usarFundo?: boolean;
}

/** Amortização extra ou quitação antecipada de uma dívida cadastrada. */
export function simularAmortizacao(plano: Plano, p: ParametrosAmortizacao, novoId: GeradorId): Simulacao | null {
  const objeto = plano.objetos.find((o) => o.id === p.objetoId);
  const regra = regraDivida(plano, p.objetoId);
  if (!objeto || !regra) return null;
  const maximo = valorParaQuitar(plano, p.objetoId, p.mes);
  const valor = Math.min(Math.max(p.valor, 0), maximo);
  const quitacao = valor >= maximo - 0.005;
  const amortizacoesExtras = { ...regra.amortizacoesExtras, [p.mes]: (regra.amortizacoesExtras?.[p.mes] ?? 0) + valor };
  const alteracoes: Alteracao[] = [{ tipo: "alterarObjeto", objetoId: p.objetoId, regra: { ...regra, amortizacoesExtras } }];
  if (p.usarFundo) alteracoes.push(resgateDoFundo(plano, objeto.nome, valor, p.mes, novoId));
  const acao = quitacao ? "Quitação antecipada" : "Amortização extra";
  return {
    id: novoId("simulacao"),
    descricao: `${acao} de ${moeda(valor)} em "${objeto.nome}" em ${mesTxt(plano, p.mes)}${p.usarFundo ? ", com dinheiro do Fundo" : ""}`,
    alteracoes,
  };
}

export interface SituacaoDivida {
  objetoId: string;
  nome: string;
  saldoDevedor: number;
  parcela: number;
  jurosRestantes: number;
  mesQuitacao: number | null;
}

/** Dívidas cadastradas, vistas a partir de um mês (normalmente o atual). */
export function situacaoDasDividas(plano: Plano, mes: number): SituacaoDivida[] {
  return plano.objetos.flatMap((o) => {
    if (o.regra.tipo !== "divida") return [];
    const regra = o.regra;
    const cronograma = cronogramaDivida(regra, horizonteDaDivida(plano, regra));
    const jurosRestantes = cronograma.juros.slice(mes).reduce((a, b) => a + b, 0);
    const parcela = planejadoDoObjeto(o, plano)[mes] ?? cronograma.parcelas[mes] ?? 0;
    return [{ objetoId: o.id, nome: o.nome, saldoDevedor: saldoDevedorNoMes(plano, o.id, mes), parcela, jurosRestantes, mesQuitacao: cronograma.mesQuitacao }];
  });
}
