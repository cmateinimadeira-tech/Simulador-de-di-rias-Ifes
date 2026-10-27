import { describe, expect, it } from "vitest";
import { lerValor, moedaCurta, valorCelula } from "@/componentes/formato";

describe("leitura de valores digitados", () => {
  it("entende o formato brasileiro", () => {
    expect(lerValor("5.000")).toBe(5000);
    expect(lerValor("1.234.567")).toBe(1234567);
    expect(lerValor("1.234,56")).toBe(1234.56);
    expect(lerValor("320,50")).toBe(320.5);
    expect(lerValor("R$ 2.500,00")).toBe(2500);
    expect(lerValor("-50")).toBe(-50);
  });

  it("aceita ponto decimal quando não é separador de milhar", () => {
    expect(lerValor("1234.56")).toBe(1234.56);
    expect(lerValor("0.5")).toBe(0.5);
    expect(lerValor("12.5")).toBe(12.5);
  });

  it("vazio ou texto inválido", () => {
    expect(lerValor("")).toBeNull();
    expect(lerValor("  ")).toBeNull();
    expect(lerValor("abc")).toBeNull();
  });
});

describe("formatação", () => {
  it("células e valores curtos", () => {
    expect(valorCelula(0.2)).toBe("");
    expect(valorCelula(1234.6)).toBe("1.235");
    expect(moedaCurta(342829)).toBe("R$ 343 mil");
    expect(moedaCurta(-1500)).toBe("−R$ 1.500");
  });
});
