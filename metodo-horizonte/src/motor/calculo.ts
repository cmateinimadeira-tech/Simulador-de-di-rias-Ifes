import { anoMesDoIndice } from "./meses";
import { cronogramaDivida } from "./dividas";
import { gerarValores } from "./regras";
import { BLOCOS, definicaoBloco } from "./tipos";
import type { AnoMes, Bloco, Objeto, Plano } from "./tipos";

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
  /** Planejado de cada objeto (regra + ajustes manuais). */
  planejado: Record<string, number[]>;
  /** Valor usado no cálculo: realizado nos meses fechados, planejado nos demais. */
  efetivo: Record<string, number[]>;
  totaisPorBloco: Record<Bloco, number[]>;
  despesas: number[];
  entradas: number[];
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

export function planejadoDoObjeto(objeto: Objeto, plano: Plano): number[] {
  const valores = gerarValores(objeto.regra, plano);
  for (const [chave, valor] of Object.entries(objeto.ajustes ?? {})) {
    const m = Number(chave);
    if (m >= 0 && m < plano.horizonte) valores[m] = valor;
  }
  return valores;
}

export function calcularPlano(plano: Plano, opcoes: OpcoesCalculo = {}): ResultadoPlano {
  const n = plano.horizonte;
  const fechamentos = plano.fechamentos ?? {};
  const meses = Array.from({ length: n }, (_, m) => anoMesDoIndice(plano.inicio, m));

  const planejado: Record<string, number[]> = {};
  const efetivo: Record<string, number[]> = {};
  const totaisPorBloco = Object.fromEntries(BLOCOS.map((b) => [b.id, zeros(n)])) as Record<Bloco, number[]>;
  const despesas = zeros(n);
  const entradas = zeros(n);
  const entradasPossiveis = zeros(n);
  const aportes = zeros(n);
  const resgates = zeros(n);
  const saldoDevedor = zeros(n);
  let jurosTotais = 0;
  const alertas: Alerta[] = [];

  for (const objeto of plano.objetos) {
    const plan = planejadoDoObjeto(objeto, plano);
    const efet = plan.map((v, m) => {
      const real = objeto.realizado?.[m];
      return fechamentos[m] && real !== undefined ? real : v;
    });
    planejado[objeto.id] = plan;
    efetivo[objeto.id] = efet;

    const receita = definicaoBloco(objeto.bloco).natureza === "receita";
    for (let m = 0; m < n; m++) {
      const v = efet[m] ?? 0;
      totaisPorBloco[objeto.bloco][m]! += v;
      if (receita) {
        entradas[m]! += v;
        if (objeto.funcao === "entradaPossivel") entradasPossiveis[m]! += v;
        if (objeto.funcao === "resgateFundo") resgates[m]! += v;
      } else {
        despesas[m]! += v;
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

  alertas.push(...alertasDoFechamento(plano, saldo, acumulado, planejado, efetivo, opcoes));
  alertas.sort((a, b) => a.mes - b.mes);

  let menorAcumulado = { valor: Infinity, mes: 0 };
  acumulado.forEach((v, m) => {
    if (v < menorAcumulado.valor) menorAcumulado = { valor: v, mes: m };
  });
  if (n === 0) menorAcumulado = { valor: 0, mes: 0 };

  return {
    meses,
    planejado,
    efetivo,
    totaisPorBloco,
    despesas,
    entradas,
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
  efetivo: Record<string, number[]>,
  opcoes: OpcoesCalculo,
): Alerta[] {
  const alertas: Alerta[] = [];
  const limite = opcoes.limiteDesvio ?? 0.1;
  const referencia = opcoes.mesReferencia ?? 0;
  const fechamentos = plano.fechamentos ?? {};
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
    const efet = efetivo[objeto.id]!;
    const despesa = definicaoBloco(objeto.bloco).natureza === "despesa";
    for (const chave of Object.keys(fechamentos)) {
      const m = Number(chave);
      const p = plan[m] ?? 0;
      const r = efet[m] ?? 0;
      if (despesa && p > 0 && r > p * (1 + limite)) {
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
