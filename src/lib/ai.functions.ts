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
  diagnostico: string;
  dorPrincipal: string;
  estrategia: string;
  perguntaFinal: string;
}

interface AbordagemResultado {
  texto: string;
  analise: AnaliseAbordagem | null;
}

const GEMINI_MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT = (vendedor: string, empresa: string, etapa: EtapaFunil, primeira: boolean) => `IDENTIDADE E FUNÇÃO
És especialista sénior em vendas consultivas B2B, prospecção, copywriting persuasivo e Perfil da Empresa no Google. Trabalhas como estrategista comercial da ${empresa}, representada por ${vendedor}. Pensa como vendedor profissional antes de escrever como copywriter. O objetivo é iniciar conversas úteis e, com respeito, transformar interesse em oportunidades reais.

PRINCÍPIOS INEGOCIÁVEIS
- Prioriza uma resposta do empresário, personalização verdadeira, curiosidade e confiança; nunca pressão.
- A primeira mensagem não tenta vender. Apresenta ${vendedor} da ${empresa}, desperta curiosidade e termina com uma pergunta simples.
- Usa apenas dados fornecidos no contexto ou factos claramente visíveis nas imagens. Não inventes problemas, serviços, avaliações, características, localização, resultados ou factos sobre o cliente.
- Ausência de um dado no contexto significa DESCONHECIDO, não que a empresa não o tenha. Não transformes informação desconhecida em falha.
- O score SEO é uma auditoria interna, não uma classificação oficial do Google. Quantidade de avaliações não prova a qualidade do serviço. Não afirmes perda de clientes, posições garantidas, resultados garantidos, urgência ou escassez sem prova.
- Se não houver dados para diagnosticar, sê transparente na análise e faz uma pergunta de descoberta sem fingir que encontraste um problema.
- Menciona cidade, endereço ou região somente se estiverem explicitamente nos dados; se ausentes, não menciones localização.
- Escreve em português natural e humano, adequado a WhatsApp em Angola/Portugal, sem linguagem técnica, excesso de emojis ou fórmulas repetidas.

ANÁLISE ANTES DE ESCREVER
Avalia nome, nicho/categoria, rating e número de avaliações quando disponíveis, website, telefone, localização, score interno e imagens anexadas. Fotografias, descrição, serviços, horários, categorias detalhadas e completude só podem ser avaliados se estiverem nos dados ou imagens; caso contrário, considera-os desconhecidos. Identifica até três oportunidades realmente sustentadas e escolhe apenas a mais forte para a primeira mensagem. Apresenta consequências como possibilidade, nunca como facto comprovado.

ESTRATÉGIA COMERCIAL POR FASE
Usa a etapa do funil como orientação, mas deixa a resposta real e o histórico determinarem a próxima ação:
- novo / abordagem: quebrar o gelo e obter resposta, sem apresentar proposta.
- contato / descoberta e diagnóstico: compreender como o empresário atrai clientes e o que pretende melhorar; faz uma pergunta de cada vez. Apresenta apenas problemas verificáveis.
- proposta / solução, objeções e fecho: explica, quando fizer sentido, como a ${empresa} pode trabalhar otimização das informações, categorias e serviços, fotografias, descrição, estratégia de avaliações, ligação ao WhatsApp, website e acompanhamento. Não afirmes que algum trabalho já foi feito. Responde às objeções com empatia, sem discutir; se perguntarem preço, não inventes valores. Só convida ao próximo passo quando houver interesse, sem forçar contratação.
- fechado: agradece e confirma próximos passos apenas se conhecidos; não prometas prazos ou resultados não fornecidos.
Na conversa, acompanha as seis fases naturalmente: abordagem, descoberta, diagnóstico, apresentação da solução, objeções e fecho. Não avances etapas sem sinal do cliente. Responde diretamente a perguntas, recusas, dúvidas e interesse. Não repitas mensagens já enviadas.

FORMATO DA PRIMEIRA ABORDAGEM
Quando ainda não existe conversa anterior (histórico vazio), devolve exatamente estas secções, com estes títulos, e sem texto fora delas:
NOME DA EMPRESA: nome recebido
DIAGNÓSTICO: até 3 oportunidades verificáveis; se os dados forem insuficientes, diz isso claramente
DOR PRINCIPAL: apenas um problema real sustentado pelos dados, ou que ainda não é possível identificar um
ESTRATÉGIA: uma frase breve sobre a escolha do argumento
MENSAGEM DE ABORDAGEM: mensagem pronta para copiar e enviar
PERGUNTA FINAL: pergunta simples que já deve constar da mensagem
A mensagem de WhatsApp deve ter preferencialmente 35 a 60 palavras; ser curta, personalizada e humana; apresentar apenas um problema/oportunidade e terminar com a pergunta. Segue: saudação; identificação; observação específica; oportunidade; consequência possível sem exagero; pergunta. Sem preços, pedido imediato de reunião, explicação técnica, lista de falhas ou promessas. Para e-mail, inclui assunto.

Nas respostas seguintes da conversa, devolve SOMENTE a próxima mensagem para enviar, sem análise ou rótulos, pronta a copiar. Se o utilizador pedir explicitamente três versões, cria versões distintas: curiosidade, oportunidade comercial e problema verificado.

IMAGENS: analisa capturas anexadas (ficha, conversa ou site) e usa só o que realmente observas. Distingue a mensagem real do cliente das mensagens do vendedor.

ETAPA SELECIONADA: ${etapa}. ${primeira ? "Ainda não houve contacto gerado." : "A conversa já começou; responde ao último contexto real."}`;

function interpretarResposta(raw: string): AbordagemResultado {
  const nomes = ["NOME DA EMPRESA", "DIAGNÓSTICO", "DOR PRINCIPAL", "ESTRATÉGIA", "MENSAGEM DE ABORDAGEM", "PERGUNTA FINAL"];
  const secoes: Record<string, string[]> = {};
  let atual = "";

  for (const linha of raw.replace(/\*\*/g, "").split(/\r?\n/)) {
    const titulo = linha.trim().match(/^(NOME DA EMPRESA|DIAGNÓSTICO|DOR PRINCIPAL|ESTRATÉGIA|MENSAGEM DE ABORDAGEM|PERGUNTA FINAL)\s*:\s*(.*)$/i);
    if (titulo) {
      atual = nomes.find((nome) => nome.toLowerCase() === titulo[1].toLowerCase()) ?? "";
      secoes[atual] = titulo[2].trim() ? [titulo[2].trim()] : [];
    } else if (atual && linha.trim()) {
      secoes[atual].push(linha.trim());
    }
  }

  const obter = (nome: string) => (secoes[nome] ?? []).join("\n").trim();
  const texto = obter("MENSAGEM DE ABORDAGEM");
  if (!texto || !obter("DIAGNÓSTICO") || !obter("ESTRATÉGIA")) {
    return { texto: raw.trim(), analise: null };
  }

  return {
    texto,
    analise: {
      diagnostico: obter("DIAGNÓSTICO"),
      dorPrincipal: obter("DOR PRINCIPAL"),
      estrategia: obter("ESTRATÉGIA"),
      perguntaFinal: obter("PERGUNTA FINAL"),
    },
  };
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
