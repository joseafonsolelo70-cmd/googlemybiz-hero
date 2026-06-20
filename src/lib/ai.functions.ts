import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

interface AbordagemInput {
  leadId: string;
  canal: "whatsapp" | "email";
}

const SYSTEM_PROMPT = `Você é um especialista em vendas de serviços de Google Meu Negócio (GMN) e SEO local.
Escreva uma abordagem comercial curta, simpática e persuasiva em português de Portugal/Brasil neutro.
Use o nome da empresa e cite oportunidades reais com base nos dados (avaliações, rating, presença online).
Não invente factos. Seja consultivo, não agressivo. Termine com uma chamada à ação suave.`;

export const gerarAbordagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: AbordagemInput) => {
    if (!data?.leadId) throw new Error("Lead inválido.");
    return { leadId: data.leadId, canal: data.canal === "email" ? "email" : "whatsapp" };
  })
  .handler(async ({ data, context }): Promise<{ texto: string }> => {
    const { supabase, userId } = context;

    const { data: lead, error } = await supabase
      .from("leads")
      .select("nome_empresa, rating, total_avaliacoes, score_seo, website, nicho, cidade, telefone")
      .eq("id", data.leadId)
      .single();

    if (error || !lead) throw new Error("Lead não encontrado.");

    const { data: profile } = await supabase
      .from("profiles")
      .select("openai_api_key")
      .eq("id", userId)
      .single();

    const canalLabel = data.canal === "email" ? "e-mail" : "WhatsApp";
    const userPrompt = `Gere uma mensagem para ${canalLabel}.
Dados da empresa:
- Nome: ${lead.nome_empresa}
- Nicho: ${lead.nicho ?? "n/d"}
- Cidade: ${lead.cidade ?? "n/d"}
- Rating no Google: ${lead.rating ?? "sem rating"}
- Total de avaliações: ${lead.total_avaliacoes ?? 0}
- Tem website: ${lead.website ? "sim" : "não"}
- Score SEO local (0-100): ${lead.score_seo ?? 0}

${data.canal === "email" ? "Inclua uma linha de assunto na primeira linha." : "Mensagem direta de WhatsApp, com emojis moderados."}`;

    const openaiKey = profile?.openai_api_key;

    // Prefer the user's OpenAI key; otherwise fall back to Lovable AI.
    if (openaiKey) {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.8,
        }),
      });
      if (!r.ok) {
        const body = await r.text();
        console.error("OpenAI error", r.status, body);
        throw new Error("Falha ao gerar abordagem com a OpenAI. Verifique a sua chave.");
      }
      const j = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
      return { texto: j.choices?.[0]?.message?.content?.trim() ?? "" };
    }

    const lovableKey = process.env.LOVABLE_API_KEY;
    if (!lovableKey) {
      throw new Error("Configure a sua chave da OpenAI em Configurações para gerar abordagens.");
    }

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!r.ok) {
      const body = await r.text();
      console.error("Lovable AI error", r.status, body);
      if (r.status === 429) throw new Error("Limite de pedidos atingido. Tente novamente em instantes.");
      if (r.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos ou configure a sua chave OpenAI.");
      throw new Error("Falha ao gerar abordagem. Tente novamente.");
    }

    const j = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return { texto: j.choices?.[0]?.message?.content?.trim() ?? "" };
  });
