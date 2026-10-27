import { describe, expect, it } from "vitest";
import {
  aplicarCenario,
  aplicarCenarioAoPlano,
  calcularPlano,
  efeitoAmortizacao,
  saldoDevedorNoMes,
  simularAmortizacao,
  simularCompra,
  simularMudancaDeValor,
  simularNovoItem,
  situacaoDasDividas,
  valorParaQuitar,
} from "@/motor";
import type { Cenario, Plano, Simulacao } from "@/motor";

let contador = 0;
const novoId = (prefixo: string) => `${prefixo}-${++contador}`;

const plano: Plano = {
  id: "p",
  nome: "Teste",
  inicio: { ano: 2026, mes: 10 },
  horizonte: 24,
  saldoInicialConta: 0,
  saldoInicialFundo: 50000,
  taxaFundoMensal: 0,
  objetos: [
    { id: "sal", bloco: "entradas", nome: "Salário", regra: { tipo: "fixo", valor: 10000, inicio: 0 } },
    { id: "gas", bloco: "fixo", nome: "Gastos", regra: { tipo: "fixo", valor: 6000, inicio: 0 } },
    {
      id: "con",
      bloco: "planejamento",
      nome: "Consignado",
      regra: { tipo: "divida", saldoDevedor: 12000, taxaMensal: 0.02, prazo: 36, sistema: "price", inicio: 0 },
    },
  ],
};

const cenario = (...simulacoes: Simulacao[]): Cenario => ({ id: novoId("cen"), nome: "Teste", alteracoes: [], simulacoes });
const calcular = (s: Simulacao) => calcularPlano(aplicarCenario(plano, cenario(s)));
const base = calcularPlano(plano);

describe("compra", () => {
  it("à vista sai do saldo do mês; com o Fundo, sai do Fundo e o patrimônio é o mesmo", () => {
    const vista = calcular(simularCompra(plano, { nome: "Carro", valor: 30000, mes: 2, forma: "vista" }, novoId));
    expect(vista.saldo[2]).toBeCloseTo(base.saldo[2]! - 30000);
    expect(vista.acumulado[1]).toBeCloseTo(base.acumulado[1]!);

    const comFundo = calcular(simularCompra(plano, { nome: "Carro", valor: 30000, mes: 2, forma: "vista", usarFundo: true }, novoId));
    expect(comFundo.acumulado[2]).toBeCloseTo(base.acumulado[2]!);
    expect(comFundo.fundo[2]).toBeCloseTo(base.fundo[2]! - 30000);
    expect(comFundo.resumo.patrimonioFinal).toBeCloseTo(vista.resumo.patrimonioFinal);
  });

  it("parcelada sem juros vira parcelas no cartão", () => {
    const s = simularCompra(plano, { nome: "Geladeira", valor: 3000, mes: 1, forma: "parcelado", parcelas: 10 }, novoId);
    expect(s.descricao).toContain("10x de R$");
    const r = calcular(s);
    expect(r.totaisPorBloco.cartaoParcelado[1]).toBeCloseTo(300);
    expect(r.totaisPorBloco.cartaoParcelado[10]).toBeCloseTo(300);
    expect(r.totaisPorBloco.cartaoParcelado[11]).toBe(0);
  });

  it("financiada: entrada no mês, parcelas a partir do mês seguinte e o custo é exatamente os juros pagos", () => {
    const vista = calcular(simularCompra(plano, { nome: "Carro", valor: 30000, mes: 2, forma: "vista" }, novoId));
    const s = simularCompra(
      plano,
      { nome: "Carro", valor: 30000, mes: 2, forma: "financiado", entrada: 10000, parcelas: 24, taxaMensal: 0.015, sistema: "price" },
      novoId,
    );
    expect(s.alteracoes).toHaveLength(2);
    const fin = calcular(s);
    expect(fin.saldo[2]).toBeCloseTo(base.saldo[2]! - 10000);
    expect(fin.saldoDevedor[2]).toBeCloseTo(base.saldoDevedor[2]!); // ainda não começou a pagar
    expect(fin.saldo[3]).toBeLessThan(base.saldo[3]!);
    const jurosDoCarro = fin.resumo.jurosTotais - base.resumo.jurosTotais;
    expect(jurosDoCarro).toBeGreaterThan(0);
    expect(vista.resumo.patrimonioFinal - fin.resumo.patrimonioFinal).toBeCloseTo(jurosDoCarro, 2);
  });
});

describe("mudança de valor e novo item", () => {
  it("muda o valor a partir de um mês, com ou sem fim", () => {
    const r = calcular(simularMudancaDeValor(plano, { objetoId: "sal", novoValor: 12000, aPartirDe: 3 }, novoId));
    expect(r.entradas[2]).toBe(10000);
    expect(r.entradas[3]).toBe(12000);
    expect(r.entradas[23]).toBe(12000);
    const temporario = calcular(simularMudancaDeValor(plano, { objetoId: "gas", novoValor: 0, aPartirDe: 5, ate: 6 }, novoId));
    expect(temporario.totaisPorBloco.fixo[4]).toBe(6000);
    expect(temporario.totaisPorBloco.fixo[6]).toBe(0);
    expect(temporario.totaisPorBloco.fixo[7]).toBe(6000);
  });

  it("inclui gasto ou receita nova", () => {
    const s = simularNovoItem(plano, { nome: "Escola", bloco: "fixo", valor: 1500, aPartirDe: 4, ate: 15 }, novoId);
    expect(s.descricao).toContain("Novo gasto: Escola");
    const r = calcular(s);
    expect(r.totaisPorBloco.fixo[3]).toBe(6000);
    expect(r.totaisPorBloco.fixo[4]).toBe(7500);
    expect(r.totaisPorBloco.fixo[16]).toBe(6000);
  });
});

describe("amortização e quitação de dívida", () => {
  it("quitar tudo encerra a dívida no mês e economiza juros", () => {
    const mes = 6;
    const extra = valorParaQuitar(plano, "con", mes);
    expect(extra).toBeLessThan(saldoDevedorNoMes(plano, "con", mes));
    const efeito = efeitoAmortizacao(plano, "con", mes, extra)!;
    expect(efeito.quitacaoAntes).toBe(35);
    expect(efeito.quitacaoDepois).toBe(mes);
    expect(efeito.parcelasEliminadas).toBe(29);
    expect(efeito.jurosEconomizados).toBeGreaterThan(0);

    const s = simularAmortizacao(plano, { objetoId: "con", mes, valor: 999999, usarFundo: true }, novoId)!;
    expect(s.descricao).toContain("Quitação antecipada");
    const r = calcular(s);
    expect(r.saldoDevedor[mes]).toBe(0);
    expect(r.efetivo.con![mes + 1]).toBe(0);
    expect(r.fundo[mes]).toBeCloseTo(base.fundo[mes]! - extra);
    expect(r.resumo.patrimonioFinal - base.resumo.patrimonioFinal).toBeGreaterThan(0);
  });

  it("amortização parcial reduz o prazo", () => {
    const s = simularAmortizacao(plano, { objetoId: "con", mes: 3, valor: 3000 }, novoId)!;
    expect(s.descricao).toContain("Amortização extra");
    const efeito = efeitoAmortizacao(plano, "con", 3, 3000)!;
    expect(efeito.quitacaoDepois!).toBeLessThan(efeito.quitacaoAntes!);
    expect(simularAmortizacao(plano, { objetoId: "sal", mes: 3, valor: 1 }, novoId)).toBeNull();
  });

  it("situação das dívidas a partir de um mês", () => {
    const [con] = situacaoDasDividas(plano, 0);
    expect(con).toMatchObject({ objetoId: "con", saldoDevedor: 12000, mesQuitacao: 35 });
    expect(con!.parcela).toBeCloseTo(470.79, 2); // PMT(2%, 36, 12.000)
    expect(con!.jurosRestantes).toBeCloseTo(con!.parcela * 36 - 12000, 0);
  });
});

describe("aplicar cenário ao plano", () => {
  it("as alterações entram na base, o cenário sai da lista e fica no histórico", () => {
    const s = simularNovoItem(plano, { nome: "Academia", bloco: "variavel", valor: 150, aPartirDe: 0 }, novoId);
    const c = { ...cenario(s), id: "c1", nome: "Academia" };
    const comCenario: Plano = { ...plano, cenarios: [c] };
    const aplicado = aplicarCenarioAoPlano(comCenario, "c1", "2026-10-27");
    expect(aplicado.objetos.some((o) => o.nome === "Academia")).toBe(true);
    expect(aplicado.cenarios).toEqual([]);
    expect(aplicado.cenariosAplicados).toEqual([{ id: "c1", nome: "Academia", data: "2026-10-27", simulacoes: [s.descricao] }]);
    expect(aplicarCenarioAoPlano(comCenario, "inexistente", "2026-10-27")).toBe(comCenario);
  });
});
