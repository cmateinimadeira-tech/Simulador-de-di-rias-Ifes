"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BLOCOS, diasDesdeUltimaRevisao, mesesSemFechamento, rotuloMes, rotuloMesLongo } from "@/motor";
import type { Alerta } from "@/motor";
import { CurvaPatrimonio } from "@/componentes/CurvaPatrimonio";
import { moeda } from "@/componentes/formato";
import { planoExemplo } from "@/estado/exemplo";
import { hojeAnoMes, hojeISO, usePlano } from "@/estado/PlanoContext";

const ROTULO_GRAVIDADE: Record<Alerta["gravidade"], string> = {
  critico: "Crítico",
  atencao: "Atenção",
  informativo: "Aviso",
  positivo: "Boa notícia",
};

const ORDEM_GRAVIDADE: Record<Alerta["gravidade"], number> = { critico: 0, atencao: 1, informativo: 2, positivo: 3 };

export default function Painel() {
  const { carregado, plano, resultado, mesAtual, salvar, descartar } = usePlano();
  const [mesEscolhido, setMes] = useState(mesAtual);
  useEffect(() => setMes(mesAtual), [mesAtual, plano?.id]);

  if (!carregado) return <main className="conteudo secundario">Carregando…</main>;

  if (!plano || !resultado) {
    return (
      <main className="conteudo">
        <section className="boas-vindas">
          <h1>Veja hoje o seu patrimônio daqui a 4 anos</h1>
          <p>
            Planeje cada mês, registre o realizado e simule decisões antes de tomá-las. Comece por um destes caminhos:
          </p>
          <div className="opcoes-inicio">
            <div className="cartao">
              <h2>Criar meu plano</h2>
              <p className="secundario">Um assistente curto monta a grade com renda, Fundo e horizonte.</p>
              <Link className="botao primario" href="/novo">
                Começar
              </Link>
            </div>
            <div className="cartao">
              <h2>Importar planilha</h2>
              <p className="secundario">Traga a planilha do método (.xlsx) e confira os totais antes de salvar.</p>
              <Link className="botao" href="/importar">
                Importar
              </Link>
            </div>
            <div className="cartao">
              <h2>Explorar um exemplo</h2>
              <p className="secundario">Uma família fictícia, com financiamento, consignado e 13º.</p>
              <button className="botao" onClick={() => salvar(planoExemplo(hojeAnoMes()))}>
                Abrir exemplo
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const n = plano.horizonte;
  const mes = Math.min(Math.max(mesEscolhido, 0), n - 1);
  const am = resultado.meses[mes]!;
  const ultimo = resultado.meses[n - 1]!;
  const saldo = resultado.saldo[mes]!;
  const conservador = resultado.saldoConservador[mes]!;
  const pendentes = mesesSemFechamento(plano, mesAtual).slice(-3);
  const diasRevisao = diasDesdeUltimaRevisao(plano, hojeISO());
  const revisaoAtrasada = !plano.fechamentos?.[mesAtual] && (diasRevisao === null || diasRevisao >= 7);
  const saldoPrevisto = resultado.saldoPrevisto[mes]!;
  const saldoOriginal = resultado.saldoOriginal[mes] ?? null;
  const alertas = resultado.alertas
    .filter((a) => a.mes >= mesAtual && a.mes < mesAtual + 12)
    .sort((a, b) => ORDEM_GRAVIDADE[a.gravidade] - ORDEM_GRAVIDADE[b.gravidade] || a.mes - b.mes)
    .slice(0, 8);

  return (
    <main className="conteudo">
      <div className="acoes" style={{ justifyContent: "space-between" }}>
        <div>
          <h1>{plano.nome}</h1>
          <span className="secundario">
            Horizonte de {n} meses: {rotuloMesLongo(plano.inicio)} a {rotuloMesLongo(ultimo)}
          </span>
        </div>
        <div className="seletor-mes" aria-label="Mês exibido">
          <button className="botao" onClick={() => setMes(Math.max(0, mes - 1))} disabled={mes === 0} aria-label="Mês anterior">
            ‹
          </button>
          <strong>{rotuloMesLongo(am)}</strong>
          <button className="botao" onClick={() => setMes(Math.min(n - 1, mes + 1))} disabled={mes === n - 1} aria-label="Próximo mês">
            ›
          </button>
        </div>
      </div>

      {pendentes.length > 0 && (
        <div className="aviso faixa-pendente">
          <span>
            {pendentes.length === 1 ? "Mês sem fechamento:" : "Meses sem fechamento:"} feche para o plano partir do saldo real.
          </span>
          {pendentes.map((m) => (
            <Link key={m} className="botao" href={`/mes?m=${m}`}>
              Fechar {rotuloMes(resultado.meses[m]!)}
            </Link>
          ))}
        </div>
      )}

      {revisaoAtrasada && (
        <div className="aviso faixa-pendente">
          <span>
            {diasRevisao === null ? "Nenhuma revisão registrada ainda." : `A última revisão foi há ${diasRevisao} dias.`} Lance os pagamentos da
            semana e registre o retrato do mês.
          </span>
          <Link className="botao" href="/mes">
            Fazer a revisão da semana
          </Link>
        </div>
      )}

      <div className="grade-cartoes">
        <div className="cartao indicador">
          <div className="rotulo">Saldo do mês (retrato atual)</div>
          <div className={`valor ${saldo < 0 ? "negativo" : ""}`}>{moeda(saldo)}</div>
          {Math.abs(saldo - saldoPrevisto) > 0.5 && <div className="detalhe">Previsto: {moeda(saldoPrevisto)}</div>}
          {saldoOriginal !== null && Math.abs(saldoOriginal - saldo) > 0.5 && <div className="detalhe">Original: {moeda(saldoOriginal)}</div>}
          {Math.abs(conservador - saldo) > 0.5 && <div className="detalhe">Sem entradas possíveis: {moeda(conservador)}</div>}
        </div>
        <div className="cartao indicador">
          <div className="rotulo">Acumulado em conta</div>
          <div className={`valor ${resultado.acumulado[mes]! < 0 ? "negativo" : ""}`}>{moeda(resultado.acumulado[mes]!)}</div>
          <div className="detalhe">Menor do horizonte: {moeda(resultado.resumo.menorAcumulado.valor)} em {rotuloMes(resultado.meses[resultado.resumo.menorAcumulado.mes]!)}</div>
        </div>
        <div className="cartao indicador">
          <div className="rotulo">Fundo</div>
          <div className="valor">{moeda(resultado.fundo[mes]!)}</div>
          <div className="detalhe">Aporte do mês: {moeda(resultado.aportes[mes]!)}</div>
        </div>
        <div className="cartao indicador">
          <div className="rotulo">Patrimônio em {rotuloMes(ultimo)}</div>
          <div className={`valor ${resultado.resumo.patrimonioFinal < 0 ? "negativo" : "positivo"}`}>{moeda(resultado.resumo.patrimonioFinal)}</div>
          <div className="detalhe">Fundo + acumulado − saldo das dívidas</div>
        </div>
      </div>

      <section className="cartao">
        <h2>Patrimônio projetado</h2>
        <CurvaPatrimonio resultado={resultado} mesAtual={mesAtual} />
      </section>

      <div className="duas-colunas">
        <section className="cartao">
          <h2>Alertas dos próximos 12 meses</h2>
          {alertas.length === 0 ? (
            <p className="secundario">Nenhum alerta. O plano se sustenta nos próximos 12 meses.</p>
          ) : (
            <ul className="lista-alertas">
              {alertas.map((a, i) => (
                <li key={`${a.tipo}-${a.mes}-${a.objetoId ?? i}`}>
                  <span className={`selo ${a.gravidade}`}>{ROTULO_GRAVIDADE[a.gravidade]}</span>
                  <span>
                    <strong>{rotuloMes(resultado.meses[a.mes]!)}</strong> — {a.mensagem}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="cartao">
          <h2>{rotuloMesLongo(am)} por bloco</h2>
          <table className="simples">
            <tbody>
              {BLOCOS.map((b) => (
                <tr key={b.id}>
                  <td>{b.nome}</td>
                  <td className="num">{moeda(resultado.totaisPorBloco[b.id][mes]!)}</td>
                </tr>
              ))}
              <tr>
                <td>
                  <strong>Saldo</strong>
                </td>
                <td className={`num ${saldo < 0 ? "negativo" : ""}`}>
                  <strong>{moeda(saldo)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
          <div className="acoes" style={{ marginTop: 12 }}>
            <Link className="botao" href="/mes">
              Lançar no mês
            </Link>
            <Link className="botao" href="/grade">
              Abrir a grade
            </Link>
          </div>
        </section>
      </div>

      <div className="acoes" style={{ marginTop: 24 }}>
        <button
          className="botao perigo"
          onClick={() => {
            if (window.confirm("Descartar este plano do navegador? Esta ação não pode ser desfeita.")) descartar();
          }}
        >
          Descartar plano
        </button>
      </div>
    </main>
  );
}
