import type { Plano } from "@/motor";

/**
 * Onde o plano fica guardado. Hoje é o navegador; o banco com isolamento por plano
 * entra como outra implementação desta interface, sem mudar as telas.
 */
export interface Armazenamento {
  carregar(): Plano | null;
  gravar(plano: Plano | null): void;
}

const CHAVE = "metodo-horizonte:plano:v1";

export const armazenamentoLocal: Armazenamento = {
  carregar() {
    try {
      const texto = window.localStorage.getItem(CHAVE);
      return texto ? validarPlano(JSON.parse(texto)) : null;
    } catch {
      return null;
    }
  },
  gravar(plano) {
    try {
      if (plano) window.localStorage.setItem(CHAVE, JSON.stringify(plano));
      else window.localStorage.removeItem(CHAVE);
    } catch {
      // Navegação privada ou armazenamento cheio: o plano segue na memória até fechar a aba.
    }
  },
};

/** Arquivo de backup: o plano inteiro, com versão do formato. */
export interface Backup {
  formato: "metodo-horizonte";
  versao: 1;
  exportadoEm: string;
  plano: Plano;
}

export function gerarBackup(plano: Plano): Backup {
  return { formato: "metodo-horizonte", versao: 1, exportadoEm: new Date().toISOString(), plano };
}

/** Confere a estrutura mínima de um plano vindo de arquivo ou do armazenamento. */
export function validarPlano(dado: unknown): Plano {
  const p = dado as Partial<Plano> | null;
  const ok =
    !!p &&
    typeof p.id === "string" &&
    typeof p.nome === "string" &&
    typeof p.horizonte === "number" &&
    p.horizonte > 0 &&
    typeof p.inicio?.ano === "number" &&
    typeof p.inicio?.mes === "number" &&
    Array.isArray(p.objetos) &&
    p.objetos.every((o) => typeof o?.id === "string" && typeof o?.bloco === "string" && typeof o?.regra?.tipo === "string");
  if (!ok) throw new Error("O arquivo não contém um plano válido do Método Horizonte.");
  return {
    saldoInicialConta: 0,
    saldoInicialFundo: 0,
    taxaFundoMensal: 0,
    ...p,
  } as Plano;
}

export function lerBackup(texto: string): Plano {
  let dado: unknown;
  try {
    dado = JSON.parse(texto);
  } catch {
    throw new Error("O arquivo não é um backup válido (JSON ilegível).");
  }
  const backup = dado as Partial<Backup>;
  if (backup?.formato !== "metodo-horizonte") throw new Error("O arquivo não é um backup do Método Horizonte.");
  return validarPlano(backup.plano);
}
