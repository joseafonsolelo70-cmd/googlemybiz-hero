import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calcularScoreSeo } from "./seo";

export interface PlaceResult {
  place_id: string;
  nome_empresa: string;
  endereco: string | null;
  telefone: string | null;
  website: string | null;
  rating: number | null;
  total_avaliacoes: number;
  score_seo: number;
  perfil_url: string;
}

interface SearchInput {
  nicho: string;
  cidade: string;
}

interface SerpMapsResult {
  place_id?: string;
  data_id?: string;
  title?: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviews?: number;
}

/**
 * Constrói o link para o perfil da empresa no Google Maps.
 * Usa o place_id real quando disponível; caso contrário pesquisa pelo nome/endereço.
 */
function buildPerfilUrl(
  placeId: string | undefined,
  nome: string,
  endereco: string | null,
): string {
  if (placeId && placeId.startsWith("ChIJ")) {
    return `https://www.google.com/maps/place/?q=place_id:${placeId}`;
  }
  const termo = [nome, endereco].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(termo)}`;
}

async function searchViaSerpApi(
  query: string,
  apiKey: string,
): Promise<PlaceResult[]> {
  const offsets = [0, 20, 40, 60, 80];
  const pagePromises = offsets.map(async (start) => {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google_maps");
    url.searchParams.set("type", "search");
    url.searchParams.set("q", query);
    url.searchParams.set("hl", "pt");
    url.searchParams.set("start", start.toString());
    url.searchParams.set("api_key", apiKey);

    try {
      const res = await fetch(url.toString());
      if (!res.ok) {
        const body = await res.text();
        console.error(`SerpAPI error for start=${start}`, res.status, body);
        return [];
      }
      const json = (await res.json()) as {
        error?: string;
        local_results?: SerpMapsResult[];
        place_results?: SerpMapsResult;
      };
      if (json.error) {
        console.error(`SerpAPI returned error for start=${start}`, json.error);
        return [];
      }
      return json.local_results
        ? json.local_results
        : json.place_results
          ? [json.place_results]
          : [];
    } catch (e) {
      console.error(`Failed to fetch page for start=${start}`, e);
      return [];
    }
  });

  const pagesResults = await Promise.all(pagePromises);
  const list: SerpMapsResult[] = pagesResults.flat();

  // Deduplicate results by place_id or title to ensure clean data
  const seenIds = new Set<string>();
  const uniqueList: SerpMapsResult[] = [];
  for (const item of list) {
    const id = item.place_id || item.title || "";
    if (id && !seenIds.has(id)) {
      seenIds.add(id);
      uniqueList.push(item);
    }
  }

  return uniqueList.map((p, i) => {
    const telefone = p.phone ?? null;
    const website = p.website ?? null;
    const rating = typeof p.rating === "number" ? p.rating : null;
    const total = typeof p.reviews === "number" ? p.reviews : 0;
    const nome = p.title ?? "Sem nome";
    const endereco = p.address ?? null;
    return {
      place_id: p.place_id ?? `serp-${i}-${p.title ?? "sem-nome"}`,
      nome_empresa: nome,
      endereco,
      telefone,
      website,
      rating,
      total_avaliacoes: total,
      score_seo: calcularScoreSeo({
        rating,
        totalAvaliacoes: total,
        hasWebsite: !!website,
        hasTelefone: !!telefone,
      }),
      perfil_url: buildPerfilUrl(p.place_id, nome, endereco),
    };
  });
}

async function searchViaGooglePlaces(
  textQuery: string,
  apiKey: string,
): Promise<PlaceResult[]> {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.nationalPhoneNumber,places.rating,places.userRatingCount,places.websiteUri",
    },
    body: JSON.stringify({ textQuery, languageCode: "pt", maxResultCount: 20 }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("Places API error", res.status, body);
    if (res.status === 403 || res.status === 400) {
      throw new Error(
        "A chave da Google Maps API foi recusada. Verifique se a Places API (New) está ativada e a chave é válida.",
      );
    }
    throw new Error("Falha ao consultar o Google Maps. Tente novamente.");
  }

  const json = (await res.json()) as {
    places?: Array<{
      id: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      internationalPhoneNumber?: string;
      nationalPhoneNumber?: string;
      rating?: number;
      userRatingCount?: number;
      websiteUri?: string;
    }>;
  };

  return (json.places ?? []).map((p) => {
    const telefone = p.internationalPhoneNumber ?? p.nationalPhoneNumber ?? null;
    const website = p.websiteUri ?? null;
    const rating = p.rating ?? null;
    const total = p.userRatingCount ?? 0;
    return {
      place_id: p.id,
      nome_empresa: p.displayName?.text ?? "Sem nome",
      endereco: p.formattedAddress ?? null,
      telefone,
      website,
      rating,
      total_avaliacoes: total,
      score_seo: calcularScoreSeo({
        rating,
        totalAvaliacoes: total,
        hasWebsite: !!website,
        hasTelefone: !!telefone,
      }),
    };
  });
}

export const searchPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: SearchInput) => {
    if (!data?.nicho?.trim() || !data?.cidade?.trim()) {
      throw new Error("Informe o nicho e a cidade.");
    }
    return { nicho: data.nicho.trim().slice(0, 120), cidade: data.cidade.trim().slice(0, 120) };
  })
  .handler(async ({ data, context }): Promise<PlaceResult[]> => {
    const { supabase, userId } = context;
    const query = `${data.nicho} em ${data.cidade}`;

    // Prefer the shared SerpAPI key (no setup needed by the user).
    const serpKey = process.env.SERPAPI_API_KEY;
    if (serpKey) {
      return searchViaSerpApi(query, serpKey);
    }

    // Fallback: user's own Google Maps API key from their profile.
    const { data: profile } = await supabase
      .from("profiles")
      .select("google_api_key")
      .eq("id", userId)
      .single();

    const apiKey = profile?.google_api_key;
    if (!apiKey) {
      throw new Error(
        "Nenhuma chave de pesquisa configurada. Adicione a chave do Google Maps em Configurações.",
      );
    }

    return searchViaGooglePlaces(query, apiKey);
  });
