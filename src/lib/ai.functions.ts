import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type EtapaFunil = "novo" | "contato" | "proposta" | "fechado";

interface MensagemTurno {
  autor: "vendedor" | "cliente";
  texto: string;
  imagens?: string[]; // data URLs (data:image/...;base64,...) anexadas pelo cliente/vendedor
}

interface AbordagemInput {
  leadId: string;
  canal: "whatsapp" | "email";
  etapa?: EtapaFunil;
  historico?: MensagemTurno[];
}

interface AbordagemResultado {
  texto: string;
}

const GEMINI_MODEL = "gemini-2.5-flash";

export const SYSTEM_PROMPT =
  "Toda mensagem de abordagem comercial gerada deve ter entre 35 e 60 palavras.";

export function validarLimiteDePalavras(texto: string): string {
  const total = texto.trim().split(/\s+/).filter(Boolean).length;
  if (total < 35 || total > 60) {
    throw new Error("A resposta gerada ficou fora do limite de 35 a 60 palavras. Gere novamente.");
  }
  return texto.trim();
}

export const gerarAbordagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: AbordagemInput) => {
    if (!data?.leadId) throw new Error("Lead inválido.");
    const etapas: EtapaFunil[] = ["novo", "contato", "proposta", "fechado"];
    const historico = Array.isArray(data.historico)
      ? data.historico
          .filter(
            (m) =>
              m &&
              ((typeof m.texto === "string" && m.texto.trim()) ||
                (Array.isArray(m.imagens) && m.imagens.length > 0)),
          )
          .slice(-20)
          .map((m) => ({
            autor: m.autor === "cliente" ? ("cliente" as const) : ("vendedor" as const),
            texto: typeof m.texto === "string" ? m.texto.trim().slice(0, 4000) : "",
            imagens: Array.isArray(m.imagens)
              ? m.imagens
                  .filter(
                    (img) =>
                      typeof img === "string" &&
                      img.startsWith("data:image/") &&
                      img.length < 8_000_000,
                  )
                  .slice(0, 4)
              : [],
          }))
      : [];
    return {
      leadId: data.leadId,
      canal: data.canal === "email" ? "email" : "whatsapp",
      etapa: data.etapa && etapas.includes(data.etapa) ? data.etapa : undefined,
      historico,
    };
  })
  .handler(async ({ data, context }): Promise<AbordagemResultado> => {
    const { supabase } = context;

    const { data: lead, error } = await supabase
      .from("leads")
      .select(
        "nome_empresa, rating, total_avaliacoes, score_seo, website, nicho, cidade, endereco, telefone, status_funil",
      )
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

    const userPrompt = `Cria uma mensagem de abordagem comercial.
Canal selecionado: ${data.canal === "email" ? "e-mail" : "WhatsApp"}
Etapa selecionada: ${data.etapa ?? lead.status_funil ?? "novo"}
Perfil: ${vendedor}, ${empresa}
Dados do negócio:
Nome: ${lead.nome_empresa}
Nicho: ${lead.nicho ?? "não fornecido"}
Cidade: ${lead.cidade ?? "não fornecida"}
Endereço: ${lead.endereco ?? "não fornecido"}
Classificação: ${lead.rating ?? "não fornecida"}
Número de avaliações: ${lead.total_avaliacoes ?? "não fornecido"}
Website: ${lead.website ?? "não fornecido"}
Telefone: ${lead.telefone ?? "não fornecido"}
Score SEO: ${lead.score_seo ?? "não fornecido"}`;

    // Constrói o histórico da conversa: vendedor -> model, cliente -> user.
    const contents: Array<{ role: "user" | "model"; texto: string; imagens: string[] }> = [
      { role: "user", texto: userPrompt, imagens: [] },
    ];
    for (const m of data.historico) {
      contents.push({
        role: m.autor === "vendedor" ? "model" : "user",
        texto: m.texto,
        imagens: m.imagens ?? [],
      });
    }

    // Divide uma data URL em mimetype + base64 puro (para o Gemini direto).
    const parseDataUrl = (url: string): { mime: string; b64: string } | null => {
      const match = /^data:([^;]+);base64,(.+)$/.exec(url);
      if (!match) return null;
      return { mime: match[1], b64: match[2] };
    };

    const systemText = SYSTEM_PROMPT;
    const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

    // 1) Preferir o Lovable AI Gateway (sem limites do plano gratuito do Gemini).
    const lovableKey = process.env.LOVABLE_API_KEY;
    if (lovableKey) {
      const messages = [
        { role: "system" as const, content: systemText },
        ...contents.map((c) => {
          const role = c.role === "model" ? ("assistant" as const) : ("user" as const);
          if (c.imagens.length === 0) {
            return { role, content: c.texto };
          }
          const parts: Array<
            { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
          > = [];
          if (c.texto) parts.push({ type: "text", text: c.texto });
          for (const url of c.imagens) {
            parts.push({ type: "image_url", image_url: { url } });
          }
          return { role, content: parts };
        }),
      ];

      for (let attempt = 0; attempt < 3; attempt++) {
        const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lovableKey}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages,
            temperature: 0.8,
          }),
        });

        if (r.ok) {
          const j = (await r.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const texto = j.choices?.[0]?.message?.content?.trim() ?? "";
          if (texto) return { texto: validarLimiteDePalavras(texto) };
          break; // resposta vazia — tentar o fallback direto
        }

        if (r.status === 429 && attempt < 2) {
          await sleep(1200 * (attempt + 1));
          continue;
        }
        if (r.status === 402) {
          throw new Error("Créditos de IA esgotados. Adicione créditos para continuar.");
        }
        // outros erros: cair para o fallback direto do Gemini
        const body = await r.text();
        console.error("Lovable AI Gateway error", r.status, body);
        break;
      }
    }

    // 2) Fallback: chamada direta ao Gemini com repetição em caso de 429.
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      throw new Error("Não foi possível gerar a abordagem. Tente novamente em instantes.");
    }

    // Mapeia o histórico para o formato de parts do Gemini (texto + inline_data).
    const geminiContents = contents.map((c) => {
      const parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }> =
        [];
      if (c.texto) parts.push({ text: c.texto });
      for (const url of c.imagens) {
        const parsed = parseDataUrl(url);
        if (parsed) parts.push({ inline_data: { mime_type: parsed.mime, data: parsed.b64 } });
      }
      if (parts.length === 0) parts.push({ text: "" });
      return { role: c.role, parts };
    });

    for (let attempt = 0; attempt < 3; attempt++) {
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
              parts: [{ text: systemText }],
            },
            contents: geminiContents,
            generationConfig: {
              temperature: 0.8,
            },
          }),
        },
      );

      if (r.ok) {
        const j = (await r.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const texto =
          j.candidates?.[0]?.content?.parts
            ?.map((p) => p.text ?? "")
            .join("")
            .trim() ?? "";
        return { texto: validarLimiteDePalavras(texto) };
      }

      if (r.status === 429 && attempt < 2) {
        await sleep(1500 * (attempt + 1));
        continue;
      }

      const body = await r.text();
      console.error("Gemini error", r.status, body);
      if (r.status === 429) {
        throw new Error("Muitos pedidos em pouco tempo. Aguarde alguns segundos e tente de novo.");
      }
      if (r.status === 400 || r.status === 401 || r.status === 403) {
        throw new Error("Falha de autenticação com o Gemini. Verifique a GEMINI_API_KEY.");
      }
      throw new Error("Falha ao gerar abordagem. Tente novamente.");
    }

    throw new Error("Muitos pedidos em pouco tempo. Aguarde alguns segundos e tente de novo.");
  });
