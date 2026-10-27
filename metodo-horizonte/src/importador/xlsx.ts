import type { Workbook, Worksheet, CellValue } from "exceljs";
import { importarDeGrade } from "./planilha";
import type { CelulaLida, GradeLida, OpcoesImportacao, ResultadoImportacao } from "./planilha";

type ValorFormula = { formula?: string; sharedFormula?: string; result?: unknown };

function ehObjeto(v: CellValue): v is Exclude<CellValue, null | number | string | boolean | Date | undefined> {
  return typeof v === "object" && v !== null && !(v instanceof Date);
}

function textoDe(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "object" && v !== null && "richText" in v) {
    return (v as { richText: { text: string }[] }).richText.map((t) => t.text).join("");
  }
  return null;
}

function lerCelula(aba: Worksheet, linha: number, coluna: number): CelulaLida {
  const valor = aba.getRow(linha).getCell(coluna).value;
  const leitura: CelulaLida = { numero: null, texto: null, formula: null, erro: null };
  if (valor === null || valor === undefined) return leitura;

  if (typeof valor === "number") {
    leitura.numero = valor;
    leitura.texto = String(valor);
    return leitura;
  }
  if (!ehObjeto(valor)) {
    leitura.texto = textoDe(valor);
    const n = typeof valor === "string" ? Number(valor.replace(",", ".")) : NaN;
    if (valor !== "" && Number.isFinite(n)) leitura.numero = n;
    return leitura;
  }
  if ("error" in valor) {
    leitura.erro = String((valor as { error: unknown }).error);
    return leitura;
  }
  if ("formula" in valor || "sharedFormula" in valor) {
    const f = valor as ValorFormula;
    if (f.formula) {
      leitura.formula = f.formula;
    } else if (f.sharedFormula) {
      // Fórmula compartilhada: as linhas citadas são as da célula mestre.
      const mestre = aba.getCell(f.sharedFormula).value as ValorFormula | null;
      leitura.formula = mestre?.formula ?? null;
    }
    const r = f.result;
    // O ExcelJS descarta o resultado em cache quando ele é 0 (<v>0</v>).
    if (r === undefined) leitura.numero = 0;
    else if (typeof r === "number") leitura.numero = r;
    else if (typeof r === "object" && r !== null && "error" in r) leitura.erro = String((r as { error: unknown }).error);
    else leitura.texto = textoDe(r);
    return leitura;
  }
  leitura.texto = textoDe(valor);
  return leitura;
}

export function gradeDaAba(aba: Worksheet): GradeLida {
  return {
    nome: aba.name,
    linhas: aba.rowCount,
    colunas: aba.columnCount,
    celula: (linha, coluna) => lerCelula(aba, linha, coluna),
  };
}

/** A aba principal é a primeira visível. */
export function abaPrincipal(livro: Workbook): Worksheet {
  const aba = livro.worksheets.find((a) => a.state === "visible") ?? livro.worksheets[0];
  if (!aba) throw new Error("A planilha não tem abas.");
  return aba;
}

export async function importarXlsx(dados: ArrayBuffer, opcoes: OpcoesImportacao): Promise<ResultadoImportacao> {
  const ExcelJS = (await import("exceljs")).default;
  const livro = new ExcelJS.Workbook();
  await livro.xlsx.load(dados);
  return importarDeGrade(gradeDaAba(abaPrincipal(livro)), opcoes);
}
