import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

interface AbordagemInput {
  leadId: string;
  canal: "whatsapp" | "email";
}

const GEMINI_MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT = (vendedor: string, empresa: string) => `Você é um especialista em vendas de serviços de Google Meu Negócio (GMN) e SEO local, a representar a empresa ${empresa} em nome de ${vendedor}.
Escreva uma abordagem comercial curta, simpática e persuasiva em português de Portugal/Brasil neutro.
Apresente-te como ${vendedor} da ${empresa}.
Use o nome da empresa do cliente e cite oportunidades reais com base nos dados (avaliações, rating, presença online).
Não invente factos. Seja consultivo, não agressivo. Termine com uma chamada à ação suave.`;

export const gerarAbordagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: AbordagemInput) => {
    if (!data?.leadId) throw new Error("Lead inválido.");
    return { leadId: data.leadId, canal: data.canal === "email" ? "email" : "whatsapp" };
  })
  .handler(async ({ data, context }): Promise<{ texto: string }> => {
    const { supabase } = context;

    const { data: lead, error } = await supabase
      .from("leads")
      .select("nome_empresa, rating, total_avaliacoes, score_seo, website, nicho, cidade, telefone")
      .eq("id", data.leadId)
      .single();

    if (error || !lead) throw new Error("Lead não encontrado.");

    const { data: profile } = await supabase
      .from("profiles")
      .select("nome_vendedor, empresa_vendedor")
      .eq("id", context.userId)
      .single();

    const vendedor = profile?.nome_vendedor?.trim() || "José";
    const empresa = profile?.empresa_vendedor?.trim() || "JAL Digital";

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

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      throw new Error("Chave do Gemini não configurada. Defina a GEMINI_API_KEY.");
    }

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiKey,
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: SYSTEM_PROMPT(vendedor, empresa) }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: userPrompt }],
            },
          ],
          generationConfig: {
            temperature: 0.8,
          },
        }),
      },
    );

    if (!r.ok) {
      const body = await r.text();
      console.error("Gemini error", r.status, body);
      if (r.status === 429) throw new Error("Limite de pedidos atingido. Tente novamente em instantes.");
      if (r.status === 400 || r.status === 401 || r.status === 403) {
        throw new Error("Falha de autenticação com o Gemini. Verifique a GEMINI_API_KEY.");
      }
      throw new Error("Falha ao gerar abordagem com o Gemini. Tente novamente.");
    }

    const j = (await r.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const texto = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";
    return { texto };
  });
