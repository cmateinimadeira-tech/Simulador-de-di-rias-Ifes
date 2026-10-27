"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  BLOCOS,
  adicionarLancamento,
  anoMesDoIndice,
  definicaoBloco,
  fecharMes,
  formatarData,
  lancamentosDoMes,
  mesCompetencia,
  reabrirMes,
  removerLancamento,
  rotuloMes,
  rotuloMesLongo,
} from "@/motor";
import type { Plano } from "@/motor";
import { lerValor, moeda, novoId } from "@/componentes/formato";
import { hojeISO, usePlano } from "@/estado/PlanoContext";

/** Data sugerida para lançar no mês m: hoje, se hoje cai nele; senão o dia 1. */
function dataSugerida(plano: Plano, m: number): string {
  const hoje = hojeISO();
  const am = anoMesDoIndice(plano.inicio, m);
  return hoje.startsWith(`${am.ano}-${String(am.mes).padStart(2, "0")}`) ? hoje : formatarData({ ...am, dia: 1 });
}

const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export default function PaginaMes() {
  const { carregado, plano, resultado, mesAtual, atualizar } = usePlano();
  const [mesEscolhido, setMes] = useState<number | null>(null);
  const [form, setForm] = useState({ objetoId: "", valor: "", data: "", cartaoId: "", descricao: "" });
  const [saldoReal, setSaldoReal] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const toque = useRef<number | null>(null);

  // Mês pela URL (?m=3), para os links de "fechar mês pendente".
  useEffect(() => {
    const m = Number(new URLSearchParams(window.location.search).get("m"));
    if (Number.isInteger(m) && m > 0) setMes(m);
  }, []);

  const n = plano?.horizonte ?? 1;
  const mes = Math.min(Math.max(mesEscolhido ?? mesAtual, 0), n - 1);

  // Ao trocar de mês ou de plano: sugere a data e limpa os campos (não a cada lançamento).
  useEffect(() => {
    if (plano) setForm((f) => ({ ...f, data: dataSugerida(plano, mes) }));
    setSaldoReal("");
    setAviso(null);
  }, [mes, plano?.id]);

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

  const am = resultado.meses[mes]!;
  const fechamento = plano.fechamentos?.[mes];
  const lancamentos = lancamentosDoMes(plano, mes);
  const nomeObjeto = (id: string) => plano.objetos.find((o) => o.id === id)?.nome ?? "(objeto excluído)";
  const nomeCartao = (id?: string) => (id ? plano.cartoes?.find((c) => c.id === id)?.nome : undefined);

  let entradasReal = 0;
  let despesasReal = 0;
  for (const o of plano.objetos) {
    const r = resultado.realizado[o.id]?.[mes] ?? 0;
    if (definicaoBloco(o.bloco).natureza === "receita") entradasReal += r;
    else despesasReal += r;
  }

  const lancar = () => {
    const valor = lerValor(form.valor);
    if (!form.objetoId || valor === null || valor === 0 || !form.data) {
      setAviso("Escolha o objeto, informe o valor e a data.");
      return;
    }
    const lancamento = {
      id: novoId("lan"),
      objetoId: form.objetoId,
      data: form.data,
      valor,
      ...(form.cartaoId && { cartaoId: form.cartaoId }),
      ...(form.descricao.trim() && { descricao: form.descricao.trim() }),
    };
    const competencia = mesCompetencia(plano, lancamento);
    atualizar((p) => adicionarLancamento(p, lancamento));
    setForm({ ...form, valor: "", descricao: "" });
    setAviso(
      competencia !== null && competencia !== mes && competencia >= 0 && competencia < n
        ? `Lançado em ${rotuloMes(resultado.meses[competencia]!)}, mês de vencimento da fatura.`
        : competencia === null || competencia < 0 || competencia >= n
          ? "Lançado, mas a data cai fora do horizonte do plano."
          : null,
    );
  };

  const fechar = () => {
    const valor = lerValor(saldoReal);
    if (valor === null) {
      setAviso("Informe o saldo real em conta para fechar o mês.");
      return;
    }
    atualizar((p) => fecharMes(p, mes, { saldoReal: valor, data: hojeISO() }));
  };

  return (
    <main
      className="conteudo"
      style={{ maxWidth: 820 }}
      onTouchStart={(e) => (toque.current = e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        const inicio = toque.current;
        const fim = e.changedTouches[0]?.clientX;
        toque.current = null;
        if (inicio === null || fim === undefined || Math.abs(fim - inicio) < 70) return;
        setMes(Math.min(Math.max(mes + (fim < inicio ? 1 : -1), 0), n - 1));
      }}
    >
      <div className="acoes" style={{ justifyContent: "space-between" }}>
        <div className="seletor-mes" aria-label="Mês exibido">
          <button className="botao" onClick={() => setMes(Math.max(0, mes - 1))} disabled={mes === 0} aria-label="Mês anterior">
            ‹
          </button>
          <strong>{rotuloMesLongo(am)}</strong>
          <button className="botao" onClick={() => setMes(Math.min(n - 1, mes + 1))} disabled={mes === n - 1} aria-label="Próximo mês">
            ›
          </button>
        </div>
        <span className={`selo ${fechamento ? "positivo" : "informativo"}`}>{fechamento ? "Mês fechado" : "Mês aberto"}</span>
      </div>

      <div className="grade-cartoes">
        <div className="cartao indicador">
          <div className="rotulo">Saldo planejado</div>
          <div className="valor">{moeda(resultado.saldo[mes]!)}</div>
        </div>
        <div className="cartao indicador">
          <div className="rotulo">Realizado até agora</div>
          <div className={`valor ${entradasReal - despesasReal < 0 ? "negativo" : ""}`}>{moeda(entradasReal - despesasReal)}</div>
          <div className="detalhe">
            Entradas {moeda(entradasReal)} · despesas {moeda(despesasReal)}
          </div>
        </div>
      </div>

      <form
        className="cartao"
        onSubmit={(e) => {
          e.preventDefault();
          lancar();
        }}
      >
        <h2>Lançar</h2>
        <div className="linha-campos">
          <div className="campo">
            <label htmlFor="objeto">Objeto</label>
            <select id="objeto" value={form.objetoId} onChange={(e) => setForm({ ...form, objetoId: e.target.value })}>
              <option value="">Escolha…</option>
              {BLOCOS.map((b) => (
                <optgroup key={b.id} label={b.nome}>
                  {plano.objetos
                    .filter((o) => o.bloco === b.id)
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nome}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="valor">Valor (R$)</label>
            <input id="valor" inputMode="decimal" placeholder="0,00" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
          </div>
        </div>
        <div className="linha-campos">
          <div className="campo">
            <label htmlFor="data">Data</label>
            <input id="data" type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
          </div>
          <div className="campo">
            <label htmlFor="cartao">Forma de pagamento</label>
            <select id="cartao" value={form.cartaoId} onChange={(e) => setForm({ ...form, cartaoId: e.target.value })}>
              <option value="">Débito, Pix ou dinheiro</option>
              {(plano.cartoes ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="descricao">Descrição (opcional)</label>
            <input id="descricao" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </div>
        </div>
        <div className="acoes">
          <button type="submit" className="botao primario">
            Lançar
          </button>
          {(plano.cartoes ?? []).length === 0 && (
            <span className="secundario" style={{ fontSize: "0.85rem" }}>
              Cadastre seus cartões em <Link href="/conta">Conta</Link> para lançar compras na fatura certa.
            </span>
          )}
        </div>
        {aviso && <p className="aviso">{aviso}</p>}
      </form>

      {BLOCOS.map((b) => {
        const objetos = plano.objetos.filter((o) => o.bloco === b.id);
        if (objetos.length === 0) return null;
        const receita = b.natureza === "receita";
        return (
          <details key={b.id} className="cartao bloco-mes" open>
            <summary>
              <strong>{b.nome}</strong>
              <span className="secundario">{moeda(resultado.totaisPorBloco[b.id][mes]!)}</span>
            </summary>
            <ul className="lista-objetos">
              {objetos.map((o) => {
                const planejado = resultado.planejado[o.id]![mes]!;
                const real = resultado.realizado[o.id]![mes] ?? null;
                const proporcao = planejado > 0 && real !== null ? real / planejado : 0;
                const estourou = !receita && real !== null && planejado > 0 && real > planejado * 1.1;
                const doObjeto = lancamentos.filter((l) => l.objetoId === o.id);
                if (planejado === 0 && real === null) return null;
                return (
                  <li key={o.id}>
                    <div className="linha-objeto">
                      <span>{o.nome}</span>
                      <span className={estourou ? "negativo" : undefined}>
                        {real !== null ? moeda(real) : "—"} <small className="secundario">de {moeda(planejado)}</small>
                      </span>
                    </div>
                    {planejado > 0 && (
                      <div className="barra" aria-hidden>
                        <i className={estourou ? "estourou" : undefined} style={{ width: `${Math.min(proporcao, 1) * 100}%` }} />
                      </div>
                    )}
                    {doObjeto.length > 0 && (
                      <ul className="lancamentos">
                        {doObjeto.map((l) => (
                          <li key={l.id}>
                            <span>
                              {dataCurta(l.data)} {l.descricao ?? ""}
                              {nomeCartao(l.cartaoId) && <small className="secundario"> · {nomeCartao(l.cartaoId)}</small>}
                            </span>
                            <span>
                              {moeda(l.valor)}
                              <button
                                type="button"
                                className="remover"
                                aria-label={`Remover lançamento de ${moeda(l.valor)} em ${nomeObjeto(l.objetoId)}`}
                                onClick={() => atualizar((p) => removerLancamento(p, l.id))}
                              >
                                ×
                              </button>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}

      <section className="cartao" style={{ marginTop: 12 }}>
        <h2>Fechamento de {rotuloMesLongo(am)}</h2>
        {fechamento ? (
          <>
            <p>
              Fechado com saldo real de <strong>{moeda(fechamento.saldoReal)}</strong>
              {fechamento.data ? ` em ${dataCurta(fechamento.data)}` : ""}. Diferença para o calculado:{" "}
              <strong className={resultado.ajusteFechamento[mes]! < 0 ? "negativo" : undefined}>{moeda(resultado.ajusteFechamento[mes]!)}</strong>.
            </p>
            <p className="secundario">Neste mês o plano usa o realizado de cada objeto; os meses seguintes partem do saldo real.</p>
            <button className="botao" onClick={() => atualizar((p) => reabrirMes(p, mes))}>
              Reabrir mês
            </button>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              fechar();
            }}
          >
            <p className="secundario">
              Pelo plano, você deveria terminar o mês com <strong>{moeda(resultado.acumulado[mes]!)}</strong> em conta. Lance o realizado e informe o
              saldo real: a diferença ajusta todos os meses seguintes.
            </p>
            <div className="acoes">
              <input aria-label="Saldo real em conta" inputMode="decimal" placeholder="Saldo real em conta" value={saldoReal} onChange={(e) => setSaldoReal(e.target.value)} />
              <button type="submit" className="botao primario">
                Fechar mês
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
