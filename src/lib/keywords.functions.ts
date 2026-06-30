import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface PeriodoInteresse {
  label: string;
  indice: number; // índice relativo de procura 0-100 (Google Trends)
}

export interface PalavraChave {
  query: string;
  valor: number; // 0-100 (top) ou % de crescimento (rising)
  crescimento?: string; // rótulo legível para "em alta"
}

export interface KeywordResult {
  termo: string;
  geo: string;
  periodos: PeriodoInteresse[];
  top: PalavraChave[];
  rising: PalavraChave[];
}

interface KeywordInput {
  termo: string;
  geo: string;
}

interface TrendsTimelinePoint {
  timestamp?: string;
  values?: Array<{ extracted_value?: number }>;
}

const SERP_BASE = "https://serpapi.com/search.json";

async function fetchTrends(
  params: Record<string, string>,
  apiKey: string,
): Promise<Record<string, unknown> | null> {
  const url = new URL(SERP_BASE);
  url.searchParams.set("engine", "google_trends");
  url.searchParams.set("hl", "pt");
  url.searchParams.set("api_key", apiKey);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      console.error("Trends error", params.date ?? params.data_type, res.status);
      return null;
    }
    return (await res.json()) as Record<string, unknown>;
  } catch (e) {
    console.error("Trends fetch failed", e);
    return null;
  }
}

function media(points: TrendsTimelinePoint[]): number {
  const vals = points
    .map((p) => p.values?.[0]?.extracted_value)
    .filter((v): v is number => typeof v === "number");
  if (vals.length === 0) return 0;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function dayKey(ts?: string): string {
  if (!ts) return "";
  const d = new Date(Number(ts) * 1000);
  return d.toISOString().slice(0, 10);
}

export const pesquisarPalavrasChave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: KeywordInput) => {
    if (!data?.termo?.trim()) throw new Error("Informe uma palavra-chave ou nicho.");
    const geos = ["PT", "BR", "AO", "MZ", "ES", ""];
    return {
      termo: data.termo.trim().slice(0, 100),
      geo: geos.includes(data.geo) ? data.geo : "PT",
    };
  })
  .handler(async ({ data }): Promise<KeywordResult> => {
    const apiKey = process.env.SERPAPI_API_KEY;
    if (!apiKey) {
      throw new Error("A pesquisa de palavras-chave não está configurada (SerpAPI em falta).");
    }

    const baseGeo: Record<string, string> = data.geo ? { geo: data.geo } : {};

    const [semana, mes, ano, related] = await Promise.all([
      fetchTrends({ q: data.termo, data_type: "TIMESERIES", date: "now 7-d", ...baseGeo }, apiKey),
      fetchTrends({ q: data.termo, data_type: "TIMESERIES", date: "today 1-m", ...baseGeo }, apiKey),
      fetchTrends({ q: data.termo, data_type: "TIMESERIES", date: "today 12-m", ...baseGeo }, apiKey),
      fetchTrends(
        { q: data.termo, data_type: "RELATED_QUERIES", date: "today 12-m", ...baseGeo },
        apiKey,
      ),
    ]);

    // Hoje e Ontem a partir da série dos últimos 7 dias (agrupada por dia).
    const semanaPts =
      ((semana?.interest_over_time as { timeline_data?: TrendsTimelinePoint[] })
        ?.timeline_data ?? []) as TrendsTimelinePoint[];
    const porDia = new Map<string, TrendsTimelinePoint[]>();
    for (const p of semanaPts) {
      const k = dayKey(p.timestamp);
      if (!k) continue;
      if (!porDia.has(k)) porDia.set(k, []);
      porDia.get(k)!.push(p);
    }
    const diasOrdenados = [...porDia.keys()].sort().reverse();
    const hoje = diasOrdenados[0] ? media(porDia.get(diasOrdenados[0])!) : 0;
    const ontem = diasOrdenados[1] ? media(porDia.get(diasOrdenados[1])!) : 0;

    const mesPts =
      ((mes?.interest_over_time as { timeline_data?: TrendsTimelinePoint[] })?.timeline_data ??
        []) as TrendsTimelinePoint[];
    const anoPts =
      ((ano?.interest_over_time as { timeline_data?: TrendsTimelinePoint[] })?.timeline_data ??
        []) as TrendsTimelinePoint[];

    const periodos: PeriodoInteresse[] = [
      { label: "Hoje", indice: hoje },
      { label: "Ontem", indice: ontem },
      { label: "Mês passado", indice: media(mesPts) },
      { label: "Ano passado", indice: media(anoPts) },
    ];

    const rq = (related?.related_queries as {
      top?: Array<{ query?: string; extracted_value?: number }>;
      rising?: Array<{ query?: string; value?: string; extracted_value?: number }>;
    }) ?? {};

    const top: PalavraChave[] = (rq.top ?? [])
      .filter((q) => q.query)
      .slice(0, 25)
      .map((q) => ({ query: q.query!, valor: q.extracted_value ?? 0 }));

    const rising: PalavraChave[] = (rq.rising ?? [])
      .filter((q) => q.query)
      .slice(0, 25)
      .map((q) => ({
        query: q.query!,
        valor: q.extracted_value ?? 0,
        crescimento: q.value ?? "",
      }));

    return { termo: data.termo, geo: data.geo, periodos, top, rising };
  });
