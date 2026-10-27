"use client";

import { useEffect, useRef, useState } from "react";
import { rotuloMes } from "@/motor";
import type { ResultadoPlano } from "@/motor";
import { moeda, moedaCurta } from "./formato";

interface Props {
  resultado: ResultadoPlano;
  mesAtual: number;
}

const A = 280;
const ESQ = 70;
const DIR = 16;
const TOPO = 16;
const BASE = 240;

/** Curva do patrimônio projetado, com Fundo e acumulado em cinza para conferência. */
export function CurvaPatrimonio({ resultado, mesAtual }: Props) {
  // A largura do desenho acompanha a do contêiner, para o texto manter o tamanho real no celular.
  const caixa = useRef<HTMLElement>(null);
  const [L, setL] = useState(800);
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const medir = () => setL(Math.max(320, Math.round(el.clientWidth)));
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const { patrimonio, fundo, acumulado, meses } = resultado;
  const n = meses.length;
  if (n < 2) return null;

  const todos = [...patrimonio, ...fundo, ...acumulado];
  const minimo = Math.min(0, ...todos);
  const maximo = Math.max(1, ...todos);
  const passo = escolherPasso((maximo - minimo) / 4);
  const yMin = Math.floor(minimo / passo) * passo;
  const yMax = Math.ceil(maximo / passo) * passo;

  const x = (m: number) => ESQ + (m / (n - 1)) * (L - ESQ - DIR);
  const y = (v: number) => BASE - ((v - yMin) / (yMax - yMin)) * (BASE - TOPO);
  const linha = (serie: number[]) => serie.map((v, m) => `${m === 0 ? "M" : "L"}${x(m).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");

  const marcas: number[] = [];
  for (let v = yMin; v <= yMax + passo / 2; v += passo) marcas.push(v);
  const janeiros = meses.flatMap((am, m) => (am.mes === 1 ? [m] : []));
  // No celular, rótulo só a cada dois anos para não sobrepor.
  const rotulosX = L < 520 ? janeiros.filter((_, i) => i % 2 === 0) : janeiros;
  const largura = (L - ESQ - DIR) / (n - 1);

  return (
    <figure ref={caixa} style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label="Patrimônio projetado mês a mês" style={{ width: "100%", height: "auto" }}>
        {marcas.map((v) => (
          <g key={v}>
            <line x1={ESQ} x2={L - DIR} y1={y(v)} y2={y(v)} stroke="var(--borda)" strokeWidth={v === 0 ? 1.5 : 1} />
            <text x={ESQ - 8} y={y(v) + 4} textAnchor="end" fontSize="12" fill="var(--texto-2)">
              {moedaCurta(v)}
            </text>
          </g>
        ))}
        {rotulosX.map((m) => (
          <text key={m} x={x(m)} y={BASE + 20} textAnchor="middle" fontSize="12" fill="var(--texto-2)">
            {rotuloMes(meses[m]!)}
          </text>
        ))}
        <line x1={x(mesAtual)} x2={x(mesAtual)} y1={TOPO} y2={BASE} stroke="var(--acento)" strokeDasharray="4 4" strokeOpacity="0.6" />
        <text x={x(mesAtual) + 4} y={TOPO + 10} fontSize="11" fill="var(--acento)">
          hoje
        </text>
        <path d={linha(fundo)} fill="none" stroke="var(--cinza-grafico)" strokeWidth="1.5" strokeDasharray="5 3" />
        <path d={linha(acumulado)} fill="none" stroke="var(--cinza-grafico)" strokeWidth="1.5" />
        <path d={linha(patrimonio)} fill="none" stroke="var(--acento)" strokeWidth="2.5" />
        {meses.map((am, m) => (
          <rect key={m} x={x(m) - largura / 2} y={TOPO} width={largura} height={BASE - TOPO} fill="transparent">
            <title>
              {`${rotuloMes(am)} — patrimônio ${moeda(patrimonio[m]!)}; Fundo ${moeda(fundo[m]!)}; acumulado ${moeda(acumulado[m]!)}`}
            </title>
          </rect>
        ))}
      </svg>
      <figcaption className="legenda">
        <span>
          <i style={{ background: "var(--acento)" }} />
          Patrimônio (Fundo + acumulado − dívidas)
        </span>
        <span>
          <i style={{ background: "var(--cinza-grafico)" }} />
          Acumulado em conta
        </span>
        <span>
          <i style={{ background: "repeating-linear-gradient(90deg, var(--cinza-grafico) 0 5px, transparent 5px 8px)" }} />
          Fundo
        </span>
      </figcaption>
    </figure>
  );
}

function escolherPasso(bruto: number): number {
  const potencia = Math.pow(10, Math.floor(Math.log10(Math.max(bruto, 1))));
  for (const f of [1, 2, 2.5, 5, 10]) if (bruto <= f * potencia) return f * potencia;
  return 10 * potencia;
}
