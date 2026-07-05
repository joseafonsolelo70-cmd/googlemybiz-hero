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

const GEMINI_MODEL = "gemini-2.5-flash";

const ETAPA_OBJETIVO: Record<EtapaFunil, string> = {
  novo: `ETAPA DO FUNIL: PRIMEIRO CONTACTO (lead acabou de chegar).
Objetivo: quebrar o gelo e despertar interesse. Apresenta-te, mostra que estudaste o negócio do cliente e aponta 1 ou 2 oportunidades concretas de melhoria no Google Meu Negócio/SEO local. Gera curiosidade sem vender de forma agressiva. Termina pedindo apenas alguns minutos da atenção dele.`,
  contato: `ETAPA DO FUNIL: ACOMPANHAMENTO / NUTRIÇÃO (já houve um primeiro contacto, mas ainda não há proposta).
Objetivo: reativar a conversa de forma leve e persuasiva. Relembra o valor que podes trazer, reforça uma prova ou benefício (mais clientes, mais avaliações, melhor posição no Google) e cria uma pequena urgência. Pergunta se faz sentido avançar para uma proposta. Não pareças insistente nem repetitivo.`,
  proposta: `ETAPA DO FUNIL: PROPOSTA / NEGOCIAÇÃO (cliente está a considerar contratar).
Objetivo: ser persuasivo e fechar. Resume o ganho concreto que o cliente terá, antecipa e desfaz objeções comuns (preço, tempo, confiança), reforça resultados e diferenciais, e faz uma chamada à ação clara para fechar o serviço (marcar reunião, confirmar início). Transmite confiança e segurança.`,
  fechado: `ETAPA DO FUNIL: PÓS-FECHAMENTO (cliente fechou o contrato).
Objetivo: agradecer, confirmar os próximos passos do serviço e reforçar que tomou a decisão certa. Transmite acompanhamento próximo, define expectativas dos primeiros resultados e deixa o cliente tranquilo e bem servido. Tom caloroso e profissional.`,
};

const SYSTEM_PROMPT = (vendedor: string, empresa: string, etapa: EtapaFunil) => `Você é um especialista em vendas consultivas de serviços de Google Meu Negócio (GMN) e SEO local, a representar a empresa ${empresa} em nome de ${vendedor}. Você acompanha o cliente em todas as fases — desde a chegada até ao fecho do contrato.
Apresente-te como ${vendedor} da ${empresa}.
Escreva uma mensagem curta, simpática e PERSUASIVA em português neutro (PT/BR), adequada exatamente à etapa do funil indicada.

${ETAPA_OBJETIVO[etapa]}

MODO CONVERSA: Esta pode ser uma negociação em andamento. As mensagens marcadas como "model" são mensagens que VOCÊ (o vendedor) já enviou; as mensagens "user" depois da primeira são RESPOSTAS REAIS DO CLIENTE. Quando o cliente responder, gere APENAS a próxima mensagem que o vendedor deve enviar, reagindo diretamente ao que o cliente disse (dúvidas, objeções, preço, interesse, recusa). Não repita mensagens anteriores e não invente o que o cliente disse.
Responda SEMPRE apenas com o texto pronto para o vendedor copiar e enviar — sem explicações, sem aspas, sem rótulos como "Mensagem:".

Princípios de persuasão a usar com naturalidade: prova social (avaliações/rating), benefício concreto, escassez/urgência suave e chamada à ação clara — sem soar a robô nem agressivo.
Use o nome da empresa do cliente e cite oportunidades reais com base nos dados (avaliações, rating, presença online).
REGRA CRÍTICA SOBRE LOCALIZAÇÃO: só pode mencionar a cidade/localização do cliente se ela for fornecida explicitamente nos dados abaixo. NUNCA invente, adivinhe ou assuma uma cidade, bairro, país ou morada. Se a localização não for fornecida (ou estiver como "n/d"), não mencione nenhuma localização na mensagem.
Não invente factos. Seja consultivo. Termine sempre com uma chamada à ação adequada à etapa.`;

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
  .handler(async ({ data, context }): Promise<{ texto: string }> => {
    const { supabase } = context;

    const { data: lead, error } = await supabase
      .from("leads")
      .select(
        "nome_empresa, rating, total_avaliacoes, score_seo, website, nicho, cidade, endereco, telefone, status_funil",
      )
      .eq("id", data.leadId)
      .single();

    if (error || !lead) throw new Error("Lead não encontrado.");

    const etapa: EtapaFunil =
      data.etapa ?? ((lead.status_funil as EtapaFunil | null) ?? "novo");

    const { data: profile } = await supabase
      .from("profiles")
      .select("nome_vendedor, empresa_vendedor")
      .eq("id", context.userId)
      .single();

    const vendedor = profile?.nome_vendedor?.trim() || "José";
    const empresa = profile?.empresa_vendedor?.trim() || "JAL Digital";

    const canalLabel = data.canal === "email" ? "e-mail" : "WhatsApp";
    const localizacao = lead.endereco?.trim() || lead.cidade?.trim() || "";
    const userPrompt = `Gere uma mensagem para ${canalLabel}.
Dados da empresa:
- Nome: ${lead.nome_empresa}
- Nicho: ${lead.nicho ?? "n/d"}
- Localização (use exatamente esta, não invente outra): ${localizacao || "n/d — NÃO mencione nenhuma localização"}
- Rating no Google: ${lead.rating ?? "sem rating"}
- Total de avaliações: ${lead.total_avaliacoes ?? 0}
- Tem website: ${lead.website ? "sim" : "não"}
- Score SEO local (0-100): ${lead.score_seo ?? 0}

${data.canal === "email" ? "Inclua uma linha de assunto na primeira linha." : "Mensagem direta de WhatsApp, com emojis moderados."}

${data.historico.length > 0 ? "A seguir está a conversa já trocada com este cliente. Gere apenas a próxima mensagem a enviar." : ""}`;

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

    const systemText = SYSTEM_PROMPT(vendedor, empresa, etapa);
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
            | { type: "text"; text: string }
            | { type: "image_url"; image_url: { url: string } }
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
          if (texto) return { texto };
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
      const parts: Array<
        { text: string } | { inline_data: { mime_type: string; data: string } }
      > = [];
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
          j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";
        return { texto };
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
