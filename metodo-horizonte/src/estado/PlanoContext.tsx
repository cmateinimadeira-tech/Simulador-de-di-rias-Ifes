"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { calcularPlano, indiceDoAnoMes } from "@/motor";
import type { Plano, ResultadoPlano } from "@/motor";

// No MVP-R1 o plano fica no navegador. O backend (banco com isolamento por plano) entra no R2.
const CHAVE = "metodo-horizonte:plano:v1";

interface ContextoPlano {
  carregado: boolean;
  plano: Plano | null;
  resultado: ResultadoPlano | null;
  /** Índice do mês corrente dentro do horizonte (0 se hoje estiver fora dele). */
  mesAtual: number;
  salvar: (plano: Plano) => void;
  atualizar: (alterar: (plano: Plano) => Plano) => void;
  descartar: () => void;
}

const Contexto = createContext<ContextoPlano | null>(null);

function lerArmazenado(): Plano | null {
  try {
    const texto = window.localStorage.getItem(CHAVE);
    return texto ? (JSON.parse(texto) as Plano) : null;
  } catch {
    return null;
  }
}

function gravar(plano: Plano | null) {
  try {
    if (plano) window.localStorage.setItem(CHAVE, JSON.stringify(plano));
    else window.localStorage.removeItem(CHAVE);
  } catch {
    // Navegação privada ou armazenamento cheio: o plano segue na memória até fechar a aba.
  }
}

export function hojeAnoMes() {
  const agora = new Date();
  return { ano: agora.getFullYear(), mes: agora.getMonth() + 1 };
}

export function PlanoProvider({ children }: { children: ReactNode }) {
  const [plano, setPlano] = useState<Plano | null>(null);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    setPlano(lerArmazenado());
    setCarregado(true);
  }, []);

  const salvar = useCallback((novo: Plano) => {
    setPlano(novo);
    gravar(novo);
  }, []);

  const atualizar = useCallback((alterar: (plano: Plano) => Plano) => {
    setPlano((atual) => {
      if (!atual) return atual;
      const novo = alterar(atual);
      gravar(novo);
      return novo;
    });
  }, []);

  const descartar = useCallback(() => {
    setPlano(null);
    gravar(null);
  }, []);

  const mesAtual = useMemo(() => {
    if (!plano) return 0;
    const m = indiceDoAnoMes(plano.inicio, hojeAnoMes());
    return m >= 0 && m < plano.horizonte ? m : 0;
  }, [plano]);

  const resultado = useMemo(() => (plano ? calcularPlano(plano, { mesReferencia: mesAtual }) : null), [plano, mesAtual]);

  const valor = useMemo(
    () => ({ carregado, plano, resultado, mesAtual, salvar, atualizar, descartar }),
    [carregado, plano, resultado, mesAtual, salvar, atualizar, descartar],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function usePlano(): ContextoPlano {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("usePlano precisa estar dentro de <PlanoProvider>.");
  return ctx;
}
