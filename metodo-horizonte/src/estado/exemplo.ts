import type { AnoMes, Objeto, Plano } from "@/motor";
import { indiceDoAnoMes } from "@/motor";

/** Família fictícia para demonstração. Nenhum dado real de cliente. */
export function planoExemplo(hoje: AnoMes): Plano {
  const inicio = hoje;
  const proximo = (mes: number) => {
    // índice do próximo mês do ano informado, a partir do início
    const ano = mes >= inicio.mes ? inicio.ano : inicio.ano + 1;
    return indiceDoAnoMes(inicio, { ano, mes });
  };

  const objetos: Objeto[] = [
    { id: "ex-financiamento", bloco: "fixo", nome: "Financiamento do apartamento", regra: { tipo: "decrescente", valorInicial: 2400, reducaoMensal: 7, inicio: 0 } },
    { id: "ex-condominio", bloco: "fixo", nome: "Condomínio", regra: { tipo: "fixo", valor: 620, inicio: 0, reajuste: { percentualAnual: 0.06, mesDoAno: 1 } } },
    { id: "ex-saude", bloco: "fixo", nome: "Plano de saúde", regra: { tipo: "fixo", valor: 850, inicio: 0, reajuste: { percentualAnual: 0.1, mesDoAno: 5 } } },
    { id: "ex-energia", bloco: "fixo", nome: "Energia", regra: { tipo: "fixo", valor: 380, inicio: 0 } },
    { id: "ex-internet", bloco: "fixo", nome: "Internet e celular", regra: { tipo: "fixo", valor: 190, inicio: 0 } },
    { id: "ex-escola", bloco: "fixo", nome: "Escola", regra: { tipo: "fixo", valor: 1300, inicio: 0, reajuste: { percentualAnual: 0.08, mesDoAno: 1 } } },
    { id: "ex-ipva", bloco: "anual", nome: "IPVA", regra: { tipo: "anual", valor: 2100, mesesDoAno: [3] } },
    { id: "ex-iptu", bloco: "anual", nome: "IPTU", regra: { tipo: "anual", valor: 1400, mesesDoAno: [2] } },
    { id: "ex-revisao", bloco: "anual", nome: "Revisão do carro", regra: { tipo: "anual", valor: 900, mesesDoAno: [8] } },
    { id: "ex-alimentacao", bloco: "variavel", nome: "Alimentação", regra: { tipo: "fixo", valor: 1500, inicio: 0 } },
    { id: "ex-lazer", bloco: "variavel", nome: "Fim de semana", regra: { tipo: "fixo", valor: 600, inicio: 0 } },
    { id: "ex-diarista", bloco: "variavel", nome: "Diarista", regra: { tipo: "fixo", valor: 480, inicio: 0 } },
    { id: "ex-tv", bloco: "cartaoParcelado", nome: "TV (10x)", regra: { tipo: "parcelado", parcela: 279, parcelas: 10, inicio: 0 } },
    { id: "ex-seguro", bloco: "cartaoParcelado", nome: "Seguro do carro (6x)", regra: { tipo: "parcelado", parcela: 410, parcelas: 6, inicio: proximo(6) } },
    { id: "ex-mercado", bloco: "cartaoAVista", nome: "Mercado do próximo mês", regra: { tipo: "fixo", valor: 1200, inicio: 0 } },
    { id: "ex-gasolina", bloco: "cartaoAVista", nome: "Gasolina", regra: { tipo: "fixo", valor: 550, inicio: 0 } },
    {
      id: "ex-consignado",
      bloco: "planejamento",
      nome: "Consignado",
      regra: { tipo: "divida", saldoDevedor: 18000, taxaMensal: 0.018, prazo: 30, sistema: "price", inicio: 0 },
    },
    { id: "ex-fundo", bloco: "planejamento", nome: "Fundo", funcao: "aporteFundo", regra: { tipo: "fixo", valor: 1500, inicio: 0 } },
    { id: "ex-salario-1", bloco: "entradas", nome: "Salário — pessoa 1", regra: { tipo: "fixo", valor: 9200, inicio: 0, reajuste: { percentualAnual: 0.05, mesDoAno: 1 } } },
    { id: "ex-salario-2", bloco: "entradas", nome: "Salário — pessoa 2", regra: { tipo: "fixo", valor: 5600, inicio: 0, reajuste: { percentualAnual: 0.05, mesDoAno: 1 } } },
    { id: "ex-13", bloco: "entradas", nome: "13º salário", regra: { tipo: "anual", valor: 14800, mesesDoAno: [12] } },
    { id: "ex-ferias", bloco: "entradas", nome: "1/3 de férias", regra: { tipo: "anual", valor: 4900, mesesDoAno: [1] } },
    { id: "ex-freela", bloco: "entradas", nome: "Trabalho extra", funcao: "entradaPossivel", regra: { tipo: "unico", valor: 2500, mes: 2 } },
  ];

  return {
    id: "plano-exemplo",
    nome: "Família Exemplo",
    inicio,
    horizonte: 48,
    saldoInicialConta: 3000,
    saldoInicialFundo: 12000,
    taxaFundoMensal: 0,
    objetos,
    cartoes: [
      { id: "ex-cartao-1", nome: "Cartão principal", diaFechamento: 3, diaVencimento: 10 },
      { id: "ex-cartao-2", nome: "Cartão reserva", diaFechamento: 25, diaVencimento: 2 },
    ],
    diaCorteRenda: 25,
  };
}
