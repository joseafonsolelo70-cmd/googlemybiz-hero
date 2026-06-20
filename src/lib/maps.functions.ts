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

    const { data: profile } = await supabase
      .from("profiles")
      .select("google_api_key")
      .eq("id", userId)
      .single();

    const apiKey = profile?.google_api_key;
    if (!apiKey) {
      throw new Error(
        "Chave da Google Maps API não configurada. Adicione-a em Configurações.",
      );
    }

    const textQuery = `${data.nicho} em ${data.cidade}`;

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
  });
