import { describe, expect, it } from "vitest";
import {
  anoMesDoIndice,
  aplicarCenario,
  calcularPlano,
  compararCenarios,
  cronogramaDivida,
  gerarValores,
  indiceDoAnoMes,
  mesPorNome,
  parcelaPrice,
  rotuloMes,
} from "@/motor";
import type { Objeto, Plano } from "@/motor";

const inicio = { ano: 2026, mes: 5 }; // maio/2026
const horizonte = { inicio, horizonte: 12 };

function plano(objetos: Objeto[], extra: Partial<Plano> = {}): Plano {
  return {
    id: "p1",
    nome: "Teste",
    inicio,
    horizonte: 12,
    saldoInicialConta: 0,
    saldoInicialFundo: 0,
    taxaFundoMensal: 0,
    objetos,
    ...extra,
  };
}

describe("meses", () => {
  it("converte índice em ano e mês, atravessando a virada do ano", () => {
    expect(anoMesDoIndice(inicio, 0)).toEqual({ ano: 2026, mes: 5 });
    expect(anoMesDoIndice(inicio, 8)).toEqual({ ano: 2027, mes: 1 });
    expect(indiceDoAnoMes(inicio, { ano: 2027, mes: 1 })).toBe(8);
    expect(rotuloMes({ ano: 2027, mes: 3 })).toBe("mar/27");
  });

  it("reconhece nomes de meses com acento, abreviação e ponto", () => {
    expect(mesPorNome("Março")).toBe(3);
    expect(mesPorNome("marco")).toBe(3);
    expect(mesPorNome("set.")).toBe(9);
    expect(mesPorNome("maio")).toBe(5);
    expect(mesPorNome("ma")).toBeUndefined();
    expect(mesPorNome("Objetos")).toBeUndefined();
  });
});

describe("regras de lançamento", () => {
  it("fixo respeita início e fim", () => {
    expect(gerarValores({ tipo: "fixo", valor: 100, inicio: 2, fim: 4 }, horizonte)).toEqual([
      0, 0, 100, 100, 100, 0, 0, 0, 0, 0, 0, 0,
    ]);
  });

  it("decrescente reproduz o financiamento da planilha (mês anterior − 7)", () => {
    const valores = gerarValores({ tipo: "decrescente", valorInicial: 2265, reducaoMensal: 7, inicio: 0 }, horizonte);
    expect(valores.slice(0, 4)).toEqual([2265, 2258, 2251, 2244]);
    expect(valores[11]).toBe(2188);
  });

  it("parcelado ocupa N meses a partir da primeira fatura", () => {
    expect(gerarValores({ tipo: "parcelado", parcela: 78, parcelas: 3, inicio: 10 }, horizonte)).toEqual([
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 78, 78,
    ]);
  });

  it("anual cai nos meses do ano informados", () => {
    // janeiro = índice 8 (maio/26 + 8)
    const valores = gerarValores({ tipo: "anual", valor: 1800, mesesDoAno: [1] }, horizonte);
    expect(valores[8]).toBe(1800);
    expect(valores.filter((v) => v > 0)).toHaveLength(1);
  });

  it("reajuste anual é aplicado a partir do mês de referência", () => {
    const valores = gerarValores(
      { tipo: "fixo", valor: 1000, inicio: 0, reajuste: { percentualAnual: 0.1, mesDoAno: 1 } },
      horizonte,
    );
    expect(valores[7]).toBe(1000); // dezembro
    expect(valores[8]).toBeCloseTo(1100); // janeiro
  });

  it("único e manual", () => {
    expect(gerarValores({ tipo: "unico", valor: 50, mes: 3 }, horizonte)[3]).toBe(50);
    const manual = gerarValores({ tipo: "manual", valores: { 1: 10, 5: 20, 99: 30 } }, horizonte);
    expect(manual[1]).toBe(10);
    expect(manual[5]).toBe(20);
    expect(manual.reduce((a, b) => a + b, 0)).toBe(30);
  });
});

describe("dívidas", () => {
  it("Price: parcela igual à da calculadora financeira", () => {
    expect(parcelaPrice(10000, 0.01, 12)).toBeCloseTo(888.49, 2);
    const c = cronogramaDivida({ tipo: "divida", saldoDevedor: 10000, taxaMensal: 0.01, prazo: 12, sistema: "price", inicio: 0 }, 24);
    expect(c.parcelas[0]).toBeCloseTo(888.49, 2);
    expect(c.parcelas[11]).toBeCloseTo(888.49, 2);
    expect(c.parcelas[12]).toBe(0);
    expect(c.mesQuitacao).toBe(11);
    expect(c.saldoDevedor[11]).toBe(0);
    expect(c.jurosTotais).toBeCloseTo(888.4879 * 12 - 10000, 1);
  });

  it("SAC: amortização constante e parcela decrescente", () => {
    const c = cronogramaDivida({ tipo: "divida", saldoDevedor: 12000, taxaMensal: 0.01, prazo: 12, sistema: "sac", inicio: 0 }, 12);
    expect(c.parcelas[0]).toBeCloseTo(1120);
    expect(c.parcelas[11]).toBeCloseTo(1010);
    expect(c.jurosTotais).toBeCloseTo(780);
  });

  it("quitação antecipada encerra a dívida e reduz os juros", () => {
    const base = { tipo: "divida" as const, saldoDevedor: 10000, taxaMensal: 0.02, prazo: 24, sistema: "price" as const, inicio: 0 };
    const normal = cronogramaDivida(base, 24);
    const quitada = cronogramaDivida({ ...base, amortizacoesExtras: { 3: 1_000_000 } }, 24);
    expect(quitada.mesQuitacao).toBe(3);
    expect(quitada.parcelas[4]).toBe(0);
    expect(quitada.jurosTotais).toBeLessThan(normal.jurosTotais);
  });

  it("dívida futura só entra no saldo devedor quando começa", () => {
    const c = cronogramaDivida({ tipo: "divida", saldoDevedor: 6000, taxaMensal: 0, prazo: 6, sistema: "sac", inicio: 4 }, 12);
    expect(c.saldoDevedor[3]).toBe(0);
    expect(c.saldoDevedor[4]).toBe(5000);
    expect(c.mesQuitacao).toBe(9);
  });
});

describe("cálculo do plano", () => {
  const salario: Objeto = { id: "sal", bloco: "entradas", nome: "Salário", regra: { tipo: "fixo", valor: 10000, inicio: 0 } };
  const aluguel: Objeto = { id: "alu", bloco: "fixo", nome: "Aluguel", regra: { tipo: "fixo", valor: 3000, inicio: 0 } };
  const fundo: Objeto = {
    id: "fun",
    bloco: "planejamento",
    nome: "Fundo",
    funcao: "aporteFundo",
    regra: { tipo: "fixo", valor: 2000, inicio: 0 },
  };

  it("saldo, acumulado e Fundo seguem as fórmulas da metodologia", () => {
    const r = calcularPlano(plano([salario, aluguel, fundo], { saldoInicialConta: 500, saldoInicialFundo: 1000 }));
    expect(r.despesas[0]).toBe(5000); // o aporte no Fundo conta como despesa
    expect(r.saldo[0]).toBe(5000);
    expect(r.acumulado[0]).toBe(5500);
    expect(r.acumulado[11]).toBe(500 + 12 * 5000);
    expect(r.fundo[11]).toBe(1000 + 12 * 2000);
    expect(r.patrimonio[11]).toBe(r.fundo[11]! + r.acumulado[11]!);
    expect(r.totaisPorBloco.fixo[0]).toBe(3000);
  });

  it("resgate do Fundo entra como receita e baixa o Fundo, sem contar duas vezes", () => {
    const resgate: Objeto = {
      id: "res",
      bloco: "entradas",
      nome: "Reserva",
      funcao: "resgateFundo",
      regra: { tipo: "unico", valor: 1500, mes: 2 },
    };
    const r = calcularPlano(plano([salario, aluguel, fundo, resgate]));
    expect(r.entradas[2]).toBe(11500);
    expect(r.fundo[2]).toBe(3 * 2000 - 1500);
    const semResgate = calcularPlano(plano([salario, aluguel, fundo]));
    expect(r.patrimonio[11]).toBeCloseTo(semResgate.patrimonio[11]!);
  });

  it("taxa do Fundo rende sobre o saldo do mês anterior", () => {
    const r = calcularPlano(plano([fundo], { taxaFundoMensal: 0.01 }));
    expect(r.fundo[0]).toBe(2000);
    expect(r.fundo[1]).toBeCloseTo(2000 * 1.01 + 2000);
  });

  it("separa o saldo conservador das entradas possíveis", () => {
    const extra: Objeto = { id: "ext", bloco: "entradas", nome: "Freela", funcao: "entradaPossivel", regra: { tipo: "unico", valor: 800, mes: 0 } };
    const r = calcularPlano(plano([salario, aluguel, extra]));
    expect(r.saldo[0]).toBe(7800);
    expect(r.saldoConservador[0]).toBe(7000);
  });

  it("ajuste manual prevalece sobre a regra", () => {
    const r = calcularPlano(plano([{ ...aluguel, ajustes: { 3: 3500 } }]));
    expect(r.planejado.alu![2]).toBe(3000);
    expect(r.planejado.alu![3]).toBe(3500);
  });

  it("mês fechado usa o realizado e o saldo real em conta", () => {
    const comRealizado: Objeto = { ...aluguel, realizado: { 0: 3600 } };
    const r = calcularPlano(plano([salario, comRealizado], { fechamentos: { 0: { saldoReal: 6300 } } }));
    expect(r.efetivo.alu![0]).toBe(3600);
    expect(r.saldo[0]).toBe(6400);
    expect(r.ajusteFechamento[0]).toBe(-100);
    expect(r.acumulado[0]).toBe(6300);
    expect(r.acumulado[1]).toBe(6300 + 7000);
    expect(r.alertas.some((a) => a.tipo === "desvioObjeto" && a.objetoId === "alu")).toBe(true);
  });

  it("pagamento acima do previsto num mês aberto já entra no retrato do mês", () => {
    const r = calcularPlano(plano([salario, { ...aluguel, realizado: { 0: 3200 } }]));
    expect(r.efetivo.alu![0]).toBe(3200);
    expect(r.aPagar.alu![0]).toBe(0);
    expect(r.saldoPrevisto[0]).toBe(7000);
    expect(r.saldo[0]).toBe(6800);
  });

  it("alerta de mês negativo e de caixa negativo", () => {
    const viagem: Objeto = { id: "via", bloco: "variavel", nome: "Viagem", regra: { tipo: "unico", valor: 9000, mes: 1 } };
    const carro: Objeto = { id: "car", bloco: "variavel", nome: "Conserto", regra: { tipo: "unico", valor: 20000, mes: 3 } };
    const r = calcularPlano(plano([salario, aluguel, viagem, carro]));
    expect(r.alertas.find((a) => a.mes === 1)?.tipo).toBe("mesNegativo");
    expect(r.alertas.find((a) => a.mes === 3)?.tipo).toBe("caixaNegativo");
    expect(r.resumo.menorAcumulado.mes).toBe(3);
    expect(r.resumo.mesesNegativos).toBe(2);
  });

  it("dívida entra como parcela e como saldo devedor no patrimônio", () => {
    const divida: Objeto = {
      id: "div",
      bloco: "planejamento",
      nome: "Consignado",
      regra: { tipo: "divida", saldoDevedor: 12000, taxaMensal: 0, prazo: 12, sistema: "sac", inicio: 0 },
    };
    const r = calcularPlano(plano([salario, divida]));
    expect(r.despesas[0]).toBe(1000);
    expect(r.saldoDevedor[0]).toBe(11000);
    expect(r.patrimonio[0]).toBe(9000 - 11000);
    expect(r.alertas.some((a) => a.tipo === "fimDivida" && a.mes === 11)).toBe(true);
  });
});

describe("cenários", () => {
  const salario: Objeto = { id: "sal", bloco: "entradas", nome: "Salário", regra: { tipo: "fixo", valor: 10000, inicio: 0 } };
  const base = plano([salario]);

  it("aplicar um cenário não altera o plano original", () => {
    const cenario = aplicarCenario(base, {
      id: "c1",
      nome: "Corte",
      alteracoes: [{ tipo: "alterarObjeto", objetoId: "sal", regra: { tipo: "fixo", valor: 8000, inicio: 0 } }],
    });
    expect((cenario.objetos[0]!.regra as { valor: number }).valor).toBe(8000);
    expect((base.objetos[0]!.regra as { valor: number }).valor).toBe(10000);
  });

  it("compara carro à vista com carro financiado", () => {
    const comparacao = compararCenarios(base, [
      {
        id: "vista",
        nome: "À vista",
        alteracoes: [
          { tipo: "incluirObjeto", objeto: { id: "car", bloco: "variavel", nome: "Carro", regra: { tipo: "unico", valor: 30000, mes: 0 } } },
        ],
      },
      {
        id: "financiado",
        nome: "Financiado",
        alteracoes: [
          {
            tipo: "incluirObjeto",
            objeto: {
              id: "car",
              bloco: "planejamento",
              nome: "Carro",
              regra: { tipo: "divida", saldoDevedor: 30000, taxaMensal: 0.015, prazo: 24, sistema: "price", inicio: 0 },
            },
          },
        ],
      },
    ]);
    expect(comparacao.map((c) => c.id)).toEqual(["base", "vista", "financiado"]);
    const [, vista, financiado] = comparacao;
    expect(vista!.resumo.menorAcumulado.valor).toBeLessThan(0);
    expect(financiado!.resumo.menorAcumulado.valor).toBeGreaterThan(0);
    expect(financiado!.resumo.jurosTotais).toBeGreaterThan(0);
    // Financiar custa os juros: o patrimônio final fica menor que à vista.
    expect(financiado!.resumo.patrimonioFinal).toBeLessThan(vista!.resumo.patrimonioFinal);
  });

  it("ajustarValor com null remove o ajuste", () => {
    const comAjuste = plano([{ ...salario, ajustes: { 2: 1 } }]);
    const p = aplicarCenario(comAjuste, { id: "c", nome: "c", alteracoes: [{ tipo: "ajustarValor", objetoId: "sal", mes: 2, valor: null }] });
    expect(calcularPlano(p).planejado.sal![2]).toBe(10000);
  });
});
