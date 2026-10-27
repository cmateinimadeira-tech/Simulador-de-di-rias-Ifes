"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Cartao, Plano } from "@/motor";
import { lerValor, novoId } from "@/componentes/formato";
import { gerarBackup, lerBackup } from "@/estado/armazenamento";
import { hojeISO, usePlano } from "@/estado/PlanoContext";

function baixar(nome: string, conteudo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

const numero = (texto: string, padrao = 0) => lerValor(texto) ?? padrao;
const dia = (texto: string) => Math.min(31, Math.max(1, Math.round(numero(texto, 1))));

function FormularioPlano({ plano, onSalvar }: { plano: Plano; onSalvar: (p: Plano) => void }) {
  const [f, setF] = useState({
    nome: plano.nome,
    saldoConta: String(plano.saldoInicialConta).replace(".", ","),
    saldoFundo: String(plano.saldoInicialFundo).replace(".", ","),
    taxa: String(Math.round(plano.taxaFundoMensal * 1_000_000) / 10_000).replace(".", ","),
    corte: plano.diaCorteRenda ? String(plano.diaCorteRenda) : "",
  });
  const [salvo, setSalvo] = useState(false);
  const campo = (chave: keyof typeof f) => ({
    id: chave,
    value: f[chave],
    onChange: (e: { target: { value: string } }) => {
      setF({ ...f, [chave]: e.target.value });
      setSalvo(false);
    },
  });

  return (
    <form
      className="cartao"
      onSubmit={(e) => {
        e.preventDefault();
        const { diaCorteRenda: _antigo, ...resto } = plano;
        onSalvar({
          ...resto,
          nome: f.nome.trim() || plano.nome,
          saldoInicialConta: numero(f.saldoConta),
          saldoInicialFundo: numero(f.saldoFundo),
          taxaFundoMensal: numero(f.taxa) / 100,
          ...(f.corte.trim() && { diaCorteRenda: dia(f.corte) }),
        });
        setSalvo(true);
      }}
    >
      <h2>Plano</h2>
      <div className="campo">
        <label htmlFor="nome">Nome</label>
        <input {...campo("nome")} />
      </div>
      <div className="linha-campos">
        <div className="campo">
          <label htmlFor="saldoConta">Saldo inicial em conta (R$)</label>
          <input inputMode="decimal" {...campo("saldoConta")} />
        </div>
        <div className="campo">
          <label htmlFor="saldoFundo">Saldo inicial do Fundo (R$)</label>
          <input inputMode="decimal" {...campo("saldoFundo")} />
        </div>
      </div>
      <div className="linha-campos">
        <div className="campo">
          <label htmlFor="taxa">Rendimento do Fundo (% ao mês)</label>
          <input inputMode="decimal" {...campo("taxa")} />
        </div>
        <div className="campo">
          <label htmlFor="corte">Dia de corte da renda</label>
          <input inputMode="numeric" placeholder="ex.: 25" {...campo("corte")} />
        </div>
      </div>
      <p className="secundario" style={{ fontSize: "0.85rem" }}>
        Rendimento 0% repete a planilha (projeção conservadora). Com dia de corte 25, o salário recebido a partir do dia 25 conta para o mês
        seguinte.
      </p>
      <div className="acoes">
        <button type="submit" className="botao primario">
          Salvar
        </button>
        {salvo && <span className="positivo">Salvo.</span>}
      </div>
    </form>
  );
}

function Cartoes({ cartoes, onAlterar }: { cartoes: Cartao[]; onAlterar: (c: Cartao[]) => void }) {
  const [novo, setNovo] = useState({ nome: "", fechamento: "", vencimento: "" });
  return (
    <section className="cartao">
      <h2>Cartões de crédito</h2>
      <p className="secundario" style={{ fontSize: "0.9rem" }}>
        Compras a partir do dia de fechamento vão para a fatura seguinte. O gasto entra no mês em que a fatura vence.
      </p>
      {cartoes.length > 0 && (
        <table className="simples" style={{ marginBottom: 12 }}>
          <thead>
            <tr>
              <th>Cartão</th>
              <th className="num">Fecha dia</th>
              <th className="num">Vence dia</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {cartoes.map((c) => (
              <tr key={c.id}>
                <td>{c.nome}</td>
                <td className="num">{c.diaFechamento}</td>
                <td className="num">{c.diaVencimento}</td>
                <td className="num">
                  <button className="botao perigo" onClick={() => onAlterar(cartoes.filter((x) => x.id !== c.id))} aria-label={`Remover ${c.nome}`}>
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!novo.nome.trim() || !novo.fechamento || !novo.vencimento) return;
          onAlterar([...cartoes, { id: novoId("car"), nome: novo.nome.trim(), diaFechamento: dia(novo.fechamento), diaVencimento: dia(novo.vencimento) }]);
          setNovo({ nome: "", fechamento: "", vencimento: "" });
        }}
      >
        <div className="linha-campos">
          <div className="campo">
            <label htmlFor="cartao-nome">Nome do cartão</label>
            <input id="cartao-nome" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
          </div>
          <div className="campo">
            <label htmlFor="cartao-fechamento">Dia do fechamento</label>
            <input id="cartao-fechamento" inputMode="numeric" value={novo.fechamento} onChange={(e) => setNovo({ ...novo, fechamento: e.target.value })} />
          </div>
          <div className="campo">
            <label htmlFor="cartao-vencimento">Dia do vencimento</label>
            <input id="cartao-vencimento" inputMode="numeric" value={novo.vencimento} onChange={(e) => setNovo({ ...novo, vencimento: e.target.value })} />
          </div>
        </div>
        <button type="submit" className="botao">
          Adicionar cartão
        </button>
      </form>
    </section>
  );
}

export default function Conta() {
  const router = useRouter();
  const { carregado, plano, salvar, atualizar, descartar } = usePlano();
  const [mensagem, setMensagem] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);

  if (!carregado) return <main className="conteudo secundario">Carregando…</main>;

  const restaurar = async (arquivo: File) => {
    try {
      const restaurado = lerBackup(await arquivo.text());
      if (plano && !window.confirm(`Substituir o plano "${plano.nome}" pelo do backup "${restaurado.nome}"?`)) return;
      salvar(restaurado);
      setMensagem({ tipo: "sucesso", texto: `Backup "${restaurado.nome}" restaurado.` });
    } catch (e) {
      setMensagem({ tipo: "erro", texto: e instanceof Error ? e.message : "Não consegui ler o backup." });
    }
  };

  return (
    <main className="conteudo" style={{ maxWidth: 760, display: "grid", gap: 12 }}>
      <h1>Conta e configurações</h1>
      {plano ? (
        <>
          <FormularioPlano key={plano.id} plano={plano} onSalvar={(p) => atualizar(() => p)} />
          <Cartoes cartoes={plano.cartoes ?? []} onAlterar={(cartoes) => atualizar((p) => ({ ...p, cartoes }))} />
        </>
      ) : (
        <p className="cartao">
          Nenhum plano aberto. <Link href="/">Crie, importe ou abra o exemplo</Link>, ou restaure um backup abaixo.
        </p>
      )}

      <section className="cartao">
        <h2>Seus dados</h2>
        <p className="secundario" style={{ fontSize: "0.9rem" }}>
          Nesta versão o plano fica salvo só neste navegador. Faça backup com frequência: o arquivo serve para restaurar o plano aqui ou em
          outro aparelho.
        </p>
        <div className="acoes">
          <button
            className="botao"
            disabled={!plano}
            onClick={() => plano && baixar(`metodo-horizonte-backup-${hojeISO()}.json`, JSON.stringify(gerarBackup(plano), null, 2))}
          >
            Baixar backup
          </button>
          <label className="botao">
            Restaurar backup
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                e.target.value = "";
                if (arquivo) void restaurar(arquivo);
              }}
            />
          </label>
          <button
            className="botao perigo"
            disabled={!plano}
            onClick={() => {
              if (window.confirm("Excluir todos os dados do plano deste navegador? Baixe um backup antes se quiser guardá-los.")) {
                descartar();
                router.push("/");
              }
            }}
          >
            Excluir meus dados
          </button>
        </div>
        {mensagem && <p className={`aviso ${mensagem.tipo}`}>{mensagem.texto}</p>}
      </section>
    </main>
  );
}
