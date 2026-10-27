"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { calcularPlano, garantirLinhaDeBase, indiceDoAnoMes } from "@/motor";
import type { Plano, ResultadoPlano } from "@/motor";
import { armazenamentoLocal } from "./armazenamento";

const armazenamento = armazenamentoLocal;

interface ContextoPlano {
  carregado: boolean;
  plano: Plano | null;
  resultado: ResultadoPlano | null;
  /** Índice do mês corrente, limitado ao horizonte. */
  mesAtual: number;
  salvar: (plano: Plano) => void;
  atualizar: (alterar: (plano: Plano) => Plano) => void;
  descartar: () => void;
}

const Contexto = createContext<ContextoPlano | null>(null);

export function hojeAnoMes() {
  const agora = new Date();
  return { ano: agora.getFullYear(), mes: agora.getMonth() + 1 };
}

/** Data de hoje no formato "AAAA-MM-DD", no fuso do aparelho. */
export function hojeISO() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}

export function PlanoProvider({ children }: { children: ReactNode }) {
  const [plano, setPlano] = useState<Plano | null>(null);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    setPlano(armazenamento.carregar());
    setCarregado(true);
  }, []);

  const salvar = useCallback((novo: Plano) => {
    setPlano(novo);
    armazenamento.gravar(novo);
  }, []);

  const atualizar = useCallback((alterar: (plano: Plano) => Plano) => {
    setPlano((atual) => {
      if (!atual) return atual;
      const novo = alterar(atual);
      armazenamento.gravar(novo);
      return novo;
    });
  }, []);

  const descartar = useCallback(() => {
    setPlano(null);
    armazenamento.gravar(null);
  }, []);

  const mesAtual = useMemo(() => {
    if (!plano) return 0;
    const m = indiceDoAnoMes(plano.inicio, hojeAnoMes());
    return Math.min(Math.max(m, 0), plano.horizonte - 1);
  }, [plano]);

  // Congela o previsto original dos meses que já começaram: o histórico do que estava planejado.
  useEffect(() => {
    if (!plano) return;
    const comBase = garantirLinhaDeBase(plano, mesAtual, hojeISO());
    if (comBase !== plano) salvar(comBase);
  }, [plano, mesAtual, salvar]);

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
