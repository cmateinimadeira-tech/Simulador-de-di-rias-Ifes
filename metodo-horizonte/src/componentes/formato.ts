const moedaFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const inteiroFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

/** R$ 1.234,56 */
export function moeda(valor: number): string {
  return moedaFmt.format(valor);
}

/** 1.235 — para células da grade. Zero vira vazio. */
export function valorCelula(valor: number): string {
  if (Math.abs(valor) < 0.5) return "";
  return inteiroFmt.format(valor);
}

/** R$ 343 mil, R$ 1,2 mi */
export function moedaCurta(valor: number): string {
  const abs = Math.abs(valor);
  const sinal = valor < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sinal}R$ ${(abs / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (abs >= 10_000) return `${sinal}R$ ${Math.round(abs / 1000).toLocaleString("pt-BR")} mil`;
  return `${sinal}R$ ${inteiroFmt.format(abs)}`;
}

/** Aceita "1.234,56", "1234,56", "5.000" (milhar), "1234.56" e "-50". Vazio devolve null. */
export function lerValor(texto: string): number | null {
  const limpo = texto.trim().replace(/\s|R\$/g, "");
  if (limpo === "") return null;
  const soMilhar = /^-?\d{1,3}(\.\d{3})+$/.test(limpo);
  const normalizado = limpo.includes(",") || soMilhar ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}

export function novoId(prefixo: string): string {
  const aleatorio = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefixo}-${aleatorio.slice(0, 8)}`;
}
