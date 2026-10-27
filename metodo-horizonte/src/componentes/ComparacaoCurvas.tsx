"use client";

import { useEffect, useRef, useState } from "react";
import { rotuloMes } from "@/motor";
import type { AnoMes } from "@/motor";
import { moeda, moedaCurta, passoDaEscala } from "./formato";

export interface Serie {
  id: string;
  nome: string;
  valores: number[];
}

interface Props {
  series: Serie[];
  meses: AnoMes[];
  mesAtual: number;
}

const A = 280;
const ESQ = 70;
const DIR = 16;
const TOPO = 16;
const BASE = 240;

/** Cor da série: a primeira (plano atual) é o acento; as demais, cores de cenário. */
export const corDaSerie = (i: number) => `var(--serie-${Math.min(i, 3)})`;

/** Curvas de patrimônio sobrepostas: plano atual e cenários. */
export function ComparacaoCurvas({ series, meses, mesAtual }: Props) {
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

  const n = meses.length;
  if (n < 2 || series.length === 0) return null;

  const todos = series.flatMap((s) => s.valores);
  const minimo = Math.min(0, ...todos);
  const maximo = Math.max(1, ...todos);
  const passo = passoDaEscala((maximo - minimo) / 4);
  const yMin = Math.floor(minimo / passo) * passo;
  const yMax = Math.ceil(maximo / passo) * passo;
  const x = (m: number) => ESQ + (m / (n - 1)) * (L - ESQ - DIR);
  const y = (v: number) => BASE - ((v - yMin) / (yMax - yMin)) * (BASE - TOPO);
  const linha = (valores: number[]) => valores.map((v, m) => `${m === 0 ? "M" : "L"}${x(m).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const marcas: number[] = [];
  for (let v = yMin; v <= yMax + passo / 2; v += passo) marcas.push(v);
  const janeiros = meses.flatMap((am, m) => (am.mes === 1 ? [m] : []));
  const rotulosX = L < 520 ? janeiros.filter((_, i) => i % 2 === 0) : janeiros;
  const largura = (L - ESQ - DIR) / (n - 1);

  return (
    <figure ref={caixa} style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label="Patrimônio do plano atual e dos cenários" style={{ width: "100%", height: "auto" }}>
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
        <line x1={x(mesAtual)} x2={x(mesAtual)} y1={TOPO} y2={BASE} stroke="var(--texto-2)" strokeDasharray="4 4" strokeOpacity="0.5" />
        {series.map((s, i) => (
          <path
            key={s.id}
            d={linha(s.valores)}
            fill="none"
            stroke={corDaSerie(i)}
            strokeWidth={i === 0 ? 2.5 : 2}
            strokeDasharray={i === 0 ? undefined : "6 3"}
          />
        ))}
        {meses.map((am, m) => (
          <rect key={m} x={x(m) - largura / 2} y={TOPO} width={largura} height={BASE - TOPO} fill="transparent">
            <title>{[rotuloMes(am), ...series.map((s) => `${s.nome}: ${moeda(s.valores[m] ?? 0)}`)].join("\n")}</title>
          </rect>
        ))}
      </svg>
      <figcaption className="legenda">
        {series.map((s, i) => (
          <span key={s.id}>
            <i
              style={{
                background:
                  i === 0 ? corDaSerie(i) : `repeating-linear-gradient(90deg, ${corDaSerie(i)} 0 6px, transparent 6px 9px)`,
              }}
            />
            {s.nome}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
