import { describe, expect, it } from "vitest";
import {
  adicionarLancamento,
  calcularPlano,
  congelarMes,
  definirSituacao,
  diasDesdeUltimaRevisao,
  garantirLinhaDeBase,
  registrarRevisao,
  resumoDoMes,
  revisoesDoMes,
  valorVigente,
} from "@/motor";
import type { Objeto, Plano } from "@/motor";

const salario: Objeto = { id: "sal", bloco: "entradas", nome: "Salário", regra: { tipo: "fixo", valor: 10000, inicio: 0 } };
const alimentacao: Objeto = { id: "ali", bloco: "variavel", nome: "Alimentação", regra: { tipo: "fixo", valor: 300, inicio: 0 } };
const fds: Objeto = { id: "fds", bloco: "variavel", nome: "Fim de semana", regra: { tipo: "fixo", valor: 400, inicio: 0 } };

function plano(extra: Partial<Plano> = {}): Plano {
  return {
    id: "p",
    nome: "Teste",
    inicio: { ano: 2026, mes: 10 },
    horizonte: 6,
    saldoInicialConta: 0,
    saldoInicialFundo: 0,
    taxaFundoMensal: 0,
    objetos: [salario, alimentacao, fds],
    ...extra,
  };
}

const pagar = (p: Plano, objetoId: string, valor: number, data = "2026-10-05") =>
  adicionarLancamento(p, { id: `${objetoId}-${data}-${valor}`, objetoId, data, valor });

describe("valor vigente", () => {
  it("segue as regras do acompanhamento", () => {
    expect(valorVigente(300, null, undefined, false)).toEqual({ vigente: 300, aPagar: 300 });
    expect(valorVigente(300, 120, undefined, false)).toEqual({ vigente: 300, aPagar: 180 }); // parcial
    expect(valorVigente(300, 400, undefined, false)).toEqual({ vigente: 400, aPagar: 0 }); // passou do previsto
    expect(valorVigente(300, 250, { situacao: "quitado" }, false)).toEqual({ vigente: 250, aPagar: 0 }); // sobrou 50
    expect(valorVigente(300, 120, { situacao: "restante", valor: 250 }, false)).toEqual({ vigente: 370, aPagar: 250 });
    expect(valorVigente(300, null, { situacao: "quitado" }, false)).toEqual({ vigente: 0, aPagar: 0 }); // não vai ter
    expect(valorVigente(300, 120, undefined, true)).toEqual({ vigente: 120, aPagar: 0 }); // mês fechado
    expect(valorVigente(-2265, null, undefined, false)).toEqual({ vigente: -2265, aPagar: -2265 }); // ajuste negativo intocado
  });
});

describe("retrato em tempo real", () => {
  it("pagamentos semanais alteram o saldo vigente sem mexer no previsto", () => {
    let p = plano();
    p = pagar(p, "ali", 120, "2026-10-05"); // semana 1
    p = pagar(p, "fds", 150, "2026-10-12"); // semana 2
    let r = calcularPlano(p);
    expect(r.saldoPrevisto[0]).toBe(9300);
    expect(r.saldo[0]).toBe(9300); // nada passou do previsto: o retrato ainda é o previsto
    expect(r.aPagar.ali![0]).toBe(180);

    p = definirSituacao(p, "ali", 0, { situacao: "quitado" }); // gastou só 120 com alimentação
    p = pagar(p, "fds", 400, "2026-10-19"); // estourou o fim de semana: 550 de 400
    r = calcularPlano(p);
    expect(r.saldo[0]).toBe(10000 - 120 - 550);
    expect(r.saldoPrevisto[0]).toBe(9300);
    expect(r.acumulado[5]).toBe(r.saldo[0]! + 5 * 9300); // meses seguintes seguem o previsto
    expect(r.alertas.some((a) => a.tipo === "desvioObjeto" && a.objetoId === "fds" && a.mes === 0)).toBe(true);

    const resumo = resumoDoMes(p, r, 0);
    expect(resumo).toMatchObject({ despesasPrevistas: 700, despesasPagas: 670, despesasAPagar: 0, entradasAReceber: 10000 });
  });

  it("restante ajustado substitui a diferença automática e pode ser desfeito", () => {
    let p = pagar(plano(), "ali", 120);
    p = definirSituacao(p, "ali", 0, { situacao: "restante", valor: 250 });
    expect(calcularPlano(p).efetivo.ali![0]).toBe(370);
    p = definirSituacao(p, "ali", 0, null);
    expect(calcularPlano(p).efetivo.ali![0]).toBe(300);
  });
});

describe("linha de base (previsto original)", () => {
  it("congela os meses até o atual e preserva o original quando o previsto muda", () => {
    let p = garantirLinhaDeBase(plano(), 1, "2026-10-01");
    expect(Object.keys(p.linhaDeBase ?? {})).toEqual(["0", "1"]);
    expect(garantirLinhaDeBase(p, 1, "2026-10-02")).toBe(p); // nada a fazer: mesmo objeto

    // O previsto do mês é alterado na grade (ajuste manual) e um objeto novo aparece.
    p = { ...p, objetos: p.objetos.map((o) => (o.id === "ali" ? { ...o, ajustes: { 0: 500 } } : o)) };
    p = { ...p, objetos: [...p.objetos, { id: "pre", bloco: "variavel", nome: "Presente", regra: { tipo: "unico", valor: 200, mes: 0 } }] };
    const r = calcularPlano(p);
    expect(r.planejado.ali![0]).toBe(500);
    expect(r.original.ali![0]).toBe(300);
    expect(r.original.pre![0]).toBe(0);
    expect(r.original.ali![2]).toBeNull(); // mês ainda não congelado
    expect(r.saldoOriginal[0]).toBe(9300);
    expect(r.saldoPrevisto[0]).toBe(10000 - 500 - 400 - 200);
    expect(r.saldoOriginal[2]).toBeNull();

    const redefinido = calcularPlano(congelarMes(p, 0, "2026-10-15"));
    expect(redefinido.original.ali![0]).toBe(500);
    expect(redefinido.saldoOriginal[0]).toBe(redefinido.saldoPrevisto[0]);
  });
});

describe("revisões semanais", () => {
  it("registram o retrato do mês com data e formam o histórico", () => {
    let p = garantirLinhaDeBase(plano(), 0, "2026-10-01");
    p = registrarRevisao(p, calcularPlano(p), 0, "2026-10-07", "r1", "Semana 1");
    p = pagar(p, "fds", 550, "2026-10-12");
    p = registrarRevisao(p, calcularPlano(p), 0, "2026-10-14", "r2", "  ");

    const historico = revisoesDoMes(p, 0);
    expect(historico.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(historico[0]).toMatchObject({ saldoVigente: 9300, saldoOriginal: 9300, despesasPagas: 0, despesasAPagar: 700, nota: "Semana 1" });
    expect(historico[1]).toMatchObject({ saldoVigente: 9150, despesasPagas: 550, despesasAPagar: 300 });
    expect(historico[1]!.nota).toBeUndefined();
    expect(historico[1]!.patrimonioFinal).toBe(historico[0]!.patrimonioFinal - 150);
    expect(diasDesdeUltimaRevisao(p, "2026-10-21")).toBe(7);
    expect(diasDesdeUltimaRevisao(plano(), "2026-10-21")).toBeNull();
  });
});
