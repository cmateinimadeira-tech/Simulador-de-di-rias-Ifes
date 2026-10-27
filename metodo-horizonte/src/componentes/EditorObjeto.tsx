"use client";

import { useEffect, useState } from "react";
import { BLOCOS, NOMES_MESES, NOMES_REGRAS, cronogramaDivida, gerarValores, rotuloMes, anoMesDoIndice } from "@/motor";
import type { Bloco, FuncaoObjeto, Objeto, Plano, Regra, Reajuste } from "@/motor";
import { lerValor, moeda } from "./formato";

interface Props {
  plano: Plano;
  objeto: Objeto;
  novo: boolean;
  onSalvar: (objeto: Objeto) => void;
  onExcluir: () => void;
  onFechar: () => void;
}

const FUNCOES: Partial<Record<Bloco, { valor: FuncaoObjeto; rotulo: string }[]>> = {
  planejamento: [{ valor: "aporteFundo", rotulo: "Aporte no Fundo (pague-se primeiro)" }],
  entradas: [
    { valor: "resgateFundo", rotulo: "Resgate do Fundo" },
    { valor: "entradaPossivel", rotulo: "Entrada possível (incerta)" },
  ],
};

/** Valor de referência para iniciar uma regra nova a partir da atual. */
function valorBase(regra: Regra, plano: Plano): number {
  return gerarValores(regra, plano).find((v) => v > 0) ?? 0;
}

function regraPadrao(tipo: Regra["tipo"], atual: Regra, plano: Plano): Regra {
  const valor = valorBase(atual, plano);
  switch (tipo) {
    case "fixo":
      return { tipo, valor, inicio: 0 };
    case "decrescente":
      return { tipo, valorInicial: valor, reducaoMensal: 0, inicio: 0 };
    case "parcelado":
      return { tipo, parcela: valor, parcelas: 10, inicio: 0 };
    case "anual":
      return { tipo, valor, mesesDoAno: [plano.inicio.mes] };
    case "unico":
      return { tipo, valor, mes: 0 };
    case "manual":
      return { tipo, valores: Object.fromEntries(gerarValores(atual, plano).flatMap((v, m) => (v ? [[m, v]] : []))) };
    case "divida":
      return { tipo, saldoDevedor: valor * 12, taxaMensal: 0.015, prazo: 24, sistema: "price", inicio: 0 };
  }
}

/** Campo de valor em reais que aceita vírgula. */
function EntradaValor({ id, valor, onChange }: { id: string; valor: number; onChange: (v: number) => void }) {
  const [texto, setTexto] = useState(() => String(valor).replace(".", ","));
  useEffect(() => {
    // Só reescreve o texto quando o valor muda por fora (ex.: troca de regra).
    if (lerValor(texto) !== valor) setTexto(String(valor).replace(".", ","));
  }, [valor]);
  return (
    <input
      id={id}
      inputMode="decimal"
      value={texto}
      onChange={(e) => {
        setTexto(e.target.value);
        const n = lerValor(e.target.value);
        if (n !== null) onChange(n);
      }}
    />
  );
}

function SeletorMes({ id, plano, valor, onChange, vazio }: { id: string; plano: Plano; valor: number | undefined; onChange: (m: number | undefined) => void; vazio?: string }) {
  return (
    <select id={id} value={valor ?? ""} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}>
      {vazio && <option value="">{vazio}</option>}
      {Array.from({ length: plano.horizonte }, (_, m) => (
        <option key={m} value={m}>
          {rotuloMes(anoMesDoIndice(plano.inicio, m))}
        </option>
      ))}
    </select>
  );
}

function CamposReajuste({ reajuste, onChange }: { reajuste: Reajuste | undefined; onChange: (r: Reajuste | undefined) => void }) {
  return (
    <div className="linha-campos">
      <div className="campo">
        <label htmlFor="reajuste">Reajuste anual (%)</label>
        <EntradaValor
          id="reajuste"
          valor={reajuste ? Math.round(reajuste.percentualAnual * 10000) / 100 : 0}
          onChange={(p) => onChange(p ? { percentualAnual: p / 100, mesDoAno: reajuste?.mesDoAno ?? 1 } : undefined)}
        />
      </div>
      {reajuste && (
        <div className="campo">
          <label htmlFor="mes-reajuste">Mês do reajuste</label>
          <select id="mes-reajuste" value={reajuste.mesDoAno} onChange={(e) => onChange({ ...reajuste, mesDoAno: Number(e.target.value) })}>
            {NOMES_MESES.map((nome, i) => (
              <option key={nome} value={i + 1}>
                {nome}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function CamposRegra({ regra, plano, onChange }: { regra: Regra; plano: Plano; onChange: (r: Regra) => void }) {
  switch (regra.tipo) {
    case "fixo":
      return (
        <>
          <div className="campo">
            <label htmlFor="valor">Valor mensal (R$)</label>
            <EntradaValor id="valor" valor={regra.valor} onChange={(valor) => onChange({ ...regra, valor })} />
          </div>
          <div className="linha-campos">
            <div className="campo">
              <label htmlFor="inicio">De</label>
              <SeletorMes id="inicio" plano={plano} valor={regra.inicio} onChange={(m) => onChange({ ...regra, inicio: m ?? 0 })} />
            </div>
            <div className="campo">
              <label htmlFor="fim">Até</label>
              <SeletorMes id="fim" plano={plano} valor={regra.fim} vazio="o fim do horizonte" onChange={(fim) => onChange({ ...regra, fim })} />
            </div>
          </div>
          <CamposReajuste reajuste={regra.reajuste} onChange={(reajuste) => onChange({ ...regra, reajuste })} />
        </>
      );
    case "decrescente":
      return (
        <>
          <div className="linha-campos">
            <div className="campo">
              <label htmlFor="valor">Valor inicial (R$)</label>
              <EntradaValor id="valor" valor={regra.valorInicial} onChange={(valorInicial) => onChange({ ...regra, valorInicial })} />
            </div>
            <div className="campo">
              <label htmlFor="reducao">Redução por mês (R$)</label>
              <EntradaValor id="reducao" valor={regra.reducaoMensal} onChange={(reducaoMensal) => onChange({ ...regra, reducaoMensal })} />
            </div>
          </div>
          <div className="linha-campos">
            <div className="campo">
              <label htmlFor="inicio">De</label>
              <SeletorMes id="inicio" plano={plano} valor={regra.inicio} onChange={(m) => onChange({ ...regra, inicio: m ?? 0 })} />
            </div>
            <div className="campo">
              <label htmlFor="fim">Até</label>
              <SeletorMes id="fim" plano={plano} valor={regra.fim} vazio="o fim do horizonte" onChange={(fim) => onChange({ ...regra, fim })} />
            </div>
          </div>
        </>
      );
    case "parcelado":
      return (
        <div className="linha-campos">
          <div className="campo">
            <label htmlFor="parcela">Parcela (R$)</label>
            <EntradaValor id="parcela" valor={regra.parcela} onChange={(parcela) => onChange({ ...regra, parcela })} />
          </div>
          <div className="campo">
            <label htmlFor="parcelas">Nº de parcelas</label>
            <EntradaValor id="parcelas" valor={regra.parcelas} onChange={(p) => onChange({ ...regra, parcelas: Math.max(1, Math.round(p)) })} />
          </div>
          <div className="campo">
            <label htmlFor="inicio">1ª fatura</label>
            <SeletorMes id="inicio" plano={plano} valor={regra.inicio} onChange={(m) => onChange({ ...regra, inicio: m ?? 0 })} />
          </div>
        </div>
      );
    case "anual":
      return (
        <>
          <div className="campo">
            <label htmlFor="valor">Valor (R$)</label>
            <EntradaValor id="valor" valor={regra.valor} onChange={(valor) => onChange({ ...regra, valor })} />
          </div>
          <div className="campo">
            <span className="rotulo">Meses em que ocorre</span>
            <div className="meses-do-ano">
              {NOMES_MESES.map((nome, i) => (
                <label key={nome}>
                  <input
                    type="checkbox"
                    checked={regra.mesesDoAno.includes(i + 1)}
                    onChange={(e) =>
                      onChange({
                        ...regra,
                        mesesDoAno: e.target.checked
                          ? [...regra.mesesDoAno, i + 1].sort((a, b) => a - b)
                          : regra.mesesDoAno.filter((m) => m !== i + 1),
                      })
                    }
                  />
                  {nome.slice(0, 3)}
                </label>
              ))}
            </div>
          </div>
          <CamposReajuste reajuste={regra.reajuste} onChange={(reajuste) => onChange({ ...regra, reajuste })} />
        </>
      );
    case "unico":
      return (
        <div className="linha-campos">
          <div className="campo">
            <label htmlFor="valor">Valor (R$)</label>
            <EntradaValor id="valor" valor={regra.valor} onChange={(valor) => onChange({ ...regra, valor })} />
          </div>
          <div className="campo">
            <label htmlFor="mes">Mês</label>
            <SeletorMes id="mes" plano={plano} valor={regra.mes} onChange={(m) => onChange({ ...regra, mes: m ?? 0 })} />
          </div>
        </div>
      );
    case "manual":
      return <p className="secundario">Os valores desta linha são digitados direto na grade, mês a mês.</p>;
    case "divida": {
      const cronograma = cronogramaDivida(regra, plano.horizonte);
      const primeira = cronograma.parcelas[regra.inicio] ?? 0;
      return (
        <>
          <div className="linha-campos">
            <div className="campo">
              <label htmlFor="saldo">Saldo devedor (R$)</label>
              <EntradaValor id="saldo" valor={regra.saldoDevedor} onChange={(saldoDevedor) => onChange({ ...regra, saldoDevedor })} />
            </div>
            <div className="campo">
              <label htmlFor="taxa">Juros ao mês (%)</label>
              <EntradaValor
                id="taxa"
                valor={Math.round(regra.taxaMensal * 1_000_000) / 10_000}
                onChange={(p) => onChange({ ...regra, taxaMensal: p / 100 })}
              />
            </div>
          </div>
          <div className="linha-campos">
            <div className="campo">
              <label htmlFor="prazo">Prazo (meses)</label>
              <EntradaValor id="prazo" valor={regra.prazo} onChange={(p) => onChange({ ...regra, prazo: Math.max(1, Math.round(p)) })} />
            </div>
            <div className="campo">
              <label htmlFor="sistema">Sistema</label>
              <select id="sistema" value={regra.sistema} onChange={(e) => onChange({ ...regra, sistema: e.target.value as "price" | "sac" })}>
                <option value="price">Price (parcela fixa)</option>
                <option value="sac">SAC (parcela decrescente)</option>
              </select>
            </div>
            <div className="campo">
              <label htmlFor="inicio">1ª parcela</label>
              <SeletorMes id="inicio" plano={plano} valor={regra.inicio} onChange={(m) => onChange({ ...regra, inicio: m ?? 0 })} />
            </div>
          </div>
          <p className="aviso">
            1ª parcela de {moeda(primeira)}. Juros pagos no horizonte: {moeda(cronograma.jurosTotais)}.{" "}
            {cronograma.mesQuitacao !== null
              ? `Quitada em ${rotuloMes(anoMesDoIndice(plano.inicio, cronograma.mesQuitacao))}.`
              : "Não termina dentro do horizonte."}
          </p>
        </>
      );
    }
  }
}

export function EditorObjeto({ plano, objeto, novo, onSalvar, onExcluir, onFechar }: Props) {
  const [rascunho, setRascunho] = useState<Objeto>(objeto);
  const ajustes = Object.keys(rascunho.ajustes ?? {}).length;
  const funcoes = FUNCOES[rascunho.bloco] ?? [];
  const total = gerarValores(rascunho.regra, plano).reduce((a, b) => a + b, 0);

  useEffect(() => {
    const fechar = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, [onFechar]);

  return (
    <div className="fundo-dialogo" onClick={onFechar}>
      <form
        className="dialogo"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-editor"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSalvar({ ...rascunho, nome: rascunho.nome.trim() || "Sem nome" });
        }}
      >
        <h2 id="titulo-editor">{novo ? "Novo objeto" : "Editar objeto"}</h2>
        <div className="campo">
          <label htmlFor="nome">Nome</label>
          <input id="nome" autoFocus value={rascunho.nome} onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })} />
        </div>
        <div className="linha-campos">
          <div className="campo">
            <label htmlFor="bloco">Bloco</label>
            <select
              id="bloco"
              value={rascunho.bloco}
              onChange={(e) => {
                const bloco = e.target.value as Bloco;
                const { funcao: _funcao, ...semFuncao } = rascunho;
                setRascunho({ ...semFuncao, bloco });
              }}
            >
              {BLOCOS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="tipo">Regra</label>
            <select
              id="tipo"
              value={rascunho.regra.tipo}
              onChange={(e) => setRascunho({ ...rascunho, regra: regraPadrao(e.target.value as Regra["tipo"], rascunho.regra, plano) })}
            >
              {Object.entries(NOMES_REGRAS).map(([tipo, nome]) => (
                <option key={tipo} value={tipo}>
                  {nome}
                </option>
              ))}
            </select>
          </div>
        </div>
        {funcoes.length > 0 && (
          <div className="campo">
            <label htmlFor="funcao">Papel no fechamento</label>
            <select
              id="funcao"
              value={rascunho.funcao ?? ""}
              onChange={(e) => {
                const { funcao: _funcao, ...semFuncao } = rascunho;
                setRascunho(e.target.value ? { ...semFuncao, funcao: e.target.value as FuncaoObjeto } : semFuncao);
              }}
            >
              <option value="">Normal</option>
              {funcoes.map((f) => (
                <option key={f.valor} value={f.valor}>
                  {f.rotulo}
                </option>
              ))}
            </select>
          </div>
        )}

        <CamposRegra regra={rascunho.regra} plano={plano} onChange={(regra) => setRascunho({ ...rascunho, regra })} />

        <p className="secundario">Total da regra no horizonte: {moeda(total)}</p>
        {ajustes > 0 && (
          <p className="aviso">
            {ajustes} mês(es) com ajuste manual prevalecem sobre a regra.{" "}
            <button type="button" className="botao" onClick={() => setRascunho({ ...rascunho, ajustes: {} })}>
              Remover ajustes
            </button>
          </p>
        )}

        <div className="acoes" style={{ marginTop: 16 }}>
          <button type="submit" className="botao primario">
            Salvar
          </button>
          <button type="button" className="botao" onClick={onFechar}>
            Cancelar
          </button>
          {!novo && (
            <button
              type="button"
              className="botao perigo"
              style={{ marginLeft: "auto" }}
              onClick={() => window.confirm(`Excluir "${objeto.nome}"?`) && onExcluir()}
            >
              Excluir
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
