import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Loader2, Plus, Check, Star, Phone, Globe, MapPin, ExternalLink, AlertTriangle, CheckCircle2, XCircle, Tag } from "lucide-react";
import { toast } from "sonner";

import { searchPlaces, type PlaceResult } from "@/lib/maps.functions";
import { pontosParaMelhorar, diagnosticoFicha } from "@/lib/seo";
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
  const [hydrated, setHydrated] = useState(false);
  const [visible, setVisible] = useState(20);

  // Restaurar a última pesquisa ao voltar à página
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("prospeccao_state");
      if (raw) {
        const st = JSON.parse(raw);
        setNicho(st.nicho ?? "");
        setCidade(st.cidade ?? "");
        setResults(Array.isArray(st.results) ? st.results : []);
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem("prospeccao_state", JSON.stringify({ nicho, cidade, results }));
    } catch {}
  }, [nicho, cidade, results, hydrated]);

  // Leads já existentes no CRM (para marcar como "Adicionado")
  const { data: existingIds } = useQuery({
    queryKey: ["leads", "place_ids", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("place_id");
      if (error) throw error;
      return new Set((data ?? []).map((l) => l.place_id).filter(Boolean) as string[]);
    },
  });

  const searchMutation = useMutation({
    mutationFn: () => search({ data: { nicho, cidade } }),
    onSuccess: (data) => {
      setResults(data);
      setVisible(20);
      if (data.length === 0) toast.info("Nenhum resultado encontrado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMutation = useMutation({
    mutationFn: async (place: PlaceResult) => {
      if (!user) throw new Error("Sessão expirada. Entre novamente.");
      if (existingIds?.has(place.place_id)) return place.place_id;
      const { error } = await supabase.from("leads").insert({
        user_id: user.id,
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
      toast.success("Lead adicionado ao CRM.", { id: "lead-add" });
    },
    onError: (e: Error) => toast.error(`Não foi possível adicionar o lead: ${e.message}`, { id: "lead-add" }),
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
          {results.slice(0, visible).map((place) => {
            const isAdded = added.has(place.place_id) || !!existingIds?.has(place.place_id);
            const melhorias = pontosParaMelhorar({
              rating: place.rating,
              totalAvaliacoes: place.total_avaliacoes,
              hasWebsite: !!place.website,
              hasTelefone: !!place.telefone,
            });
            const ficha = diagnosticoFicha({
              temFotos: place.tem_fotos,
              temDescricao: place.tem_descricao,
              temAtributos: place.tem_atributos,
              temCategoriasSecundarias: place.tem_categorias_secundarias,
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
                    {place.categorias.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1">
                        <Tag className="h-3 w-3 text-muted-foreground" />
                        {place.categorias.slice(0, 4).map((c) => (
                          <span
                            key={c}
                            className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {ficha.map((item) => (
                        <span
                          key={item.label}
                          className={`inline-flex items-center gap-1 text-xs ${item.ok ? "text-success" : "text-destructive"}`}
                        >
                          {item.ok ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <XCircle className="h-3 w-3" />
                          )}
                          {item.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant={isAdded ? "secondary" : "action"}
                    size="sm"
                    disabled={isAdded || (addMutation.isPending && addMutation.variables?.place_id === place.place_id)}
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
          {visible < results.length && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setVisible((v) => v + 20)}
            >
              Mostrar mais ({results.length - visible} restantes)
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
