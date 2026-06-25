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
}

interface SearchInput {
  nicho: string;
  cidade: string;
}

interface SerpMapsResult {
  place_id?: string;
  title?: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviews?: number;
}

async function searchViaSerpApi(
  query: string,
  apiKey: string,
): Promise<PlaceResult[]> {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_maps");
  url.searchParams.set("type", "search");
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "pt");
  url.searchParams.set("api_key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    console.error("SerpAPI error", res.status, body);
    if (res.status === 401) {
      throw new Error("A chave do SerpAPI é inválida. Verifique a configuração.");
    }
    throw new Error("Falha ao consultar o Google Maps via SerpAPI. Tente novamente.");
  }

  const json = (await res.json()) as {
    error?: string;
    local_results?: SerpMapsResult[];
    place_results?: SerpMapsResult;
  };

  if (json.error) {
    console.error("SerpAPI returned error", json.error);
    throw new Error("Falha ao consultar o Google Maps via SerpAPI. Tente novamente.");
  }

  const list: SerpMapsResult[] = json.local_results
    ? json.local_results
    : json.place_results
      ? [json.place_results]
      : [];

  return list.map((p, i) => {
    const telefone = p.phone ?? null;
    const website = p.website ?? null;
    const rating = typeof p.rating === "number" ? p.rating : null;
    const total = typeof p.reviews === "number" ? p.reviews : 0;
    return {
      place_id: p.place_id ?? `serp-${i}-${p.title ?? "sem-nome"}`,
      nome_empresa: p.title ?? "Sem nome",
      endereco: p.address ?? null,
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
