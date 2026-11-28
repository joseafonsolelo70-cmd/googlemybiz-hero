import type { Tables } from "@/integrations/supabase/types";

export type Lead = Tables<"leads">;
export type Temperatura = "frio" | "morno" | "quente";

export interface CommercialScoreInput {
  scoreSeo?: number | null;
  rating?: number | null;
  totalAvaliacoes?: number | null;
  hasWebsite?: boolean;
  hasTelefone?: boolean;
  hasWhatsapp?: boolean;
  hasDecisionMaker?: boolean;
  hasEmail?: boolean;
  niche?: string | null;
  status?: string | null;
  tentativas?: number | null;
  lastInteractionAt?: string | null;
}

export function calcularScoreComercial(input: CommercialScoreInput): number {
  let score = 20;
  const reviews = input.totalAvaliacoes ?? 0;
  const rating = input.rating ?? 0;

  if (input.hasWebsite) score += 8;
  else score += 12;
  if (input.hasTelefone) score += 8;
  if (input.hasWhatsapp) score += 10;
  if (input.hasDecisionMaker) score += 12;
  if (input.hasEmail) score += 8;
  if (reviews >= 100) score += 12;
  else if (reviews >= 30) score += 8;
  else if (reviews > 0) score += 4;
  if (rating >= 4.5) score += 8;
  else if (rating >= 4) score += 4;
  if (input.niche && /clínica|dent|imobili|advoc|consult|hotel|restaur|estética|constru|arquitet|contab/i.test(input.niche)) score += 8;
  if (input.status === "contato") score += 5;
  if (input.status === "proposta") score += 10;
  if (input.status === "fechado" || input.status === "perdido") score -= 20;
  if ((input.tentativas ?? 0) >= 3) score -= 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function temperaturaFromLead(lead: Pick<Lead, "status_funil" | "proximo_followup" | "tentativas_contacto" | "score_comercial">): Temperatura {
  if (lead.status_funil === "proposta" || lead.status_funil === "fechado") return "quente";
  if (lead.status_funil === "contato" || (lead.proximo_followup && new Date(lead.proximo_followup) <= new Date()) || lead.score_comercial >= 70) return "morno";
  return "frio";
}

export function calcularScorePrioridade(input: { scoreSeo?: number | null; scoreComercial?: number | null; temperatura?: Temperatura; proximoFollowup?: string | null; status?: string | null }): number {
  const seo = input.scoreSeo ?? 0;
  const comercial = input.scoreComercial ?? 0;
  let score = Math.round(seo * 0.35 + comercial * 0.65);
  if (input.temperatura === "quente") score += 12;
  if (input.temperatura === "morno") score += 5;
  if (input.proximoFollowup && new Date(input.proximoFollowup) <= new Date()) score += 15;
  if (input.status === "perdido" || input.status === "fechado") score -= 30;
  return Math.max(0, Math.min(100, score));
}

export function proximaAcaoDoLead(lead: Pick<Lead, "status_funil" | "proximo_followup" | "tentativas_contacto" | "abordagem_ia" | "ultima_interacao_at" | "reuniao_at">): string {
  if (lead.status_funil === "fechado") return "Confirmar próximos passos e pedir indicação";
  if (lead.status_funil === "perdido") return "Reativar numa nova campanha";
  if (lead.reuniao_at) return "Preparar e realizar reunião";
  if (lead.status_funil === "proposta") return "Fazer follow-up da proposta";
  if (lead.proximo_followup && new Date(lead.proximo_followup) <= new Date()) return "Enviar follow-up agora";
  if (lead.status_funil === "contato") return lead.tentativas_contacto >= 3 ? "Tentar chamada ou novo ângulo" : "Enviar próximo follow-up";
  if (!lead.abordagem_ia) return "Gerar e enviar primeira abordagem";
  if (!lead.ultima_interacao_at) return "Registar o primeiro contacto";
  return "Agendar próximo follow-up";
}

export function prioridadeLabel(score: number): string {
  if (score >= 80) return "Prioridade máxima";
  if (score >= 60) return "Prioridade alta";
  if (score >= 35) return "Prioridade média";
  return "Prioridade baixa";
}

export function temperaturaLabel(temperatura: string): string {
  return temperatura === "quente" ? "Quente" : temperatura === "morno" ? "Morno" : "Frio";
}

export function exportarLeadsCsv(leads: Lead[]): string {
  const headers = ["Empresa", "Nicho", "Cidade", "Telefone", "Website", "Score SEO", "Score comercial", "Prioridade", "Temperatura", "Estado", "Próxima ação", "Follow-up"];
  const rows = leads.map((l) => [l.nome_empresa, l.nicho, l.cidade, l.telefone, l.website, l.score_seo, l.score_comercial, l.score_prioridade, l.temperatura, l.status_funil, l.proxima_acao, l.proximo_followup]);
  const cell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [headers, ...rows].map((row) => row.map(cell).join(",")).join("\n");
}
