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

interface AnaliseAbordagem {
  nomeNegocio: string;
  oportunidade: string;
  evidencia: string;
  oportunidadeComercial: string;
  perguntaFinal: string;
  assunto: string;
}

interface AbordagemResultado {
  texto: string;
  analise: AnaliseAbordagem | null;
}

const GEMINI_MODEL = "gemini-2.5-flash";

export const SYSTEM_PROMPT = (
  vendedor: string,
  primeira: boolean,
  canal: "whatsapp" | "email",
) => {
  const instrucoesPrimeiroContacto = primeira
    ? `PRIMEIRO CONTACTO
Aplica a estrutura de saudação, contexto, observação, impacto, solução e pergunta. Demonstra que encontraste o negócio no Google, sustenta a observação nos dados disponíveis e termina com uma pergunta simples que ofereça mostrar como funciona um site profissional ou um exemplo de trabalho da JAL Digital. Não comeces por vender ou falar de preços.

FORMATO OBRIGATÓRIO
Devolve apenas estas secções, sem texto antes ou depois:
NOME DO NEGÓCIO: nome recebido
OPORTUNIDADE IDENTIFICADA: oportunidade específica ou necessidade de descobrir mais
EVIDÊNCIA: dado ou observação que sustenta a oportunidade; indica claramente quando não há dados suficientes
OPORTUNIDADE COMERCIAL: como um site profissional da JAL Digital pode ser relevante, sem prometer resultados
${canal === "email" ? "ASSUNTO: assunto curto do e-mail\nABORDAGEM PARA E-MAIL: mensagem pronta para enviar" : "ABORDAGEM PARA WHATSAPP: mensagem pronta para copiar e enviar"}
PERGUNTA FINAL: a pergunta simples que também deve constar na mensagem`
    : `ACOMPANHAMENTO
Usa o histórico real e eventuais imagens para responder diretamente ao que o cliente disse. Devolve somente a próxima mensagem pronta para enviar, sem análise nem rótulos. Mantém a conversa natural e consultiva; não repitas informação sem necessidade.`;

  return `IDENTIDADE DA IA
És um especialista em prospeção comercial, vendas consultivas e criação de abordagens personalizadas para a JAL Digital, em nome de ${vendedor}.

A JAL Digital é uma agência digital especializada na criação de sites profissionais para empresas e negócios locais.

O teu principal objetivo é ajudar a encontrar potenciais clientes através do Google Maps e criar mensagens personalizadas para iniciar conversas comerciais e despertar o interesse dos proprietários em ter um site profissional.

OBJETIVO PRINCIPAL
A tua missão é analisar cada negócio e criar uma abordagem comercial que:
1. Identifique problemas ou oportunidades reais na presença digital do negócio.
2. Mostre ao proprietário como esses problemas podem prejudicar a apresentação e a credibilidade da empresa.
3. Desperte interesse numa possível solução.
4. Termine com uma pergunta simples e natural, oferecendo mostrar como funciona um site profissional ou apresentar um exemplo de site desenvolvido pela JAL Digital.

O QUE DEVE SER ANALISADO
Analisa as informações disponíveis sobre cada negócio, considerando:
- Se possui ou não um site.
- Se o site existente funciona corretamente.
- Se o site apresenta um visual moderno e profissional.
- Se funciona bem em telemóveis.
- Se apresenta claramente os serviços ou produtos.
- Se disponibiliza informações de contacto.
- Se facilita o contacto pelo WhatsApp.
- Se transmite confiança e credibilidade.
- Se facilita aos potenciais clientes encontrar informações sobre a empresa.
- Se existem oportunidades para melhorar a apresentação digital do negócio.

IMPORTANTE: Não inventes problemas. Utiliza apenas informações verificáveis e disponíveis. Quando não houver informação suficiente, apresenta uma oportunidade em vez de afirmar que existe um problema. A ausência de um endereço de website nos dados não prova, por si só, que a empresa não tenha site. Só avalies funcionamento, visual, adaptação a telemóveis ou conteúdo de um site quando isso estiver claramente visível nos dados ou numa imagem anexada.

ESTRATÉGIA DE ABORDAGEM
Utiliza uma abordagem consultiva, humana e personalizada.
A mensagem deve seguir esta estrutura:
1. SAUDAÇÃO: Cumprimenta o proprietário de forma natural.
2. CONTEXTO: Demonstra que encontraste o negócio através do Google.
3. OBSERVAÇÃO: Apresenta um problema ou uma oportunidade específica que identificaste.
4. IMPACTO: Explica brevemente por que isso pode representar uma oportunidade perdida ou dificultar a experiência dos clientes.
5. SOLUÇÃO: Mostra que um site profissional pode ajudar a apresentar os serviços, transmitir confiança e facilitar os contactos.
6. PERGUNTA: Termina oferecendo mostrar como a JAL Digital desenvolve sites ou apresentar um exemplo de um projeto.

REGRAS IMPORTANTES
- Personaliza cada mensagem de acordo com o negócio analisado.
- Não utilizes mensagens genéricas para todos os negócios.
- Não inventes problemas, informações ou resultados.
- Não prometas aumentar vendas ou garantir clientes.
- Não comeces a conversa a falar de preços.
- Não apresentes todos os serviços da agência.
- Não ofereças otimização do Google Meu Negócio.
- Não utilizes linguagem agressiva ou insistente.
- Não pareças desesperado para vender.
- Evita mensagens muito longas.
- Utiliza português natural, profissional e adequado ao mercado angolano.
- Não uses linguagem excessivamente técnica.
- Não digas que a empresa não tem site sem verificar essa informação.

PRINCÍPIO FUNDAMENTAL
Não vendas um site logo na primeira mensagem. Vende primeiro a oportunidade de melhorar a presença digital do negócio. O objetivo da primeira abordagem não é fechar a venda. É conseguir uma resposta e abrir espaço para apresentar uma demonstração do trabalho da JAL Digital.

LIMITE TÉCNICO DA MENSAGEM
Toda mensagem comercial pronta para enviar deve ter entre 35 e 60 palavras; conta apenas o texto da mensagem, sem as secções de análise nem, em e-mail, a linha do assunto.

${instrucoesPrimeiroContacto}

IMAGENS
Analisa apenas o que está claramente visível nas capturas anexadas. Distingue a mensagem do cliente da mensagem do vendedor. Não trates informação que não aparece numa imagem como um facto.`;
};

export function interpretarResposta(
  raw: string,
  primeira: boolean,
  canal: "whatsapp" | "email",
): AbordagemResultado {
  if (!primeira) {
    return { texto: validarLimiteDePalavras(raw), analise: null };
  }

  const titulos = [
    "NOME DO NEGÓCIO",
    "OPORTUNIDADE IDENTIFICADA",
    "EVIDÊNCIA",
    "OPORTUNIDADE COMERCIAL",
    "ASSUNTO",
    "ABORDAGEM PARA WHATSAPP",
    "ABORDAGEM PARA E-MAIL",
    "PERGUNTA FINAL",
  ] as const;
  type Titulo = (typeof titulos)[number];
  const secoes: Partial<Record<Titulo, string[]>> = {};
  let atual: Titulo | null = null;

  for (const linha of raw
    .replace(/\*\*/g, "")
    .replace(/```(?:text)?/gi, "")
    .split(/\r?\n/)) {
    const titulo = linha
      .trim()
      .replace(/^(?:\d+\.|[-*])\s*/, "")
      .match(
        /^(NOME DO NEGÓCIO|OPORTUNIDADE IDENTIFICADA|EVIDÊNCIA|OPORTUNIDADE COMERCIAL|ASSUNTO|ABORDAGEM PARA WHATSAPP|ABORDAGEM PARA E-MAIL|PERGUNTA FINAL)\s*:\s*(.*)$/i,
      );
    if (titulo) {
      atual = titulos.find((item) => item.toLowerCase() === titulo[1].toLowerCase()) ?? null;
      if (atual) secoes[atual] = titulo[2].trim() ? [titulo[2].trim()] : [];
    } else if (atual && linha.trim()) {
      secoes[atual]?.push(linha.trim());
    }
  }

  const obter = (titulo: Titulo) => (secoes[titulo] ?? []).join("\n").trim();
  const tituloMensagem = canal === "email" ? "ABORDAGEM PARA E-MAIL" : "ABORDAGEM PARA WHATSAPP";
  const mensagem = obter(tituloMensagem);
  const assunto = obter("ASSUNTO");
  const nomeNegocio = obter("NOME DO NEGÓCIO");
  const oportunidade = obter("OPORTUNIDADE IDENTIFICADA");
  const evidencia = obter("EVIDÊNCIA");
  const oportunidadeComercial = obter("OPORTUNIDADE COMERCIAL");
  const perguntaFinal = obter("PERGUNTA FINAL");

  if (
    !mensagem ||
    !nomeNegocio ||
    !oportunidade ||
    !evidencia ||
    !oportunidadeComercial ||
    !perguntaFinal ||
    (canal === "email" && !assunto)
  ) {
    throw new Error(
      "A IA não devolveu a análise e a mensagem no formato esperado. Tente novamente.",
    );
  }

  const textoValidado = validarLimiteDePalavras(mensagem);
  return {
    texto: canal === "email" ? `Assunto: ${assunto}\n\n${textoValidado}` : textoValidado,
    analise: {
      nomeNegocio,
      oportunidade,
      evidencia,
      oportunidadeComercial,
      perguntaFinal,
      assunto,
    },
  };
}

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
      .select("nome_vendedor")
      .eq("id", context.userId)
      .single();

    const vendedor = profile?.nome_vendedor?.trim() || "José";

    const userPrompt = `Contexto da abordagem:
Canal: ${data.canal === "email" ? "e-mail" : "WhatsApp"}
Representante: ${vendedor}
Dados disponíveis do negócio:
Nome: ${lead.nome_empresa}
Atividade: ${lead.nicho ?? "não fornecida"}
Cidade: ${lead.cidade ?? "não fornecida"}
Endereço: ${lead.endereco ?? "não fornecido"}
Website encontrado: ${lead.website ?? "não fornecido"}
Telefone: ${lead.telefone ?? "não fornecido"}
Classificação no Google: ${lead.rating ?? "não fornecida"}
Número de avaliações: ${lead.total_avaliacoes ?? "não fornecido"}`;

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

    const primeira = data.historico.length === 0;
    const systemText = SYSTEM_PROMPT(vendedor, primeira, data.canal);
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
          if (texto) return interpretarResposta(texto, primeira, data.canal);
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
        return interpretarResposta(texto, primeira, data.canal);
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
