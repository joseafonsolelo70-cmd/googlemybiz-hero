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
