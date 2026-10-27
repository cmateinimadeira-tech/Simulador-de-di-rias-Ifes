"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import { BLOCOS, NOMES_REGRAS, gerarValores, rotuloMes } from "@/motor";
import type { Bloco, Objeto, Plano } from "@/motor";
import { EditorObjeto } from "@/componentes/EditorObjeto";
import { lerValor, novoId, valorCelula } from "@/componentes/formato";
import { usePlano } from "@/estado/PlanoContext";

interface CelulaEmEdicao {
  objetoId: string;
  mes: number;
  texto: string;
}

const ROTULO_FUNCAO = { aporteFundo: "Fundo", resgateFundo: "resgate", entradaPossivel: "possível" } as const;

/** Grava o valor digitado: em regra manual vai para a regra; nas demais vira ajuste (ou remove o ajuste). */
function gravarCelula(plano: Plano, objetoId: string, mes: number, valor: number | null): Plano {
  return {
    ...plano,
    objetos: plano.objetos.map((o) => {
      if (o.id !== objetoId) return o;
      if (o.regra.tipo === "manual") {
        const valores = { ...o.regra.valores };
        if (valor === null || valor === 0) delete valores[mes];
        else valores[mes] = valor;
        return { ...o, regra: { ...o.regra, valores } };
      }
      const ajustes = { ...o.ajustes };
      const daRegra = gerarValores(o.regra, plano)[mes] ?? 0;
      if (valor === null || Math.abs(valor - daRegra) < 0.005) delete ajustes[mes];
      else ajustes[mes] = valor;
      return { ...o, ajustes };
    }),
  };
}

export default function PaginaGrade() {
  const { carregado, plano, resultado, mesAtual, atualizar } = usePlano();
  const [recolhidos, setRecolhidos] = useState<Set<Bloco>>(new Set());
  const [editando, setEditando] = useState<CelulaEmEdicao | null>(null);
  const [aberto, setAberto] = useState<{ objeto: Objeto; novo: boolean } | null>(null);
  const colunaAtual = useRef<HTMLTableCellElement>(null);
  const rolagem = useRef<HTMLDivElement>(null);
  // Evita que o blur, disparado ao fechar o campo com Esc, grave o valor descartado.
  const cancelado = useRef(false);

  // Abre a grade com o mês atual logo depois da coluna fixa de nomes.
  useEffect(() => {
    const th = colunaAtual.current;
    const caixa = rolagem.current;
    if (!th || !caixa) return;
    const larguraNomes = caixa.querySelector("thead .col-nome")?.clientWidth ?? 0;
    caixa.scrollLeft = Math.max(0, th.offsetLeft - larguraNomes);
  }, [carregado, plano?.id]);

  if (!carregado) return <main className="conteudo secundario">Carregando…</main>;
  if (!plano || !resultado) {
    return (
      <main className="conteudo">
        <p>
          Nenhum plano aberto. <Link href="/">Crie, importe ou abra o exemplo</Link>.
        </p>
      </main>
    );
  }

  const meses = resultado.meses;
  const confirmar = () => {
    if (!editando || cancelado.current) return;
    const valor = lerValor(editando.texto);
    atualizar((p) => gravarCelula(p, editando.objetoId, editando.mes, valor));
    setEditando(null);
  };

  const alternar = (bloco: Bloco) =>
    setRecolhidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(bloco)) novo.delete(bloco);
      else novo.add(bloco);
      return novo;
    });

  const linhaFechamento = (rotulo: string, serie: number[], destaque = false) => (
    <tr className={`fechamento${destaque ? " destaque" : ""}`}>
      <td className="col-nome">
        <span style={{ display: "block", padding: "6px 10px" }}>{rotulo}</span>
      </td>
      {serie.map((v, m) => (
        <td key={m} className={`valor${m === mesAtual ? " atual" : ""}${v < -0.5 ? " negativo" : ""}`}>
          <span>{valorCelula(v) || "0"}</span>
        </td>
      ))}
    </tr>
  );

  return (
    <main className="conteudo-largo">
      <div className="acoes" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <h1 style={{ marginBottom: 0 }}>Grade de planejamento</h1>
          <span className="secundario">
            A grade mostra o previsto. Clique num valor para ajustá-lo e no nome para editar a regra. Itálico: ajuste manual; sublinhado
            pontilhado: diferente do previsto original. A linha &quot;Acompanhamento&quot; traz o efeito dos pagamentos no saldo.
          </span>
        </div>
      </div>

      <div className="grade-rolagem" ref={rolagem}>
        <table className="grade">
          <thead>
            <tr>
              <th className="col-nome" style={{ textAlign: "left" }}>
                Objeto
              </th>
              {meses.map((am, m) => (
                <th key={m} ref={m === mesAtual ? colunaAtual : undefined} className={m === mesAtual ? "atual" : undefined} scope="col">
                  {rotuloMes(am)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BLOCOS.map((bloco) => {
              const objetos = plano.objetos.filter((o) => o.bloco === bloco.id);
              const fechado = recolhidos.has(bloco.id);
              return (
                <Fragment key={bloco.id}>
                  <tr className="bloco">
                    <td className="col-nome">
                      <button className="alternar-bloco" onClick={() => alternar(bloco.id)} aria-expanded={!fechado}>
                        <span aria-hidden>{fechado ? "▸" : "▾"}</span>
                        {bloco.nome}
                        <small className="secundario">({objetos.length})</small>
                      </button>
                    </td>
                    {resultado.totaisPrevistosPorBloco[bloco.id].map((v, m) => (
                      <td key={m} className={`valor${m === mesAtual ? " atual" : ""}`}>
                        <span>{valorCelula(v)}</span>
                      </td>
                    ))}
                  </tr>
                  {!fechado &&
                    objetos.map((objeto) => {
                      const planejado = resultado.planejado[objeto.id]!;
                      return (
                        <tr key={objeto.id}>
                          <td className="col-nome">
                            <button className="nome-objeto" title={objeto.nome} onClick={() => setAberto({ objeto, novo: false })}>
                              {objeto.nome}
                              <small>
                                {NOMES_REGRAS[objeto.regra.tipo]}
                                {objeto.funcao ? ` · ${ROTULO_FUNCAO[objeto.funcao]}` : ""}
                              </small>
                            </button>
                          </td>
                          {planejado.map((v, m) => {
                            const emEdicao = editando?.objetoId === objeto.id && editando.mes === m;
                            const ajustado = objeto.ajustes?.[m] !== undefined;
                            const original = resultado.original[objeto.id]![m] ?? null;
                            const mudouOriginal = original !== null && Math.abs(original - v) > 0.5;
                            const pago = resultado.realizado[objeto.id]![m] ?? null;
                            const dica = [
                              ajustado ? "Ajuste manual: apague o valor para voltar à regra" : null,
                              mudouOriginal ? `Previsto original: ${valorCelula(original!) || "0"}` : null,
                              pago !== null ? `Pago: ${valorCelula(pago) || "0"} · falta: ${valorCelula(resultado.aPagar[objeto.id]![m]!) || "0"}` : null,
                            ]
                              .filter(Boolean)
                              .join("\n");
                            return (
                              <td key={m} className={`valor${m === mesAtual ? " atual" : ""}`}>
                                {emEdicao ? (
                                  <input
                                    className="editando"
                                    autoFocus
                                    inputMode="decimal"
                                    aria-label={`${objeto.nome} em ${rotuloMes(meses[m]!)}`}
                                    value={editando.texto}
                                    onChange={(e) => setEditando({ ...editando, texto: e.target.value })}
                                    onBlur={confirmar}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") confirmar();
                                      if (e.key === "Escape") {
                                        cancelado.current = true;
                                        setEditando(null);
                                      }
                                    }}
                                  />
                                ) : (
                                  <button
                                    className={`celula${ajustado ? " ajustada" : ""}${mudouOriginal ? " mudou-original" : ""}`}
                                    title={dica || undefined}
                                    aria-label={`${objeto.nome} em ${rotuloMes(meses[m]!)}: ${valorCelula(v) || "0"}`}
                                    onClick={() => {
                                      cancelado.current = false;
                                      setEditando({ objetoId: objeto.id, mes: m, texto: v ? String(Math.round(v * 100) / 100).replace(".", ",") : "" });
                                    }}
                                  >
                                    {valorCelula(v)}
                                  </button>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  {!fechado && (
                    <tr>
                      <td className="col-nome">
                        <button
                          className="adicionar-objeto"
                          onClick={() =>
                            setAberto({
                              novo: true,
                              objeto: { id: novoId("obj"), bloco: bloco.id, nome: "", regra: { tipo: "fixo", valor: 0, inicio: mesAtual } },
                            })
                          }
                        >
                          + adicionar em {bloco.nome}
                        </button>
                      </td>
                      <td colSpan={meses.length} />
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {linhaFechamento("Despesas previstas", resultado.despesasPrevistas)}
            {linhaFechamento("Entradas previstas", resultado.entradasPrevistas)}
            {linhaFechamento(
              "Acompanhamento (pago e a pagar)",
              resultado.saldo.map((s, m) => s - resultado.saldoPrevisto[m]!),
            )}
            {linhaFechamento("Saldo do mês", resultado.saldo)}
            {linhaFechamento("Acumulado", resultado.acumulado)}
            {linhaFechamento("Fundo", resultado.fundo)}
            {linhaFechamento("Patrimônio", resultado.patrimonio, true)}
          </tbody>
        </table>
      </div>

      {aberto && (
        <EditorObjeto
          key={aberto.objeto.id}
          plano={plano}
          objeto={aberto.objeto}
          novo={aberto.novo}
          onFechar={() => setAberto(null)}
          onExcluir={() => {
            atualizar((p) => ({ ...p, objetos: p.objetos.filter((o) => o.id !== aberto.objeto.id) }));
            setAberto(null);
          }}
          onSalvar={(objeto) => {
            atualizar((p) => ({
              ...p,
              objetos: aberto.novo ? [...p.objetos, objeto] : p.objetos.map((o) => (o.id === objeto.id ? objeto : o)),
            }));
            setAberto(null);
          }}
        />
      )}
    </main>
  );
}
