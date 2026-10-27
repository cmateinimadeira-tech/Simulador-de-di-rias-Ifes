// Tipos do Método Horizonte. Índices de mês são relativos ao início do plano:
// 0 = primeiro mês do horizonte, horizonte - 1 = último.

export interface AnoMes {
  ano: number;
  /** 1 = janeiro ... 12 = dezembro */
  mes: number;
}

export type Bloco =
  | "fixo"
  | "anual"
  | "variavel"
  | "cartaoParcelado"
  | "cartaoAVista"
  | "planejamento"
  | "entradas";

export interface DefinicaoBloco {
  id: Bloco;
  nome: string;
  natureza: "despesa" | "receita";
}

/** Os 7 blocos da metodologia, na ordem em que aparecem na grade. */
export const BLOCOS: readonly DefinicaoBloco[] = [
  { id: "fixo", nome: "Fixo mensal", natureza: "despesa" },
  { id: "anual", nome: "Despesas anuais", natureza: "despesa" },
  { id: "variavel", nome: "Variável mensal", natureza: "despesa" },
  { id: "cartaoParcelado", nome: "Cartão parcelado", natureza: "despesa" },
  { id: "cartaoAVista", nome: "Cartão à vista", natureza: "despesa" },
  { id: "planejamento", nome: "Planejamento", natureza: "despesa" },
  { id: "entradas", nome: "Entradas", natureza: "receita" },
];

export function definicaoBloco(id: Bloco): DefinicaoBloco {
  const def = BLOCOS.find((b) => b.id === id);
  if (!def) throw new Error(`Bloco desconhecido: ${id}`);
  return def;
}

/** Reajuste anual aplicado a partir de um mês do ano (ex.: salário em janeiro). */
export interface Reajuste {
  /** 0.05 = 5% ao ano */
  percentualAnual: number;
  /** 1 a 12 */
  mesDoAno: number;
}

export interface RegraFixo {
  tipo: "fixo";
  valor: number;
  inicio: number;
  fim?: number;
  reajuste?: Reajuste;
}

/** Valor que cai todo mês, como o financiamento SAC da planilha ("mês anterior − 7"). */
export interface RegraDecrescente {
  tipo: "decrescente";
  valorInicial: number;
  reducaoMensal: number;
  inicio: number;
  fim?: number;
}

export interface RegraParcelado {
  tipo: "parcelado";
  parcela: number;
  parcelas: number;
  /** Mês da primeira fatura. */
  inicio: number;
}

export interface RegraAnual {
  tipo: "anual";
  valor: number;
  /** Meses do ano (1 a 12) em que o valor ocorre. */
  mesesDoAno: number[];
  inicio?: number;
  fim?: number;
  reajuste?: Reajuste;
}

export interface RegraUnico {
  tipo: "unico";
  valor: number;
  mes: number;
}

export interface RegraManual {
  tipo: "manual";
  /** Índice do mês → valor. */
  valores: Record<number, number>;
}

export interface RegraDivida {
  tipo: "divida";
  saldoDevedor: number;
  /** 0.015 = 1,5% ao mês */
  taxaMensal: number;
  prazo: number;
  sistema: "price" | "sac";
  /** Mês da primeira parcela. */
  inicio: number;
  /** Amortizações extras por mês (quitação antecipada = saldo inteiro). */
  amortizacoesExtras?: Record<number, number>;
}

export type Regra =
  | RegraFixo
  | RegraDecrescente
  | RegraParcelado
  | RegraAnual
  | RegraUnico
  | RegraManual
  | RegraDivida;

export type TipoRegra = Regra["tipo"];

/**
 * Papel especial de um objeto no fechamento:
 * - aporteFundo: despesa do bloco Planejamento que alimenta o Fundo ("pague-se primeiro");
 * - resgateFundo: entrada que sai do Fundo;
 * - entradaPossivel: entrada incerta, fora do saldo conservador.
 */
export type FuncaoObjeto = "aporteFundo" | "resgateFundo" | "entradaPossivel";

/**
 * Acompanhamento de um objeto num mês aberto:
 * - quitado: o que foi pago encerra o mês (a sobra do previsto volta para o saldo);
 * - restante: ainda falta pagar este valor, além do que já foi pago.
 * Sem situação, falta pagar a diferença entre o previsto e o pago.
 */
export type SituacaoMes = { situacao: "quitado" } | { situacao: "restante"; valor: number };

/** Uma linha da grade. */
export interface Objeto {
  id: string;
  bloco: Bloco;
  nome: string;
  regra: Regra;
  funcao?: FuncaoObjeto;
  /** Ajustes manuais do planejado, que prevalecem sobre a regra. */
  ajustes?: Record<number, number>;
  /** Realizado informado direto por mês (soma-se aos lançamentos com data). */
  realizado?: Record<number, number>;
  /** Situação do acompanhamento por mês. */
  acompanhamento?: Record<number, SituacaoMes>;
}

export interface Fechamento {
  /** Saldo real em conta informado ao fechar o mês. */
  saldoReal: number;
  data?: string;
}

/** Previsto original de um mês, congelado quando o mês começa: o histórico do que estava planejado. */
export interface LinhaDeBaseMes {
  congeladoEm: string;
  /** Objeto → previsto original. Objeto ausente = não existia (original 0). */
  valores: Record<string, number>;
}

/** Retrato do mês registrado numa revisão (normalmente semanal). */
export interface Revisao {
  id: string;
  /** "AAAA-MM-DD" */
  data: string;
  mes: number;
  saldoVigente: number;
  saldoOriginal: number | null;
  despesasPagas: number;
  despesasAPagar: number;
  entradasRecebidas: number;
  entradasAReceber: number;
  acumuladoMes: number;
  patrimonioFinal: number;
  nota?: string;
}

/** Cartão de crédito: define em que mês uma compra é paga. */
export interface Cartao {
  id: string;
  nome: string;
  /** Dia do fechamento da fatura (1 a 31). Compras a partir deste dia vão para a fatura seguinte. */
  diaFechamento: number;
  /** Dia do vencimento da fatura (1 a 31). */
  diaVencimento: number;
}

/** Um gasto ou recebimento realizado, lançado com data. */
export interface Lancamento {
  id: string;
  objetoId: string;
  /** Data da compra ou do recebimento, "AAAA-MM-DD". */
  data: string;
  valor: number;
  cartaoId?: string;
  descricao?: string;
}

export interface Plano {
  id: string;
  nome: string;
  inicio: AnoMes;
  /** Quantidade de meses do horizonte (12 a 48 no MVP). */
  horizonte: number;
  saldoInicialConta: number;
  saldoInicialFundo: number;
  /** Rendimento mensal do Fundo. 0 por padrão, como na planilha. */
  taxaFundoMensal: number;
  objetos: Objeto[];
  /** Índice do mês → fechamento. */
  fechamentos?: Record<number, Fechamento>;
  cartoes?: Cartao[];
  lancamentos?: Lancamento[];
  /** Renda recebida a partir deste dia conta para o mês seguinte (ex.: salário do dia 25). */
  diaCorteRenda?: number;
  /** Índice do mês → previsto original congelado. */
  linhaDeBase?: Record<number, LinhaDeBaseMes>;
  revisoes?: Revisao[];
  cenarios?: Cenario[];
  cenariosAplicados?: CenarioAplicado[];
}

export type Alteracao =
  | { tipo: "incluirObjeto"; objeto: Objeto }
  | { tipo: "alterarObjeto"; objetoId: string; regra?: Regra; nome?: string; funcao?: FuncaoObjeto | null }
  | { tipo: "removerObjeto"; objetoId: string }
  | { tipo: "ajustarValor"; objetoId: string; mes: number; valor: number | null };

/** Uma decisão simulada (ex.: "comprar o carro financiado"), com as alterações que ela produz. */
export interface Simulacao {
  id: string;
  descricao: string;
  alteracoes: Alteracao[];
}

export interface Cenario {
  id: string;
  nome: string;
  /** Sobrescreve a taxa do Fundo do plano neste cenário. */
  taxaFundoMensal?: number;
  /** Alterações avulsas (aplicadas antes das simulações). */
  alteracoes: Alteracao[];
  simulacoes?: Simulacao[];
}

/** Registro de um cenário incorporado ao plano. */
export interface CenarioAplicado {
  id: string;
  nome: string;
  /** "AAAA-MM-DD" */
  data: string;
  simulacoes: string[];
}
