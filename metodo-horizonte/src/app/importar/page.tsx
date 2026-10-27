"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BLOCOS, rotuloMesLongo, anoMesDoIndice } from "@/motor";
import type { ResultadoImportacao } from "@/importador/planilha";
import { moeda } from "@/componentes/formato";
import { hojeAnoMes, usePlano } from "@/estado/PlanoContext";

const NOME_LINHA = { saldo: "Saldo", acumulado: "Acumulado", fundo: "Fundo" } as const;

export default function Importar() {
  const router = useRouter();
  const { plano: atual, salvar } = usePlano();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [anoInicial, setAnoInicial] = useState(String(hojeAnoMes().ano));
  const [reservaSaiDoFundo, setReserva] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [importacao, setImportacao] = useState<ResultadoImportacao | null>(null);

  const ler = async () => {
    if (!arquivo) return;
    setLendo(true);
    setErro(null);
    setImportacao(null);
    try {
      const { importarXlsx } = await import("@/importador/xlsx");
      const nomePlano = arquivo.name.replace(/\.xlsx$/i, "");
      setImportacao(await importarXlsx(await arquivo.arrayBuffer(), { anoInicial: Number(anoInicial), reservaSaiDoFundo, nomePlano }));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui ler o arquivo.");
    } finally {
      setLendo(false);
    }
  };

  const usar = () => {
    if (!importacao) return;
    if (atual && !window.confirm(`Substituir o plano "${atual.nome}" que está aberto neste navegador?`)) return;
    salvar(importacao.plano);
    router.push("/");
  };

  const relatorio = importacao?.relatorio;
  return (
    <main className="conteudo" style={{ maxWidth: 880 }}>
      <h1>Importar planilha do método</h1>
      <p className="secundario">
        O arquivo é lido no seu navegador e não é enviado a nenhum servidor. Antes de salvar, o sistema recalcula o plano e confere com as
        linhas Saldo, Acumulado e Fundo da planilha.
      </p>

      <form
        className="cartao"
        onSubmit={(e) => {
          e.preventDefault();
          void ler();
        }}
      >
        <div className="campo">
          <label htmlFor="arquivo">Planilha (.xlsx)</label>
          <input
            id="arquivo"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="linha-campos">
          <div className="campo">
            <label htmlFor="ano">Ano do primeiro mês da planilha</label>
            <input id="ano" type="number" min="2000" max="2100" value={anoInicial} onChange={(e) => setAnoInicial(e.target.value)} />
          </div>
          <div className="campo">
            <span className="rotulo">Linha &quot;Reserva&quot; das entradas</span>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={reservaSaiDoFundo} onChange={(e) => setReserva(e.target.checked)} />
              O dinheiro saiu do Fundo (resgate)
            </label>
          </div>
        </div>
        <button type="submit" className="botao primario" disabled={!arquivo || lendo}>
          {lendo ? "Lendo…" : "Ler e conferir"}
        </button>
      </form>

      {erro && <p className="aviso erro">{erro}</p>}

      {importacao && relatorio && (
        <section className="cartao" style={{ marginTop: 16 }}>
          <h2>Relatório de conferência</h2>
          <p>
            Aba <strong>{relatorio.aba}</strong>: {relatorio.horizonte} meses, de {rotuloMesLongo(relatorio.inicio)} a{" "}
            {rotuloMesLongo(anoMesDoIndice(relatorio.inicio, relatorio.horizonte - 1))}, com {importacao.plano.objetos.length} objetos.
          </p>

          {relatorio.conferidas.length === 0 ? (
            <p className="aviso">A planilha não tem as linhas Saldo, Acumulado e Fundo; não foi possível conferir os totais.</p>
          ) : relatorio.divergencias.length === 0 ? (
            <p className="aviso sucesso">
              Os totais conferem com a planilha em todos os meses ({relatorio.conferidas.map((l) => NOME_LINHA[l]).join(", ")}).
            </p>
          ) : (
            <>
              <p className="aviso erro">
                {relatorio.divergencias.length} diferença(s) acima de R$ 1,00 entre a planilha e o sistema. Veja os primeiros meses abaixo.
              </p>
              <table className="simples">
                <thead>
                  <tr>
                    <th>Linha</th>
                    <th>Mês</th>
                    <th className="num">Planilha</th>
                    <th className="num">Sistema</th>
                  </tr>
                </thead>
                <tbody>
                  {relatorio.divergencias.slice(0, 12).map((d) => (
                    <tr key={`${d.linha}-${d.mes}`}>
                      <td>{NOME_LINHA[d.linha]}</td>
                      <td>{d.rotulo}</td>
                      <td className="num">{moeda(d.planilha)}</td>
                      <td className="num">{moeda(d.sistema)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div className="duas-colunas">
            <div>
              <h3>Objetos por bloco</h3>
              <table className="simples">
                <tbody>
                  {BLOCOS.map((b) => (
                    <tr key={b.id}>
                      <td>{b.nome}</td>
                      <td className="num">{relatorio.objetosPorBloco[b.id]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h3>No último mês</h3>
              <table className="simples">
                <thead>
                  <tr>
                    <th />
                    <th className="num">Planilha</th>
                    <th className="num">Sistema</th>
                  </tr>
                </thead>
                <tbody>
                  {(["acumulado", "fundo"] as const).map((l) => (
                    <tr key={l}>
                      <td>{NOME_LINHA[l]}</td>
                      <td className="num">{relatorio.finalPlanilha[l] !== undefined ? moeda(relatorio.finalPlanilha[l]!) : "—"}</td>
                      <td className="num">{moeda(relatorio.finalSistema[l])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {relatorio.avisos.length > 0 && (
            <>
              <h3 style={{ marginTop: 16 }}>Pontos para revisar</h3>
              {relatorio.avisos.map((a) => (
                <p key={a} className="aviso">
                  {a}
                </p>
              ))}
            </>
          )}

          <div className="acoes" style={{ marginTop: 16 }}>
            <button className="botao primario" onClick={usar}>
              Usar este plano
            </button>
            <span className="secundario">O plano fica salvo neste navegador.</span>
          </div>
        </section>
      )}
    </main>
  );
}
