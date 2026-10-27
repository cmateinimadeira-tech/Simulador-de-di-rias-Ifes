"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Objeto, Plano } from "@/motor";
import { lerValor, novoId } from "@/componentes/formato";
import { hojeAnoMes, usePlano } from "@/estado/PlanoContext";

export default function NovoPlano() {
  const router = useRouter();
  const { plano: atual, salvar } = usePlano();
  const hoje = hojeAnoMes();
  const [form, setForm] = useState({
    nome: "Meu plano",
    inicio: `${hoje.ano}-${String(hoje.mes).padStart(2, "0")}`,
    horizonte: "48",
    saldoConta: "",
    saldoFundo: "",
    renda: "",
    aporte: "",
  });
  const campo = (chave: keyof typeof form) => ({
    id: chave,
    value: form[chave],
    onChange: (e: { target: { value: string } }) => setForm({ ...form, [chave]: e.target.value }),
  });

  const criar = () => {
    if (atual && !window.confirm(`Substituir o plano "${atual.nome}" que está aberto neste navegador?`)) return;
    const [ano, mes] = form.inicio.split("-").map(Number);
    const renda = lerValor(form.renda) ?? 0;
    const aporte = lerValor(form.aporte) ?? 0;
    const objetos: Objeto[] = [];
    if (renda > 0) objetos.push({ id: novoId("obj"), bloco: "entradas", nome: "Renda principal", regra: { tipo: "fixo", valor: renda, inicio: 0 } });
    if (aporte > 0) {
      objetos.push({ id: novoId("obj"), bloco: "planejamento", nome: "Fundo", funcao: "aporteFundo", regra: { tipo: "fixo", valor: aporte, inicio: 0 } });
    }
    const plano: Plano = {
      id: novoId("plano"),
      nome: form.nome.trim() || "Meu plano",
      inicio: { ano: ano ?? hoje.ano, mes: mes ?? hoje.mes },
      horizonte: Number(form.horizonte),
      saldoInicialConta: lerValor(form.saldoConta) ?? 0,
      saldoInicialFundo: lerValor(form.saldoFundo) ?? 0,
      taxaFundoMensal: 0,
      objetos,
    };
    salvar(plano);
    router.push("/grade");
  };

  return (
    <main className="conteudo" style={{ maxWidth: 640 }}>
      <h1>Criar plano</h1>
      <p className="secundario">Comece pelo essencial. Os gastos fixos, anuais e o cartão você completa na grade.</p>
      <form
        className="cartao"
        onSubmit={(e) => {
          e.preventDefault();
          criar();
        }}
      >
        <div className="campo">
          <label htmlFor="nome">Nome do plano</label>
          <input {...campo("nome")} />
        </div>
        <div className="linha-campos">
          <div className="campo">
            <label htmlFor="inicio">Primeiro mês</label>
            <input type="month" required {...campo("inicio")} />
          </div>
          <div className="campo">
            <label htmlFor="horizonte">Horizonte</label>
            <select {...campo("horizonte")}>
              <option value="12">12 meses</option>
              <option value="24">24 meses</option>
              <option value="36">36 meses</option>
              <option value="48">48 meses</option>
            </select>
          </div>
        </div>
        <div className="linha-campos">
          <div className="campo">
            <label htmlFor="saldoConta">Saldo hoje em conta (R$)</label>
            <input inputMode="decimal" placeholder="0" {...campo("saldoConta")} />
          </div>
          <div className="campo">
            <label htmlFor="saldoFundo">Saldo hoje do Fundo (R$)</label>
            <input inputMode="decimal" placeholder="0" {...campo("saldoFundo")} />
          </div>
        </div>
        <div className="linha-campos">
          <div className="campo">
            <label htmlFor="renda">Renda líquida mensal (R$)</label>
            <input inputMode="decimal" placeholder="ex.: 8.500" {...campo("renda")} />
          </div>
          <div className="campo">
            <label htmlFor="aporte">Aporte mensal no Fundo (R$)</label>
            <input inputMode="decimal" placeholder="ex.: 1.000" {...campo("aporte")} />
          </div>
        </div>
        <p className="secundario" style={{ fontSize: "0.85rem" }}>
          O aporte no Fundo entra como despesa obrigatória: primeiro você se paga, depois distribui o resto.
        </p>
        <button type="submit" className="botao primario">
          Criar e abrir a grade
        </button>
      </form>
    </main>
  );
}
