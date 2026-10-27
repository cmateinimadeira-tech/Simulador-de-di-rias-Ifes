"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BLOCOS,
  anoMesDoIndice,
  aplicarCenarioAoPlano,
  compararCenarios,
  efeitoAmortizacao,
  rotuloMes,
  simularAmortizacao,
  simularCompra,
  simularMudancaDeValor,
  simularNovoItem,
  situacaoDasDividas,
  valorParaQuitar,
} from "@/motor";
import type { Bloco, Cenario, Plano, Simulacao } from "@/motor";
import { ComparacaoCurvas, corDaSerie } from "@/componentes/ComparacaoCurvas";
import { lerValor, moeda, novoId } from "@/componentes/formato";
import { hojeISO, usePlano } from "@/estado/PlanoContext";

type TipoSimulacao = "compra" | "mudanca" | "novo" | "divida";

const TIPOS: { id: TipoSimulacao; rotulo: string }[] = [
  { id: "compra", rotulo: "Compra (à vista, parcelada ou financiada)" },
  { id: "mudanca", rotulo: "Mudança de renda ou de gasto" },
  { id: "novo", rotulo: "Novo gasto ou nova receita mensal" },
  { id: "divida", rotulo: "Amortizar ou quitar dívida" },
];

const MAX_COMPARADOS = 3;

function SeletorMes({ id, plano, valor, onChange, vazio }: { id: string; plano: Plano; valor: string; onChange: (v: string) => void; vazio?: string }) {
  return (
    <select id={id} value={valor} onChange={(e) => onChange(e.target.value)}>
      {vazio && <option value="">{vazio}</option>}
      {Array.from({ length: plano.horizonte }, (_, m) => (
        <option key={m} value={m}>
          {rotuloMes(anoMesDoIndice(plano.inicio, m))}
        </option>
      ))}
    </select>
  );
}

interface FormularioSimulacao {
  destino: string;
  nomeCenario: string;
  tipo: TipoSimulacao;
  nome: string;
  valor: string;
  mes: string;
  ate: string;
  forma: "vista" | "parcelado" | "financiado";
  parcelas: string;
  taxa: string;
  sistema: "price" | "sac";
  entrada: string;
  usarFundo: boolean;
  objetoId: string;
  bloco: Bloco;
}

function NovaSimulacao({
  plano,
  mesAtual,
  inicial,
  onCriar,
}: {
  plano: Plano;
  mesAtual: number;
  inicial: Partial<FormularioSimulacao>;
  onCriar: (destino: string, nomeCenario: string, simulacao: Simulacao) => void;
}) {
  const cenarios = plano.cenarios ?? [];
  const dividas = plano.objetos.filter((o) => o.regra.tipo === "divida");
  const [f, setF] = useState<FormularioSimulacao>({
    destino: "novo",
    nomeCenario: "",
    tipo: "compra",
    nome: "",
    valor: "",
    mes: String(mesAtual),
    ate: "",
    forma: "vista",
    parcelas: "12",
    taxa: "1,5",
    sistema: "price",
    entrada: "",
    usarFundo: false,
    objetoId: "",
    bloco: "variavel",
    ...inicial,
  });
  const [erro, setErro] = useState<string | null>(null);
  const campo = <K extends keyof FormularioSimulacao>(chave: K) => ({
    id: `sim-${chave}`,
    value: f[chave] as string,
    onChange: (e: { target: { value: string } }) => setF({ ...f, [chave]: e.target.value }),
  });
  const mes = Number(f.mes);
  const valor = lerValor(f.valor);

  const montar = (): Simulacao | string => {
    switch (f.tipo) {
      case "compra":
        if (!f.nome.trim() || !valor || valor <= 0) return "Informe o que vai comprar e o valor.";
        return simularCompra(
          plano,
          {
            nome: f.nome.trim(),
            valor,
            mes,
            forma: f.forma,
            parcelas: lerValor(f.parcelas) ?? 1,
            taxaMensal: (lerValor(f.taxa) ?? 0) / 100,
            sistema: f.sistema,
            entrada: lerValor(f.entrada) ?? 0,
            usarFundo: f.usarFundo,
          },
          novoId,
        );
      case "mudanca":
        if (!f.objetoId || valor === null) return "Escolha o objeto e o novo valor mensal.";
        return simularMudancaDeValor(plano, { objetoId: f.objetoId, novoValor: valor, aPartirDe: mes, ...(f.ate !== "" && { ate: Number(f.ate) }) }, novoId);
      case "novo":
        if (!f.nome.trim() || !valor || valor <= 0) return "Informe o nome e o valor mensal.";
        return simularNovoItem(plano, { nome: f.nome.trim(), bloco: f.bloco, valor, aPartirDe: mes, ...(f.ate !== "" && { ate: Number(f.ate) }) }, novoId);
      case "divida": {
        if (!f.objetoId || !valor || valor <= 0) return "Escolha a dívida e o valor extra.";
        return simularAmortizacao(plano, { objetoId: f.objetoId, mes, valor, usarFundo: f.usarFundo }, novoId) ?? "Escolha uma dívida cadastrada.";
      }
    }
  };

  const efeito = f.tipo === "divida" && f.objetoId && valor ? efeitoAmortizacao(plano, f.objetoId, mes, valor) : null;
  const quitar = f.tipo === "divida" && f.objetoId ? valorParaQuitar(plano, f.objetoId, mes) : 0;
  const mesTxt = (m: number | null) => (m === null ? "depois do horizonte" : rotuloMes(anoMesDoIndice(plano.inicio, m)));

  return (
    <form
      className="cartao"
      onSubmit={(e) => {
        e.preventDefault();
        const resultado = montar();
        if (typeof resultado === "string") {
          setErro(resultado);
          return;
        }
        setErro(null);
        onCriar(f.destino, f.nomeCenario.trim() || resultado.descricao.split(":")[0]!.trim(), resultado);
        setF({ ...f, nome: "", valor: "", entrada: "", nomeCenario: "" });
      }}
    >
      <h2>Nova simulação</h2>
      <div className="linha-campos">
        <div className="campo">
          <label htmlFor="sim-tipo">O que você quer simular?</label>
          <select {...campo("tipo")}>
            {TIPOS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.rotulo}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="sim-destino">Em qual cenário</label>
          <select {...campo("destino")}>
            <option value="novo">Novo cenário</option>
            {cenarios.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        {f.destino === "novo" && (
          <div className="campo">
            <label htmlFor="sim-nomeCenario">Nome do cenário (opcional)</label>
            <input placeholder="ex.: Carro novo" {...campo("nomeCenario")} />
          </div>
        )}
      </div>

      {f.tipo === "compra" && (
        <>
          <div className="linha-campos">
            <div className="campo">
              <label htmlFor="sim-nome">O que vai comprar</label>
              <input placeholder="ex.: Carro" {...campo("nome")} />
            </div>
            <div className="campo">
              <label htmlFor="sim-valor">Valor total (R$)</label>
              <input inputMode="decimal" {...campo("valor")} />
            </div>
            <div className="campo">
              <label htmlFor="sim-mes">Mês da compra</label>
              <SeletorMes id="sim-mes" plano={plano} valor={f.mes} onChange={(v) => setF({ ...f, mes: v })} />
            </div>
          </div>
          <div className="linha-campos">
            <div className="campo">
              <label htmlFor="sim-forma">Forma de pagamento</label>
              <select {...campo("forma")}>
                <option value="vista">À vista</option>
                <option value="parcelado">Parcelado sem juros (cartão)</option>
                <option value="financiado">Financiado</option>
              </select>
            </div>
            {f.forma !== "vista" && (
              <div className="campo">
                <label htmlFor="sim-parcelas">Nº de parcelas</label>
                <input inputMode="numeric" {...campo("parcelas")} />
              </div>
            )}
            {f.forma === "financiado" && (
              <>
                <div className="campo">
                  <label htmlFor="sim-taxa">Juros ao mês (%)</label>
                  <input inputMode="decimal" {...campo("taxa")} />
                </div>
                <div className="campo">
                  <label htmlFor="sim-sistema">Sistema</label>
                  <select {...campo("sistema")}>
                    <option value="price">Price (parcela fixa)</option>
                    <option value="sac">SAC (parcela decrescente)</option>
                  </select>
                </div>
                <div className="campo">
                  <label htmlFor="sim-entrada">Entrada (R$)</label>
                  <input inputMode="decimal" placeholder="0" {...campo("entrada")} />
                </div>
              </>
            )}
          </div>
          {f.forma !== "parcelado" && (
            <label className="opcao">
              <input type="checkbox" checked={f.usarFundo} onChange={(e) => setF({ ...f, usarFundo: e.target.checked })} />
              Pagar {f.forma === "vista" ? "à vista" : "a entrada"} com dinheiro do Fundo
            </label>
          )}
        </>
      )}

      {f.tipo === "mudanca" && (
        <div className="linha-campos">
          <div className="campo">
            <label htmlFor="sim-objetoId">Renda ou gasto</label>
            <select {...campo("objetoId")}>
              <option value="">Escolha…</option>
              {BLOCOS.map((b) => (
                <optgroup key={b.id} label={b.nome}>
                  {plano.objetos
                    .filter((o) => o.bloco === b.id && o.regra.tipo !== "divida")
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
            <label htmlFor="sim-valor">Novo valor mensal (R$)</label>
            <input inputMode="decimal" placeholder="0 para cortar" {...campo("valor")} />
          </div>
          <div className="campo">
            <label htmlFor="sim-mes">A partir de</label>
            <SeletorMes id="sim-mes" plano={plano} valor={f.mes} onChange={(v) => setF({ ...f, mes: v })} />
          </div>
          <div className="campo">
            <label htmlFor="sim-ate">Até</label>
            <SeletorMes id="sim-ate" plano={plano} valor={f.ate} vazio="o fim do horizonte" onChange={(v) => setF({ ...f, ate: v })} />
          </div>
        </div>
      )}

      {f.tipo === "mudanca" &&
        (() => {
          const regra = plano.objetos.find((o) => o.id === f.objetoId)?.regra;
          const reajuste = regra && (regra.tipo === "fixo" || regra.tipo === "anual") ? regra.reajuste : undefined;
          return reajuste ? (
            <p className="aviso">
              Este item tem reajuste anual de {(reajuste.percentualAnual * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%. O novo
              valor fica fixo no período e substitui o reajuste; para manter os aumentos, limite o período com &quot;Até&quot;.
            </p>
          ) : null;
        })()}

      {f.tipo === "novo" && (
        <div className="linha-campos">
          <div className="campo">
            <label htmlFor="sim-nome">Nome</label>
            <input placeholder="ex.: Escola do filho" {...campo("nome")} />
          </div>
          <div className="campo">
            <label htmlFor="sim-bloco">Bloco</label>
            <select {...campo("bloco")}>
              {BLOCOS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="sim-valor">Valor mensal (R$)</label>
            <input inputMode="decimal" {...campo("valor")} />
          </div>
          <div className="campo">
            <label htmlFor="sim-mes">A partir de</label>
            <SeletorMes id="sim-mes" plano={plano} valor={f.mes} onChange={(v) => setF({ ...f, mes: v })} />
          </div>
          <div className="campo">
            <label htmlFor="sim-ate">Até</label>
            <SeletorMes id="sim-ate" plano={plano} valor={f.ate} vazio="o fim do horizonte" onChange={(v) => setF({ ...f, ate: v })} />
          </div>
        </div>
      )}

      {f.tipo === "divida" &&
        (dividas.length === 0 ? (
          <p className="aviso">
            Nenhuma dívida cadastrada. Cadastre na <Link href="/grade">Grade</Link> um objeto com a regra &quot;Dívida (Price/SAC)&quot;.
          </p>
        ) : (
          <>
            <div className="linha-campos">
              <div className="campo">
                <label htmlFor="sim-objetoId">Dívida</label>
                <select {...campo("objetoId")}>
                  <option value="">Escolha…</option>
                  {dividas.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="campo">
                <label htmlFor="sim-mes">Mês do pagamento extra</label>
                <SeletorMes id="sim-mes" plano={plano} valor={f.mes} onChange={(v) => setF({ ...f, mes: v })} />
              </div>
              <div className="campo">
                <label htmlFor="sim-valor">Valor extra (R$)</label>
                <input inputMode="decimal" {...campo("valor")} />
              </div>
            </div>
            {f.objetoId && quitar > 0 && (
              <p className="secundario" style={{ fontSize: "0.9rem" }}>
                Para quitar em {mesTxt(mes)}: {moeda(quitar)} além da parcela do mês.{" "}
                <button type="button" className="link" onClick={() => setF({ ...f, valor: String(Math.round(quitar * 100) / 100).replace(".", ",") })}>
                  Quitar tudo
                </button>
              </p>
            )}
            <label className="opcao">
              <input type="checkbox" checked={f.usarFundo} onChange={(e) => setF({ ...f, usarFundo: e.target.checked })} />
              Pagar com dinheiro do Fundo
            </label>
            {efeito && (
              <p className="aviso sucesso">
                Economia de juros: <strong>{moeda(efeito.jurosEconomizados)}</strong>. Quitação em {mesTxt(efeito.quitacaoDepois)}, em vez de{" "}
                {mesTxt(efeito.quitacaoAntes)}
                {efeito.parcelasEliminadas > 0 ? ` (${efeito.parcelasEliminadas} parcelas a menos)` : ""}.
              </p>
            )}
          </>
        ))}

      {erro && <p className="aviso erro">{erro}</p>}
      <button type="submit" className="botao primario" style={{ marginTop: 8 }}>
        Simular
      </button>
    </form>
  );
}

export default function PaginaCenarios() {
  const { carregado, plano, mesAtual, atualizar } = usePlano();
  const [comparados, setComparados] = useState<string[] | null>(null);
  const [inicial, setInicial] = useState<{ chave: number; valores: Partial<FormularioSimulacao> }>({ chave: 0, valores: {} });

  if (!carregado) return <main className="conteudo secundario">Carregando…</main>;
  if (!plano) {
    return (
      <main className="conteudo">
        <p>
          Nenhum plano aberto. <Link href="/">Crie, importe ou abra o exemplo</Link>.
        </p>
      </main>
    );
  }

  const cenarios = plano.cenarios ?? [];
  const comparacao = compararCenarios(plano, cenarios, { mesReferencia: mesAtual });
  const base = comparacao[0]!;
  const selecionados = (comparados ?? cenarios.slice(0, MAX_COMPARADOS).map((c) => c.id)).filter((id) => cenarios.some((c) => c.id === id));
  const exibidos = [base, ...comparacao.filter((c) => selecionados.includes(c.id))];
  const dividas = situacaoDasDividas(plano, mesAtual);
  const mesTxt = (m: number | null) => (m === null ? "após o horizonte" : rotuloMes(anoMesDoIndice(plano.inicio, m)));

  const salvarCenarios = (alterar: (lista: Cenario[]) => Cenario[]) => atualizar((p) => ({ ...p, cenarios: alterar(p.cenarios ?? []) }));

  const criar = (destino: string, nomeCenario: string, simulacao: Simulacao) => {
    if (destino === "novo") {
      const novo: Cenario = { id: novoId("cen"), nome: nomeCenario, alteracoes: [], simulacoes: [simulacao] };
      salvarCenarios((lista) => [...lista, novo]);
      setComparados([...selecionados, novo.id].slice(-MAX_COMPARADOS));
    } else {
      salvarCenarios((lista) => lista.map((c) => (c.id === destino ? { ...c, simulacoes: [...(c.simulacoes ?? []), simulacao] } : c)));
    }
  };

  const alternar = (id: string) => {
    if (selecionados.includes(id)) setComparados(selecionados.filter((s) => s !== id));
    else if (selecionados.length < MAX_COMPARADOS) setComparados([...selecionados, id]);
  };

  return (
    <main className="conteudo pilha">
      <div>
        <h1>Cenários</h1>
        <p className="secundario" style={{ margin: 0 }}>
          Simule decisões antes de tomá-las. Os cenários não alteram o plano até você aplicá-los.
        </p>
      </div>

      {dividas.length > 0 && (
        <section className="cartao">
          <h2>Suas dívidas</h2>
          <div style={{ overflowX: "auto" }}>
            <table className="simples">
              <thead>
                <tr>
                  <th>Dívida</th>
                  <th className="num">Saldo devedor</th>
                  <th className="num">Parcela</th>
                  <th className="num">Juros a pagar</th>
                  <th>Quitação</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {dividas.map((d) => (
                  <tr key={d.objetoId}>
                    <td>{d.nome}</td>
                    <td className="num">{moeda(d.saldoDevedor)}</td>
                    <td className="num">{moeda(d.parcela)}</td>
                    <td className="num">{moeda(d.jurosRestantes)}</td>
                    <td>{mesTxt(d.mesQuitacao)}</td>
                    <td className="num">
                      <button
                        className="link"
                        onClick={() => {
                          setInicial((atual) => ({ chave: atual.chave + 1, valores: { tipo: "divida", objetoId: d.objetoId, mes: String(mesAtual) } }));
                          document.getElementById("nova-simulacao")?.scrollIntoView({ behavior: "smooth" });
                        }}
                      >
                        Simular quitação
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div id="nova-simulacao">
        <NovaSimulacao key={inicial.chave} plano={plano} mesAtual={mesAtual} inicial={inicial.valores} onCriar={criar} />
      </div>

      {cenarios.length > 0 && (
        <section className="cartao">
          <h2>Comparação</h2>
          <p className="secundario" style={{ fontSize: "0.9rem", marginTop: 0 }}>
            Marque até {MAX_COMPARADOS} cenários para comparar com o plano atual.
          </p>
          <ComparacaoCurvas
            series={exibidos.map((c) => ({ id: c.id, nome: c.nome, valores: c.patrimonio }))}
            meses={base.resultado.meses}
            mesAtual={mesAtual}
          />
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table className="simples">
              <thead>
                <tr>
                  <th />
                  {exibidos.map((c, i) => (
                    <th key={c.id} className="num">
                      <span className="marcador" style={{ background: corDaSerie(i) }} />
                      {c.nome}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Patrimônio final</td>
                  {exibidos.map((c) => (
                    <td key={c.id} className="num">
                      <strong>{moeda(c.resumo.patrimonioFinal)}</strong>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>Diferença para o plano atual</td>
                  {exibidos.map((c, i) => {
                    const d = c.resumo.patrimonioFinal - base.resumo.patrimonioFinal;
                    return (
                      <td key={c.id} className={`num ${d < -0.5 ? "negativo" : d > 0.5 ? "positivo" : "secundario"}`}>
                        {i === 0 ? "—" : `${d > 0 ? "+" : ""}${moeda(d)}`}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td>Menor saldo em conta</td>
                  {exibidos.map((c) => (
                    <td key={c.id} className={`num ${c.resumo.menorAcumulado.valor < 0 ? "negativo" : ""}`}>
                      {moeda(c.resumo.menorAcumulado.valor)}
                      <div className="secundario" style={{ fontSize: "0.8rem" }}>
                        {mesTxt(c.resumo.menorAcumulado.mes)}
                      </div>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>Meses com caixa negativo</td>
                  {exibidos.map((c) => {
                    const negativos = c.acumulado.filter((v) => v < 0).length;
                    return (
                      <td key={c.id} className={`num ${negativos > 0 ? "negativo" : ""}`}>
                        {negativos}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td>Juros pagos no horizonte</td>
                  {exibidos.map((c) => (
                    <td key={c.id} className="num">
                      {moeda(c.resumo.jurosTotais)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>Fundo no fim</td>
                  {exibidos.map((c) => (
                    <td key={c.id} className="num">
                      {moeda(c.resumo.fundoFinal)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {cenarios.map((c) => {
        const linha = comparacao.find((x) => x.id === c.id)!;
        const d = linha.resumo.patrimonioFinal - base.resumo.patrimonioFinal;
        return (
          <section key={c.id} className="cartao">
            <div className="acoes" style={{ justifyContent: "space-between" }}>
              <label className="opcao" style={{ margin: 0 }}>
                <input
                  type="checkbox"
                  checked={selecionados.includes(c.id)}
                  disabled={!selecionados.includes(c.id) && selecionados.length >= MAX_COMPARADOS}
                  onChange={() => alternar(c.id)}
                />
                <strong>{c.nome}</strong>
              </label>
              <span className={d < -0.5 ? "negativo" : d > 0.5 ? "positivo" : "secundario"}>
                {d > 0 ? "+" : ""}
                {moeda(d)} no patrimônio final
              </span>
            </div>
            <ul className="lista-simulacoes">
              {(c.simulacoes ?? []).map((s) => (
                <li key={s.id}>
                  <span>{s.descricao}</span>
                  <button
                    className="remover"
                    aria-label={`Remover simulação: ${s.descricao}`}
                    onClick={() =>
                      salvarCenarios((lista) => lista.map((x) => (x.id === c.id ? { ...x, simulacoes: (x.simulacoes ?? []).filter((y) => y.id !== s.id) } : x)))
                    }
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <div className="acoes">
              <button
                className="botao primario"
                onClick={() => {
                  if (window.confirm(`Aplicar "${c.nome}" ao plano? As simulações passam a valer no plano e o cenário sai da lista.`)) {
                    atualizar((p) => aplicarCenarioAoPlano(p, c.id, hojeISO()));
                  }
                }}
              >
                Aplicar ao plano
              </button>
              <button className="botao perigo" onClick={() => window.confirm(`Excluir o cenário "${c.nome}"?`) && salvarCenarios((lista) => lista.filter((x) => x.id !== c.id))}>
                Excluir cenário
              </button>
            </div>
          </section>
        );
      })}

      {(plano.cenariosAplicados ?? []).length > 0 && (
        <section className="cartao">
          <h2>Cenários aplicados ao plano</h2>
          <ul className="lista-simulacoes">
            {[...(plano.cenariosAplicados ?? [])].reverse().map((c) => (
              <li key={`${c.id}-${c.data}`}>
                <span>
                  <strong>{c.nome}</strong>, em {c.data.slice(8, 10)}/{c.data.slice(5, 7)}/{c.data.slice(0, 4)}: {c.simulacoes.join("; ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
