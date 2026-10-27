import { describe, expect, it } from "vitest";
import {
  adicionarLancamento,
  calcularPlano,
  fecharMes,
  lancamentosDoMes,
  lerData,
  mesCompetencia,
  mesDaFatura,
  mesesSemFechamento,
  reabrirMes,
  realizadoPorObjeto,
  removerLancamento,
} from "@/motor";
import type { Cartao, Plano } from "@/motor";

// Cartão que fecha no dia 5 e vence no dia 12 (mesmo mês do fechamento).
const nubank: Cartao = { id: "c1", nome: "Cartão A", diaFechamento: 5, diaVencimento: 12 };
// Cartão que fecha no dia 28 e vence no dia 5 (mês seguinte ao fechamento).
const caixa: Cartao = { id: "c2", nome: "Cartão B", diaFechamento: 28, diaVencimento: 5 };

function plano(extra: Partial<Plano> = {}): Plano {
  return {
    id: "p",
    nome: "Teste",
    inicio: { ano: 2026, mes: 10 }, // out/26 = índice 0
    horizonte: 12,
    saldoInicialConta: 0,
    saldoInicialFundo: 0,
    taxaFundoMensal: 0,
    cartoes: [nubank, caixa],
    objetos: [
      { id: "sal", bloco: "entradas", nome: "Salário", regra: { tipo: "fixo", valor: 10000, inicio: 0 } },
      { id: "mer", bloco: "cartaoAVista", nome: "Mercado", regra: { tipo: "fixo", valor: 1000, inicio: 0 } },
    ],
    ...extra,
  };
}

describe("datas e faturas", () => {
  it("lê datas válidas e recusa as inválidas", () => {
    expect(lerData("2026-10-27")).toEqual({ ano: 2026, mes: 10, dia: 27 });
    expect(lerData("27/10/2026")).toBeNull();
    expect(lerData("2026-13-01")).toBeNull();
  });

  it("compra antes do fechamento vence na fatura do mês; no dia do fechamento, na seguinte", () => {
    expect(mesDaFatura(nubank, { ano: 2026, mes: 10, dia: 3 })).toEqual({ ano: 2026, mes: 10 });
    expect(mesDaFatura(nubank, { ano: 2026, mes: 10, dia: 5 })).toEqual({ ano: 2026, mes: 11 });
  });

  it("vencimento menor que o fechamento empurra a fatura para o mês seguinte, inclusive na virada do ano", () => {
    expect(mesDaFatura(caixa, { ano: 2026, mes: 10, dia: 10 })).toEqual({ ano: 2026, mes: 11 });
    expect(mesDaFatura(caixa, { ano: 2026, mes: 11, dia: 30 })).toEqual({ ano: 2027, mes: 1 });
  });
});

describe("competência", () => {
  it("sem cartão, vale o mês da data; com cartão, o mês da fatura", () => {
    const p = plano();
    expect(mesCompetencia(p, { id: "l", objetoId: "mer", data: "2026-10-20", valor: 50 })).toBe(0);
    expect(mesCompetencia(p, { id: "l", objetoId: "mer", data: "2026-10-20", valor: 50, cartaoId: "c2" })).toBe(1);
  });

  it("renda a partir do dia de corte conta para o mês seguinte; despesa não", () => {
    const p = plano({ diaCorteRenda: 25 });
    expect(mesCompetencia(p, { id: "l", objetoId: "sal", data: "2026-10-25", valor: 9000 })).toBe(1);
    expect(mesCompetencia(p, { id: "l", objetoId: "sal", data: "2026-10-24", valor: 9000 })).toBe(0);
    expect(mesCompetencia(p, { id: "l", objetoId: "mer", data: "2026-10-25", valor: 90 })).toBe(0);
  });
});

describe("realizado", () => {
  it("soma lançamentos por competência, ignora objeto excluído e mês fora do horizonte", () => {
    let p = plano({ objetos: plano().objetos.map((o) => (o.id === "mer" ? { ...o, realizado: { 0: 100 } } : o)) });
    p = adicionarLancamento(p, { id: "a", objetoId: "mer", data: "2026-10-02", valor: 300 });
    p = adicionarLancamento(p, { id: "b", objetoId: "mer", data: "2026-10-20", valor: 200, cartaoId: "c1" }); // vence em nov
    p = adicionarLancamento(p, { id: "c", objetoId: "fantasma", data: "2026-10-02", valor: 999 });
    p = adicionarLancamento(p, { id: "d", objetoId: "mer", data: "2030-01-01", valor: 999 });
    const mapa = realizadoPorObjeto(p);
    expect(mapa.mer).toEqual({ 0: 400, 1: 200 });
    expect(lancamentosDoMes(p, 1).map((l) => l.id)).toEqual(["b"]);
    expect(removerLancamento(p, "a").lancamentos).toHaveLength(3);
  });

  it("o pago entra no saldo em tempo real; ao fechar, vale o saldo real em conta", () => {
    let p = adicionarLancamento(plano(), { id: "a", objetoId: "mer", data: "2026-10-02", valor: 1500 });
    let r = calcularPlano(p);
    expect(r.realizado.mer![0]).toBe(1500);
    expect(r.realizado.mer![1]).toBeNull();
    expect(r.saldo[0]).toBe(8500); // pagou 1.500 de um previsto de 1.000

    p = fecharMes(p, 0, { saldoReal: 8400, data: "2026-10-31" });
    r = calcularPlano(p);
    expect(r.saldo[0]).toBe(8500); // salário planejado (sem lançamento) − mercado realizado
    expect(r.acumulado[0]).toBe(8400);
    expect(r.ajusteFechamento[0]).toBe(-100);
    expect(r.alertas.some((a) => a.tipo === "desvioObjeto" && a.objetoId === "mer")).toBe(true);

    p = reabrirMes(p, 0);
    expect(calcularPlano(p).acumulado[0]).toBe(8500);
  });

  it("lista meses passados sem fechamento", () => {
    const p = fecharMes(plano(), 1, { saldoReal: 0 });
    expect(mesesSemFechamento(p, 3)).toEqual([0, 2]);
    expect(mesesSemFechamento(p, 0)).toEqual([]);
  });
});
