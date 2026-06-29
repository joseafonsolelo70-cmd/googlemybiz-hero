// SEO local score helper — safe to import on client and server.
// Returns a 0-100 health score. A LOW score = HIGH prospecting opportunity.

export interface SeoInput {
  rating?: number | null;
  totalAvaliacoes?: number | null;
  hasWebsite?: boolean;
  hasTelefone?: boolean;
}

export function calcularScoreSeo(input: SeoInput): number {
  const rating = input.rating ?? 0;
  const reviews = input.totalAvaliacoes ?? 0;

  // Rating: up to 40 points (5.0 = full)
  const ratingPts = Math.min(Math.max(rating, 0) / 5, 1) * 40;
  // Reviews: up to 35 points (100+ reviews = full)
  const reviewPts = Math.min(reviews / 100, 1) * 35;
  // Website presence: 15 points
  const websitePts = input.hasWebsite ? 15 : 0;
  // Phone presence: 10 points
  const phonePts = input.hasTelefone ? 10 : 0;

  return Math.round(ratingPts + reviewPts + websitePts + phonePts);
}

export type Oportunidade = "alta" | "media" | "baixa";

export function oportunidadeFromScore(score: number): Oportunidade {
  if (score < 50) return "alta";
  if (score < 75) return "media";
  return "baixa";
}

export const OPORTUNIDADE_LABEL: Record<Oportunidade, string> = {
  alta: "Oportunidade Alta",
  media: "Oportunidade Média",
  baixa: "Oportunidade Baixa",
};

/**
 * Lista os pontos fracos de SEO local da empresa — o que o cliente pode melhorar.
 * Quanto mais pontos, maior a oportunidade de venda.
 */
export function pontosParaMelhorar(input: SeoInput): string[] {
  const rating = input.rating ?? 0;
  const reviews = input.totalAvaliacoes ?? 0;
  const pontos: string[] = [];

  if (!input.hasWebsite) {
    pontos.push("Não tem website associado ao perfil");
  }
  if (!input.hasTelefone) {
    pontos.push("Não tem telefone visível no perfil");
  }
  if (reviews === 0) {
    pontos.push("Não tem avaliações de clientes");
  } else if (reviews < 30) {
    pontos.push(`Poucas avaliações (${reviews}) — precisa de mais prova social`);
  }
  if (rating > 0 && rating < 4) {
    pontos.push(`Rating baixo (${rating.toFixed(1)}★) — reputação a precisar de atenção`);
  } else if (rating === 0) {
    pontos.push("Sem classificação por estrelas");
  }

  return pontos;
}
