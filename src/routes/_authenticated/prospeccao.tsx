import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Loader2, Plus, Check, Star, Phone, Globe, MapPin, ExternalLink, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { searchPlaces, type PlaceResult } from "@/lib/maps.functions";
import { pontosParaMelhorar } from "@/lib/seo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScoreBadge } from "@/components/score-badge";
import { whatsappLink } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/prospeccao")({
  head: () => ({ meta: [{ title: "Prospecção Maps — GMN Prospect" }] }),
  component: ProspeccaoPage,
});

function ProspeccaoPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const search = useServerFn(searchPlaces);
  const [nicho, setNicho] = useState("");
  const [cidade, setCidade] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [added, setAdded] = useState<Set<string>>(new Set());

  const searchMutation = useMutation({
    mutationFn: () => search({ data: { nicho, cidade } }),
    onSuccess: (data) => {
      setResults(data);
      if (data.length === 0) toast.info("Nenhum resultado encontrado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMutation = useMutation({
    mutationFn: async (place: PlaceResult) => {
      const { error } = await supabase.from("leads").insert({
        user_id: user!.id,
        nome_empresa: place.nome_empresa,
        telefone: place.telefone,
        endereco: place.endereco,
        website: place.website,
        rating: place.rating,
        total_avaliacoes: place.total_avaliacoes,
        score_seo: place.score_seo,
        place_id: place.place_id,
        nicho,
        cidade,
        status_funil: "novo",
      });
      if (error) throw error;
      return place.place_id;
    },
    onSuccess: (placeId) => {
      setAdded((prev) => new Set(prev).add(placeId));
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead adicionado ao CRM.");
    },
    onError: () => toast.error("Não foi possível adicionar o lead."),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nicho.trim() || !cidade.trim()) {
      toast.error("Preencha o nicho e a cidade.");
      return;
    }
    searchMutation.mutate();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Prospecção Maps</h1>
        <p className="text-sm text-muted-foreground">
          Pesquise empresas por nicho e cidade. Ex.: <em>Dentista</em> em <em>Lisboa</em>.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Input
              placeholder="Nicho (ex.: Dentista)"
              value={nicho}
              onChange={(e) => setNicho(e.target.value)}
            />
            <Input
              placeholder="Cidade (ex.: Lisboa)"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
            />
            <Button type="submit" variant="action" disabled={searchMutation.isPending}>
              {searchMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Pesquisar
            </Button>
          </form>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{results.length} resultados</p>
          {results.map((place) => {
            const isAdded = added.has(place.place_id);
            const melhorias = pontosParaMelhorar({
              rating: place.rating,
              totalAvaliacoes: place.total_avaliacoes,
              hasWebsite: !!place.website,
              hasTelefone: !!place.telefone,
            });
            return (
              <Card key={place.place_id}>
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={place.perfil_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-foreground hover:text-action hover:underline"
                      >
                        {place.nome_empresa}
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </a>
                      <ScoreBadge score={place.score_seo} />
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {place.rating != null && (
                        <span className="inline-flex items-center gap-1">
                          <Star className="h-3 w-3 fill-warning text-warning" />
                          {place.rating} ({place.total_avaliacoes})
                        </span>
                      )}
                      {place.endereco && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {place.endereco}
                        </span>
                      )}
                      {place.telefone && (
                        <a
                          href={whatsappLink(place.telefone) ?? undefined}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-action hover:underline"
                        >
                          <Phone className="h-3 w-3" />
                          {place.telefone}
                        </a>
                      )}
                      {place.website ? (
                        <a
                          href={place.website}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 hover:text-action hover:underline"
                        >
                          <Globe className="h-3 w-3" />
                          Website
                        </a>
                      ) : null}
                    </div>
                    {melhorias.length > 0 && (
                      <div className="rounded-md border border-warning/30 bg-warning/5 p-2">
                        <p className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-warning">
                          <AlertTriangle className="h-3 w-3" />
                          Pontos a melhorar ({melhorias.length})
                        </p>
                        <ul className="list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
                          {melhorias.map((m) => (
                            <li key={m}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <Button
                    variant={isAdded ? "secondary" : "action"}
                    size="sm"
                    disabled={isAdded || addMutation.isPending}
                    onClick={() => addMutation.mutate(place)}
                    className="shrink-0"
                  >
                    {isAdded ? (
                      <>
                        <Check className="h-4 w-4" /> Adicionado
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" /> Adicionar ao CRM
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
