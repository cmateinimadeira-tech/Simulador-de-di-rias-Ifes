import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { detectarRegra } from "@/importador/detectarRegra";
import { linhasDaFormula } from "@/importador/planilha";
import { importarXlsx } from "@/importador/xlsx";

const MESES = ["setembro", "outubro", "novembro", "dezembro", "janeiro", "fevereiro"];
const col = (m: number) => String.fromCharCode(66 + m); // B, C, ...

/**
 * Planilha-modelo sintética, no formato do método, com as armadilhas da planilha real:
 * subtotal com valor digitado na fórmula, linha fora da soma do bloco e Reserva nas entradas.
 */
async function planilhaModelo(): Promise<ArrayBuffer> {
  const livro = new ExcelJS.Workbook();
  const aba = livro.addWorksheet("Planejamento e Controle");
  const n = MESES.length;
  const linhas: Record<number, number[]> = {
    3: [2000, 2000, 2000, 2000, 2000, 2000], // Aluguel
    4: [1000, 990, 980, 970, 960, 950], // Financiamento
    6: [0, 0, 0, 0, 1500, 0], // IPVA
    8: [800, 900, 800, 900, 800, 900], // Mercado
    10: [150, 150, 150, 0, 0, 0], // Celular parcelado
    11: [0, 999, 0, 0, 0, 0], // Fora da soma
    13: [400, 400, 400, 400, 400, 400], // Gasolina
    15: [1000, 1000, 1000, 1000, 1000, 1000], // Fundo
    17: [6000, 6000, 6000, 6000, 6000, 6000], // Entradas (renda)
    18: [500, 0, 0, 0, 0, 0], // Reserva
    19: [0, 0, 300, 0, 0, 0], // Entrada possível
  };
  const nomes: Record<number, string> = {
    1: "Objetos",
    2: "Fixo mensal",
    3: "Aluguel",
    4: "Financiamento",
    5: "Despesas anuais",
    6: "IPVA",
    7: "Variável mensal",
    8: "Mercado",
    9: "Cartão parcelado",
    10: "Celular",
    11: "Compra fora da soma",
    12: "Cartão à vista",
    13: "Gasolina",
    14: "Planejamento",
    15: "Fundo",
    16: "Despesas",
    17: "Entradas",
    18: "Reserva",
    19: "Entrada possível",
    20: "Saldo",
    21: "Acumulado",
    22: "Fundo",
  };
  for (const [l, nome] of Object.entries(nomes)) aba.getCell(`A${l}`).value = nome;
  MESES.forEach((mes, m) => (aba.getCell(`${col(m)}1`).value = mes));
  for (const [l, valores] of Object.entries(linhas)) {
    valores.forEach((v, m) => {
      if (v !== 0) aba.getCell(`${col(m)}${l}`).value = v;
    });
  }
  const v = (l: number, m: number) => linhas[l]?.[m] ?? 0;
  const subtotais: [number, number[], number][] = [
    [2, [3, 4], 0],
    [5, [6], 0],
    [7, [8], 0],
    [9, [10], 0], // a linha 11 fica fora da soma
    [12, [13], 0],
    [14, [15], -50], // ajuste digitado na fórmula
  ];
  let acumulado = 0;
  let fundo = 0;
  for (let m = 0; m < n; m++) {
    const c = col(m);
    let despesas = 0;
    for (const [l, membros, ajuste] of subtotais) {
      const ajusteMes = m === 0 ? ajuste : 0;
      const result = membros.reduce((s, x) => s + v(x, m), 0) + ajusteMes;
      const intervalo = `SUM(${c}${membros[0]}:${c}${membros.at(-1)})`;
      aba.getCell(`${c}${l}`).value = { formula: ajusteMes ? `${intervalo}${ajusteMes}` : intervalo, result };
      despesas += result;
    }
    aba.getCell(`${c}16`).value = { formula: `${c}2+${c}5+${c}7+${c}9+${c}12+${c}14`, result: despesas };
    const saldo = v(17, m) + v(18, m) + v(19, m) - despesas;
    aba.getCell(`${c}20`).value = { formula: `(${c}17+${c}18+${c}19)-${c}16`, result: saldo };
    acumulado += saldo;
    fundo += v(15, m);
    aba.getCell(`${c}21`).value = { formula: m === 0 ? `${c}20` : `${col(m - 1)}21+${c}20`, result: acumulado };
    aba.getCell(`${c}22`).value = { formula: m === 0 ? `${c}15` : `${col(m - 1)}22+${c}15`, result: fundo };
  }
  return (await livro.xlsx.writeBuffer()) as ArrayBuffer;
}

describe("detecção de regra", () => {
  const inicio = { ano: 2025, mes: 9 };
  it("reconhece fixo, decrescente, único, anual e manual", () => {
    expect(detectarRegra([0, 5, 5, 5], inicio)).toEqual({ tipo: "fixo", valor: 5, inicio: 1 });
    expect(detectarRegra([5, 5, 0, 0], inicio)).toEqual({ tipo: "fixo", valor: 5, inicio: 0, fim: 1 });
    expect(detectarRegra([100, 93, 86, 79], inicio)).toEqual({ tipo: "decrescente", valorInicial: 100, reducaoMensal: 7, inicio: 0 });
    expect(detectarRegra([0, 0, 42, 0], inicio)).toEqual({ tipo: "unico", valor: 42, mes: 2 });
    // janeiro = índice 4 e 16
    const anual = new Array(20).fill(0);
    anual[4] = 900;
    anual[16] = 900;
    expect(detectarRegra(anual, inicio)).toMatchObject({ tipo: "anual", valor: 900, mesesDoAno: [1] });
    expect(detectarRegra([1, 2, 1, 5], inicio).tipo).toBe("manual");
    expect(detectarRegra([0, 0], inicio)).toEqual({ tipo: "manual", valores: {} });
  });

  it("lê as linhas citadas por uma fórmula", () => {
    expect([...linhasDaFormula("SUM(H3:H9)-2265")]).toEqual([3, 4, 5, 6, 7, 8, 9]);
    expect([...linhasDaFormula("(H38+H39+H45)-H37")].sort()).toEqual([37, 38, 39, 45]);
    expect([...linhasDaFormula("'Outra aba'!AC2")]).toEqual([]);
  });
});

describe("importação da planilha-modelo", () => {
  it("reproduz Saldo, Acumulado e Fundo da planilha sem divergências", async () => {
    const { plano, relatorio } = await importarXlsx(await planilhaModelo(), { anoInicial: 2025, reservaSaiDoFundo: false });

    expect(relatorio.inicio).toEqual({ ano: 2025, mes: 9 });
    expect(relatorio.horizonte).toBe(6);
    expect(relatorio.conferidas).toEqual(["saldo", "acumulado", "fundo"]);
    expect(relatorio.divergencias).toEqual([]);

    const porNome = (nome: string) => plano.objetos.find((o) => o.nome === nome);
    expect(porNome("Aluguel")?.regra).toEqual({ tipo: "fixo", valor: 2000, inicio: 0 });
    expect(porNome("Financiamento")?.regra.tipo).toBe("decrescente");
    expect(porNome("IPVA")?.regra).toEqual({ tipo: "unico", valor: 1500, mes: 4 });
    expect(porNome("Mercado")?.regra.tipo).toBe("manual");
    expect(porNome("Fundo")?.funcao).toBe("aporteFundo");
    expect(porNome("Renda principal")?.bloco).toBe("entradas");
    expect(porNome("Entrada possível")?.funcao).toBe("entradaPossivel");
    expect(porNome("Reserva")?.funcao).toBeUndefined();
    expect(relatorio.objetosPorBloco.entradas).toBe(3);

    // Linha fora da soma: importada sem valores, com aviso.
    expect(porNome("Compra fora da soma")?.regra).toEqual({ tipo: "manual", valores: {} });
    expect(relatorio.avisos.some((a) => a.includes("Compra fora da soma"))).toBe(true);

    // Subtotal com valor digitado: vira linha de ajuste visível.
    const ajuste = porNome("Ajuste da planilha (Planejamento)");
    expect(ajuste?.regra).toEqual({ tipo: "manual", valores: { 0: -50 } });
    expect(relatorio.avisos.some((a) => a.includes("Ajuste da planilha (Planejamento)"))).toBe(true);
  });

  it("com a Reserva saindo do Fundo, só a linha Fundo diverge", async () => {
    const { plano, relatorio } = await importarXlsx(await planilhaModelo(), { anoInicial: 2025, reservaSaiDoFundo: true });
    expect(plano.objetos.find((o) => o.nome === "Reserva")?.funcao).toBe("resgateFundo");
    expect(relatorio.divergencias.length).toBeGreaterThan(0);
    expect(relatorio.divergencias.every((d) => d.linha === "fundo")).toBe(true);
    expect(relatorio.finalSistema.fundo).toBe(6000 - 500);
  });

  it("recusa um arquivo sem os meses na linha 1", async () => {
    const livro = new ExcelJS.Workbook();
    livro.addWorksheet("Outra").getCell("A1").value = "Qualquer coisa";
    const dados = (await livro.xlsx.writeBuffer()) as ArrayBuffer;
    await expect(importarXlsx(dados, { anoInicial: 2025, reservaSaiDoFundo: false })).rejects.toThrow(/meses/);
  });
});
