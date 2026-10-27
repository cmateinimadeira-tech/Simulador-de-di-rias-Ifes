"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  BLOCOS,
  adicionarLancamento,
  anoMesDoIndice,
  congelarMes,
  definirSituacao,
  diasDesdeUltimaRevisao,
  fecharMes,
  formatarData,
  lancamentosDoMes,
  mesCompetencia,
  reabrirMes,
  registrarRevisao,
  removerLancamento,
  resumoDoMes,
  revisoesDoMes,
  rotuloMes,
  rotuloMesLongo,
} from "@/motor";
import type { Lancamento, Objeto, Plano, ResultadoPlano } from "@/motor";
import { lerValor, moeda, novoId } from "@/componentes/formato";
import { hojeISO, usePlano } from "@/estado/PlanoContext";

/** Data sugerida para lançar no mês m: hoje, se hoje cai nele; senão o dia 1. */
function dataSugerida(plano: Plano, m: number): string {
  const hoje = hojeISO();
  const am = anoMesDoIndice(plano.inicio, m);
  return hoje.startsWith(`${am.ano}-${String(am.mes).padStart(2, "0")}`) ? hoje : formatarData({ ...am, dia: 1 });
}

const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function Diferenca({ valor }: { valor: number }) {
  if (Math.abs(valor) < 0.5) return <span className="secundario">sem diferença</span>;
  return (
    <span className={valor < 0 ? "negativo" : "positivo"}>
      {valor > 0 ? "+" : ""}
      {moeda(valor)}
    </span>
  );
}

interface PropsLinha {
  plano: Plano;
  resultado: ResultadoPlano;
  objeto: Objeto;
  mes: number;
  receita: boolean;
  fechado: boolean;
  lancamentos: Lancamento[];
  atualizar: (alterar: (p: Plano) => Plano) => void;
}

/** Um objeto no acompanhamento do mês: previsto, pago, a pagar e a situação. */
function LinhaObjeto({ plano, resultado, objeto, mes, receita, fechado, lancamentos, atualizar }: PropsLinha) {
  const [editandoRestante, setEditandoRestante] = useState(false);
  const [restante, setRestante] = useState("");
  const previsto = resultado.planejado[objeto.id]![mes]!;
  const original = resultado.original[objeto.id]![mes] ?? null;
  const pago = resultado.realizado[objeto.id]![mes] ?? null;
  const aPagar = resultado.aPagar[objeto.id]![mes]!;
  const vigente = resultado.efetivo[objeto.id]![mes]!;
  const situacao = objeto.acompanhamento?.[mes];
  if (previsto === 0 && pago === null && !situacao && (original ?? 0) === 0) return null;

  const pagoTxt = receita ? "Recebido" : "Pago";
  const aPagarTxt = receita ? "a receber" : "a pagar";
  const base = Math.max(vigente, previsto);
  const estourou = !receita && pago !== null && previsto > 0 && pago > previsto * 1.1;
  const nomeCartao = (id?: string) => (id ? plano.cartoes?.find((c) => c.id === id)?.nome : undefined);
  const definir = (s: Parameters<typeof definirSituacao>[3]) => atualizar((p) => definirSituacao(p, objeto.id, mes, s));

  return (
    <li>
      <div className="linha-objeto">
        <span>{objeto.nome}</span>
        <span className={estourou ? "negativo" : undefined}>
          {pagoTxt} {moeda(pago ?? 0)} <small className="secundario">de {moeda(previsto)}</small>
        </span>
      </div>
      {base > 0 && (
        <div className="barra" aria-hidden>
          <i className={estourou ? "estourou" : undefined} style={{ width: `${Math.min((pago ?? 0) / base, 1) * 100}%` }} />
        </div>
      )}
      <div className="situacao">
        {fechado ? (
          <span className="secundario">Mês fechado: vale o {pagoTxt.toLowerCase()}.</span>
        ) : situacao?.situacao === "quitado" ? (
          <>
            <span>
              {receita ? "Recebido tudo" : "Quitado"}
              {previsto - (pago ?? 0) > 0.5 && (
                <span className="positivo">
                  {" "}
                  · {receita ? "faltou" : "sobrou"} {moeda(previsto - (pago ?? 0))}
                </span>
              )}
            </span>
            <button type="button" className="link" onClick={() => definir(null)}>
              Desfazer
            </button>
          </>
        ) : editandoRestante ? (
          <form
            className="acoes"
            onSubmit={(e) => {
              e.preventDefault();
              const v = lerValor(restante);
              if (v !== null) definir({ situacao: "restante", valor: v });
              setEditandoRestante(false);
            }}
          >
            <input
              autoFocus
              inputMode="decimal"
              aria-label={`Quanto ainda falta em ${objeto.nome}`}
              value={restante}
              onChange={(e) => setRestante(e.target.value)}
              style={{ width: 120 }}
            />
            <button type="submit" className="botao">
              OK
            </button>
            <button type="button" className="link" onClick={() => setEditandoRestante(false)}>
              Cancelar
            </button>
          </form>
        ) : (
          <>
            <span>
              {situacao?.situacao === "restante" ? "Restante ajustado: " : "Falta: "}
              <strong>{moeda(aPagar)}</strong> {aPagarTxt}
            </span>
            {situacao?.situacao === "restante" && (
              <button type="button" className="link" onClick={() => definir(null)}>
                Automático
              </button>
            )}
            <button type="button" className="link" onClick={() => definir({ situacao: "quitado" })}>
              {receita ? "Recebi tudo" : "Quitado"}
            </button>
            <button
              type="button"
              className="link"
              onClick={() => {
                setRestante(String(Math.round(aPagar * 100) / 100).replace(".", ","));
                setEditandoRestante(true);
              }}
            >
              Ajustar restante
            </button>
          </>
        )}
      </div>
      {original !== null && Math.abs(original - previsto) > 0.5 && (
        <div className="secundario" style={{ fontSize: "0.8rem" }}>
          Previsto original: {moeda(original)}
        </div>
      )}
      {lancamentos.length > 0 && (
        <ul className="lancamentos">
          {lancamentos.map((l) => (
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
                  aria-label={`Remover lançamento de ${moeda(l.valor)} em ${objeto.nome}`}
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
}

export default function PaginaMes() {
  const { carregado, plano, resultado, mesAtual, atualizar } = usePlano();
  const [mesEscolhido, setMes] = useState<number | null>(null);
  const [form, setForm] = useState({ objetoId: "", valor: "", data: "", cartaoId: "", descricao: "" });
  const [saldoReal, setSaldoReal] = useState("");
  const [nota, setNota] = useState("");
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
    setNota("");
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
  const linhaDeBase = plano.linhaDeBase?.[mes];
  const lancamentos = lancamentosDoMes(plano, mes);
  const resumo = resumoDoMes(plano, resultado, mes);
  const revisoes = revisoesDoMes(plano, mes);
  const diasRevisao = diasDesdeUltimaRevisao(plano, hojeISO());

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
          <div className="rotulo">Saldo do mês (retrato atual)</div>
          <div className={`valor ${resumo.saldoVigente < 0 ? "negativo" : ""}`}>{moeda(resumo.saldoVigente)}</div>
          <div className="detalhe">
            Previsto {moeda(resumo.saldoPrevisto)}: <Diferenca valor={resumo.saldoVigente - resumo.saldoPrevisto} />
          </div>
          {resumo.saldoOriginal !== null && Math.abs(resumo.saldoOriginal - resumo.saldoPrevisto) > 0.5 && (
            <div className="detalhe">
              Original {moeda(resumo.saldoOriginal)}: <Diferenca valor={resumo.saldoVigente - resumo.saldoOriginal} />
            </div>
          )}
        </div>
        <div className="cartao indicador">
          <div className="rotulo">Despesas pagas</div>
          <div className="valor">{moeda(resumo.despesasPagas)}</div>
          <div className="detalhe">
            Falta pagar {moeda(resumo.despesasAPagar)} · previsto {moeda(resumo.despesasPrevistas)}
          </div>
        </div>
        <div className="cartao indicador">
          <div className="rotulo">Entradas recebidas</div>
          <div className="valor">{moeda(resumo.entradasRecebidas)}</div>
          <div className="detalhe">
            Falta receber {moeda(resumo.entradasAReceber)} · previsto {moeda(resumo.entradasPrevistas)}
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
        <h2>Lançar pagamento ou recebimento</h2>
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
        const vigente = resultado.totaisPorBloco[b.id][mes]!;
        const previsto = resultado.totaisPrevistosPorBloco[b.id][mes]!;
        return (
          <details key={b.id} className="cartao bloco-mes" open>
            <summary>
              <strong>{b.nome}</strong>
              <span className="secundario">
                {moeda(vigente)}
                {Math.abs(vigente - previsto) > 0.5 && <small> (previsto {moeda(previsto)})</small>}
              </span>
            </summary>
            <ul className="lista-objetos">
              {objetos.map((o) => (
                <LinhaObjeto
                  key={`${o.id}-${mes}`}
                  plano={plano}
                  resultado={resultado}
                  objeto={o}
                  mes={mes}
                  receita={b.natureza === "receita"}
                  fechado={!!fechamento}
                  lancamentos={lancamentos.filter((l) => l.objetoId === o.id)}
                  atualizar={atualizar}
                />
              ))}
            </ul>
          </details>
        );
      })}

      <section className="cartao" style={{ marginTop: 12 }}>
        <h2>Revisão da semana</h2>
        <p className="secundario" style={{ fontSize: "0.9rem" }}>
          Registre o retrato do mês depois de lançar os pagamentos da semana. O histórico mostra como a situação evoluiu em relação ao
          previsto.{" "}
          {diasRevisao === null
            ? "Nenhuma revisão registrada ainda."
            : diasRevisao === 0
              ? "Última revisão: hoje."
              : `Última revisão há ${diasRevisao} dia(s).`}
        </p>
        <form
          className="acoes"
          onSubmit={(e) => {
            e.preventDefault();
            atualizar((p) => registrarRevisao(p, resultado, mes, hojeISO(), novoId("rev"), nota));
            setNota("");
          }}
        >
          <input aria-label="Nota da revisão" placeholder="Nota (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
          <button type="submit" className="botao primario">
            Registrar revisão
          </button>
        </form>
        {revisoes.length > 0 && (
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table className="simples">
              <thead>
                <tr>
                  <th>Data</th>
                  <th className="num">Saldo do mês</th>
                  <th className="num">Falta pagar</th>
                  <th className="num">Acumulado</th>
                  <th className="num">Patrimônio final</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {revisoes.map((r, i) => {
                  const anterior = revisoes[i - 1];
                  return (
                    <tr key={r.id}>
                      <td>{dataCurta(r.data)}</td>
                      <td className="num">{moeda(r.saldoVigente)}</td>
                      <td className="num">{moeda(r.despesasAPagar)}</td>
                      <td className="num">{moeda(r.acumuladoMes)}</td>
                      <td className="num">
                        {moeda(r.patrimonioFinal)}
                        {anterior && (
                          <div style={{ fontSize: "0.8rem" }}>
                            <Diferenca valor={r.patrimonioFinal - anterior.patrimonioFinal} />
                          </div>
                        )}
                      </td>
                      <td>{r.nota ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {linhaDeBase && (
          <p className="secundario" style={{ fontSize: "0.85rem", marginTop: 12 }}>
            Previsto original deste mês congelado em {dataCurta(linhaDeBase.congeladoEm)}.{" "}
            <button
              type="button"
              className="link"
              onClick={() => {
                if (window.confirm("Substituir o previsto original deste mês pelo previsto atual? O original anterior será perdido.")) {
                  atualizar((p) => congelarMes(p, mes, hojeISO()));
                }
              }}
            >
              Redefinir com o previsto atual
            </button>
          </p>
        )}
      </section>

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
              Pelo retrato atual, você termina o mês com <strong>{moeda(resultado.acumulado[mes]!)}</strong> em conta. No fim do mês, informe o
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
