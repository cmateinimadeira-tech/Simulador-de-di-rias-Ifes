// Caso de teste obrigatório da especificação, contra a planilha real do fundador.
// A planilha tem dados pessoais e NÃO fica no repositório, nem os valores dela:
// o teste compara o sistema com a própria planilha e só roda com
//   PLANILHA_REFERENCIA=/caminho/planilha.xlsx PLANILHA_ANO_INICIAL=2025 npm test
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { gerarValores } from "@/motor";
import { importarXlsx } from "@/importador/xlsx";

const caminho = process.env.PLANILHA_REFERENCIA;
const anoInicial = Number(process.env.PLANILHA_ANO_INICIAL ?? new Date().getFullYear());

async function ler(reservaSaiDoFundo: boolean) {
  const arquivo = await readFile(caminho!);
  const dados = arquivo.buffer.slice(arquivo.byteOffset, arquivo.byteOffset + arquivo.byteLength);
  return importarXlsx(dados, { anoInicial, reservaSaiDoFundo });
}

describe.skipIf(!caminho)("planilha de referência", () => {
  it("reproduz Saldo, Acumulado e Fundo de todos os meses", async () => {
    const { plano, relatorio } = await ler(false);

    expect(relatorio.conferidas).toEqual(["saldo", "acumulado", "fundo"]);
    expect(relatorio.divergencias).toEqual([]);
    expect(relatorio.finalSistema.acumulado).toBeCloseTo(relatorio.finalPlanilha.acumulado!, 1);
    expect(relatorio.finalSistema.fundo).toBeCloseTo(relatorio.finalPlanilha.fundo!, 1);
    expect(plano.objetos.some((o) => o.regra.tipo === "decrescente")).toBe(true);
    expect(plano.objetos.some((o) => o.funcao === "aporteFundo")).toBe(true);
  });

  it("com a Reserva saindo do Fundo, o Fundo final cai pelo total resgatado", async () => {
    const { plano, relatorio } = await ler(true);
    const resgatado = plano.objetos
      .filter((o) => o.funcao === "resgateFundo")
      .reduce((total, o) => total + gerarValores(o.regra, plano).reduce((a, b) => a + b, 0), 0);

    expect(resgatado).toBeGreaterThan(0);
    expect(relatorio.finalSistema.fundo).toBeCloseTo(relatorio.finalPlanilha.fundo! - resgatado, 1);
    expect(relatorio.divergencias.every((d) => d.linha === "fundo")).toBe(true);
  });
});
