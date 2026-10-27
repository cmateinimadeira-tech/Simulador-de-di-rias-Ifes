import { anoMesDoIndice } from "./meses";
import { cronogramaDivida } from "./dividas";
import { valorVigente } from "./acompanhamento";
import { realizadoPorObjeto } from "./lancamentos";
import { planejadoDoObjeto } from "./regras";
import { BLOCOS, definicaoBloco } from "./tipos";
import type { AnoMes, Bloco, Plano } from "./tipos";

export type GravidadeAlerta = "critico" | "atencao" | "informativo" | "positivo";

export type TipoAlerta = "caixaNegativo" | "mesNegativo" | "desvioObjeto" | "vencimentoAnual" | "fimDivida";

export interface Alerta {
  tipo: TipoAlerta;
  gravidade: GravidadeAlerta;
  mes: number;
  mensagem: string;
  objetoId?: string;
}

export interface ResumoPlano {
  patrimonioFinal: number;
  acumuladoFinal: number;
  fundoFinal: number;
  menorAcumulado: { valor: number; mes: number };
  jurosTotais: number;
  mesesNegativos: number;
}

export interface ResultadoPlano {
  meses: AnoMes[];
  /** Previsto atual de cada objeto (regra + ajustes manuais). */
  planejado: Record<string, number[]>;
  /** Previsto original congelado (null = mês sem linha de base). */
  original: Record<string, (number | null)[]>;
  /** Pago ou recebido de cada objeto (null = nada lançado no mês), fechado ou não. */
  realizado: Record<string, (number | null)[]>;
  /** Quanto ainda falta pagar ou receber no mês. */
  aPagar: Record<string, number[]>;
  /** Valor vigente usado no cálculo: pago + a pagar nos meses abertos; realizado nos fechados. */
  efetivo: Record<string, number[]>;
  /** Totais vigentes por bloco. */
  totaisPorBloco: Record<Bloco, number[]>;
  /** Totais do previsto atual por bloco. */
  totaisPrevistosPorBloco: Record<Bloco, number[]>;
  despesas: number[];
  entradas: number[];
  despesasPrevistas: number[];
  entradasPrevistas: number[];
  /** Saldo só com o previsto atual, sem o acompanhamento. */
  saldoPrevisto: number[];
  /** Saldo do previsto original congelado (null = mês sem linha de base). */
  saldoOriginal: (number | null)[];
  entradasPossiveis: number[];
  saldo: number[];
  /** Saldo sem as entradas possíveis. */
  saldoConservador: number[];
  /** Diferença entre o saldo real informado no fechamento e o acumulado calculado. */
  ajusteFechamento: number[];
  acumulado: number[];
  aportes: number[];
  resgates: number[];
  fundo: number[];
  saldoDevedor: number[];
  patrimonio: number[];
  alertas: Alerta[];
  resumo: ResumoPlano;
}

export interface OpcoesCalculo {
  /** Mês considerado "hoje" para alertas de vencimento. Padrão: 0. */
  mesReferencia?: number;
  /** Desvio tolerado entre realizado e planejado. Padrão: 10%. */
  limiteDesvio?: number;
}

const zeros = (n: number) => new Array<number>(n).fill(0);

export function calcularPlano(plano: Plano, opcoes: OpcoesCalculo = {}): ResultadoPlano {
  const n = plano.horizonte;
  const fechamentos = plano.fechamentos ?? {};
  const meses = Array.from({ length: n }, (_, m) => anoMesDoIndice(plano.inicio, m));

  const linhaDeBase = plano.linhaDeBase ?? {};
  const planejado: Record<string, number[]> = {};
  const original: Record<string, (number | null)[]> = {};
  const realizado: Record<string, (number | null)[]> = {};
  const aPagar: Record<string, number[]> = {};
  const efetivo: Record<string, number[]> = {};
  const realizadoMapa = realizadoPorObjeto(plano);
  const porBloco = () => Object.fromEntries(BLOCOS.map((b) => [b.id, zeros(n)])) as Record<Bloco, number[]>;
  const totaisPorBloco = porBloco();
  const totaisPrevistosPorBloco = porBloco();
  const despesas = zeros(n);
  const entradas = zeros(n);
  const despesasPrevistas = zeros(n);
  const entradasPrevistas = zeros(n);
  const saldoOriginal: (number | null)[] = Array.from({ length: n }, (_, m) => (linhaDeBase[m] ? 0 : null));
  const entradasPossiveis = zeros(n);
  const aportes = zeros(n);
  const resgates = zeros(n);
  const saldoDevedor = zeros(n);
  let jurosTotais = 0;
  const alertas: Alerta[] = [];

  for (const objeto of plano.objetos) {
    const plan = planejadoDoObjeto(objeto, plano);
    const real = plan.map((_, m) => realizadoMapa[objeto.id]?.[m] ?? null);
    const valores = plan.map((v, m) => valorVigente(v, real[m]!, objeto.acompanhamento?.[m], !!fechamentos[m]));
    const efet = valores.map((v) => v.vigente);
    planejado[objeto.id] = plan;
    original[objeto.id] = plan.map((_, m) => (linhaDeBase[m] ? (linhaDeBase[m]!.valores[objeto.id] ?? 0) : null));
    realizado[objeto.id] = real;
    aPagar[objeto.id] = valores.map((v) => v.aPagar);
    efetivo[objeto.id] = efet;

    const receita = definicaoBloco(objeto.bloco).natureza === "receita";
    for (let m = 0; m < n; m++) {
      const v = efet[m] ?? 0;
      const previsto = plan[m] ?? 0;
      const orig = original[objeto.id]![m];
      totaisPorBloco[objeto.bloco][m]! += v;
      totaisPrevistosPorBloco[objeto.bloco][m]! += previsto;
      if (orig !== null && orig !== undefined) saldoOriginal[m]! += receita ? orig : -orig;
      if (receita) {
        entradas[m]! += v;
        entradasPrevistas[m]! += previsto;
        if (objeto.funcao === "entradaPossivel") entradasPossiveis[m]! += v;
        if (objeto.funcao === "resgateFundo") resgates[m]! += v;
      } else {
        despesas[m]! += v;
        despesasPrevistas[m]! += previsto;
        if (objeto.funcao === "aporteFundo") aportes[m]! += v;
      }
    }

    if (objeto.regra.tipo === "divida") {
      const cronograma = cronogramaDivida(objeto.regra, n);
      cronograma.saldoDevedor.forEach((s, m) => (saldoDevedor[m]! += s));
      jurosTotais += cronograma.jurosTotais;
      if (cronograma.mesQuitacao !== null) {
        alertas.push({
          tipo: "fimDivida",
          gravidade: "positivo",
          mes: cronograma.mesQuitacao,
          objetoId: objeto.id,
          mensagem: `Última parcela de "${objeto.nome}". Que tal direcionar o valor ao Fundo?`,
        });
      }
    }
  }

  const saldo = zeros(n);
  const saldoConservador = zeros(n);
  const ajusteFechamento = zeros(n);
  const acumulado = zeros(n);
  const fundo = zeros(n);
  const patrimonio = zeros(n);

  let acumuladoAnterior = plano.saldoInicialConta;
  let fundoAnterior = plano.saldoInicialFundo;
  for (let m = 0; m < n; m++) {
    saldo[m] = entradas[m]! - despesas[m]!;
    saldoConservador[m] = saldo[m]! - entradasPossiveis[m]!;

    let acum = acumuladoAnterior + saldo[m]!;
    const fechamento = fechamentos[m];
    if (fechamento) {
      ajusteFechamento[m] = fechamento.saldoReal - acum;
      acum = fechamento.saldoReal;
    }
    acumulado[m] = acum;
    acumuladoAnterior = acum;

    fundo[m] = fundoAnterior * (1 + plano.taxaFundoMensal) + aportes[m]! - resgates[m]!;
    fundoAnterior = fundo[m]!;

    patrimonio[m] = fundo[m]! + acumulado[m]! - saldoDevedor[m]!;
  }

  alertas.push(...alertasDoFechamento(plano, saldo, acumulado, planejado, realizado, opcoes));
  alertas.sort((a, b) => a.mes - b.mes);

  let menorAcumulado = { valor: Infinity, mes: 0 };
  acumulado.forEach((v, m) => {
    if (v < menorAcumulado.valor) menorAcumulado = { valor: v, mes: m };
  });
  if (n === 0) menorAcumulado = { valor: 0, mes: 0 };

  return {
    meses,
    planejado,
    original,
    realizado,
    aPagar,
    efetivo,
    totaisPorBloco,
    totaisPrevistosPorBloco,
    despesas,
    entradas,
    despesasPrevistas,
    entradasPrevistas,
    saldoPrevisto: entradasPrevistas.map((e, m) => e - despesasPrevistas[m]!),
    saldoOriginal,
    entradasPossiveis,
    saldo,
    saldoConservador,
    ajusteFechamento,
    acumulado,
    aportes,
    resgates,
    fundo,
    saldoDevedor,
    patrimonio,
    alertas,
    resumo: {
      patrimonioFinal: patrimonio.at(-1) ?? 0,
      acumuladoFinal: acumulado.at(-1) ?? 0,
      fundoFinal: fundo.at(-1) ?? 0,
      menorAcumulado,
      jurosTotais,
      mesesNegativos: saldo.filter((s) => s < 0).length,
    },
  };
}

function alertasDoFechamento(
  plano: Plano,
  saldo: number[],
  acumulado: number[],
  planejado: Record<string, number[]>,
  realizado: Record<string, (number | null)[]>,
  opcoes: OpcoesCalculo,
): Alerta[] {
  const alertas: Alerta[] = [];
  const limite = opcoes.limiteDesvio ?? 0.1;
  const referencia = opcoes.mesReferencia ?? 0;
  const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  for (let m = 0; m < plano.horizonte; m++) {
    if (acumulado[m]! < 0) {
      alertas.push({
        tipo: "caixaNegativo",
        gravidade: "critico",
        mes: m,
        mensagem: `O acumulado fica negativo (${moeda(acumulado[m]!)}).`,
      });
    } else if (saldo[m]! < 0) {
      alertas.push({
        tipo: "mesNegativo",
        gravidade: "atencao",
        mes: m,
        mensagem: `O mês fecha negativo (${moeda(saldo[m]!)}), coberto pelo acumulado.`,
      });
    }
  }

  for (const objeto of plano.objetos) {
    const plan = planejado[objeto.id]!;
    const pago = realizado[objeto.id]!;
    const despesa = definicaoBloco(objeto.bloco).natureza === "despesa";
    // Desvio em tempo real: vale para mês aberto ou fechado, assim que o pago passa do previsto.
    for (let m = 0; m < plano.horizonte; m++) {
      const p = plan[m] ?? 0;
      const r = pago[m];
      if (despesa && r !== null && r !== undefined && p > 0 && r > p * (1 + limite)) {
        alertas.push({
          tipo: "desvioObjeto",
          gravidade: "atencao",
          mes: m,
          objetoId: objeto.id,
          mensagem: `"${objeto.nome}" passou ${Math.round((r / p - 1) * 100)}% do planejado.`,
        });
      }
    }
    if (objeto.bloco === "anual") {
      for (let m = referencia; m <= Math.min(referencia + 2, plano.horizonte - 1); m++) {
        if ((plan[m] ?? 0) > 0) {
          alertas.push({
            tipo: "vencimentoAnual",
            gravidade: "informativo",
            mes: m,
            objetoId: objeto.id,
            mensagem: `"${objeto.nome}" vence em breve: ${moeda(plan[m]!)}.`,
          });
        }
      }
    }
  }
  return alertas;
}
