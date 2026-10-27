import { calcularPlano } from "./calculo";
import type { OpcoesCalculo, ResultadoPlano, ResumoPlano } from "./calculo";
import type { Cenario, Objeto, Plano } from "./tipos";

/** Aplica as alterações do cenário sobre uma cópia do plano. O plano original não muda. */
export function aplicarCenario(plano: Plano, cenario: Cenario): Plano {
  let objetos: Objeto[] = plano.objetos.map((o) => ({ ...o, ajustes: { ...o.ajustes } }));

  const alteracoes = [...cenario.alteracoes, ...(cenario.simulacoes ?? []).flatMap((s) => s.alteracoes)];
  for (const alteracao of alteracoes) {
    switch (alteracao.tipo) {
      case "incluirObjeto":
        objetos.push(structuredClone(alteracao.objeto));
        break;
      case "removerObjeto":
        objetos = objetos.filter((o) => o.id !== alteracao.objetoId);
        break;
      case "alterarObjeto":
        objetos = objetos.map((o) => {
          if (o.id !== alteracao.objetoId) return o;
          const alterado: Objeto = { ...o };
          if (alteracao.regra) alterado.regra = structuredClone(alteracao.regra);
          if (alteracao.nome !== undefined) alterado.nome = alteracao.nome;
          if (alteracao.funcao === null) delete alterado.funcao;
          else if (alteracao.funcao !== undefined) alterado.funcao = alteracao.funcao;
          return alterado;
        });
        break;
      case "ajustarValor":
        objetos = objetos.map((o) => {
          if (o.id !== alteracao.objetoId) return o;
          const ajustes = { ...o.ajustes };
          if (alteracao.valor === null) delete ajustes[alteracao.mes];
          else ajustes[alteracao.mes] = alteracao.valor;
          return { ...o, ajustes };
        });
        break;
    }
  }

  return {
    ...plano,
    taxaFundoMensal: cenario.taxaFundoMensal ?? plano.taxaFundoMensal,
    objetos,
  };
}

export interface ComparacaoCenario {
  id: string;
  nome: string;
  resumo: ResumoPlano;
  patrimonio: number[];
  acumulado: number[];
  resultado: ResultadoPlano;
}

/** Calcula a base e cada cenário, para comparação lado a lado. */
export function compararCenarios(plano: Plano, cenarios: Cenario[], opcoes?: OpcoesCalculo): ComparacaoCenario[] {
  const linha = (id: string, nome: string, p: Plano): ComparacaoCenario => {
    const resultado = calcularPlano(p, opcoes);
    return { id, nome, resumo: resultado.resumo, patrimonio: resultado.patrimonio, acumulado: resultado.acumulado, resultado };
  };
  return [linha("base", "Plano atual", plano), ...cenarios.map((c) => linha(c.id, c.nome, aplicarCenario(plano, c)))];
}

/**
 * Incorpora o cenário ao plano: as alterações passam a valer na base, o cenário sai
 * da lista e fica registrado no histórico de cenários aplicados.
 */
export function aplicarCenarioAoPlano(plano: Plano, cenarioId: string, data: string): Plano {
  const cenario = plano.cenarios?.find((c) => c.id === cenarioId);
  if (!cenario) return plano;
  const aplicado = aplicarCenario(plano, cenario);
  return {
    ...aplicado,
    cenarios: (plano.cenarios ?? []).filter((c) => c.id !== cenarioId),
    cenariosAplicados: [
      ...(plano.cenariosAplicados ?? []),
      { id: cenario.id, nome: cenario.nome, data, simulacoes: (cenario.simulacoes ?? []).map((s) => s.descricao) },
    ],
  };
}
