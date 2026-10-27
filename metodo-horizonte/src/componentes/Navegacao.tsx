"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePlano } from "@/estado/PlanoContext";

const LINKS = [
  { href: "/", rotulo: "Painel" },
  { href: "/grade", rotulo: "Grade" },
  { href: "/importar", rotulo: "Importar planilha" },
];

export function Navegacao() {
  const caminho = usePathname();
  const { plano } = usePlano();
  return (
    <header className="cabecalho">
      <Link href="/" className="marca">
        Método <span>Horizonte</span>
      </Link>
      <nav className="nav" aria-label="Principal">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} aria-current={caminho === l.href ? "page" : undefined}>
            {l.rotulo}
          </Link>
        ))}
      </nav>
      {plano && <span className="nome-plano">{plano.nome}</span>}
    </header>
  );
}
