import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Search, Loader2, TrendingUp, Flame, Copy, Calendar } from "lucide-react";
import { toast } from "sonner";

import { pesquisarPalavrasChave, type KeywordResult } from "@/lib/keywords.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/palavras-chave")({
  head: () => ({ meta: [{ title: "Palavras-chave — GMN Prospect" }] }),
  component: PalavrasChavePage,
});

const GEOS = [
  { value: "PT", label: "Portugal" },
  { value: "AO", label: "Angola" },
  { value: "BR", label: "Brasil" },
  { value: "MZ", label: "Moçambique" },
  { value: "ES", label: "Espanha" },
  { value: "", label: "Mundial" },
];

function PalavrasChavePage() {
  const buscar = useServerFn(pesquisarPalavrasChave);
  const [termo, setTermo] = useState("");
  const [geo, setGeo] = useState("PT");
  const [data, setData] = useState<KeywordResult | null>(null);

  const mutation = useMutation({
    mutationFn: () => buscar({ data: { termo, geo } }),
    onSuccess: (res) => {
      setData(res);
      if (res.top.length === 0 && res.rising.length === 0) {
        toast.info("Sem dados de palavras relacionadas para este termo/região.");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!termo.trim()) {
      toast.error("Escreva um nicho ou palavra-chave.");
      return;
    }
    mutation.mutate();
  };

  const copiar = (q: string) => {
    navigator.clipboard.writeText(q);
    toast.success("Palavra-chave copiada.");
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Palavras-chave</h1>
        <p className="text-sm text-muted-foreground">
          Descubra o que as pessoas mais pesquisam no Google sobre um nicho e a procura ao longo do
          tempo. Ex.: <em>dentista</em>, <em>cabeleireiro</em>, <em>oficina</em>.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
            <Input
              placeholder="Nicho ou palavra-chave (ex.: dentista)"
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
            />
            <Select
              value={geo || "world"}
              onValueChange={(v) => setGeo(v === "world" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GEOS.map((g) => (
                  <SelectItem key={g.value || "world"} value={g.value || "world"}>
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" variant="action" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Pesquisar
            </Button>
          </form>
        </CardContent>
      </Card>

      {data && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4 text-action" />
                Procura por "{data.termo}"
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Índice relativo de procura do Google (0–100). Compara a intensidade das pesquisas em
                cada período — não é o número absoluto de pesquisas.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {data.periodos.map((p) => (
                  <div
                    key={p.label}
                    className="rounded-lg border bg-muted/30 p-4 text-center"
                  >
                    <p className="text-xs font-medium text-muted-foreground">{p.label}</p>
                    <p className="mt-1 text-2xl font-bold text-foreground">{p.indice}</p>
                    <p className="text-[10px] text-muted-foreground">índice 0–100</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-action" />
                  Mais pesquisadas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.top.length === 0 && (
                  <p className="text-sm text-muted-foreground">Sem dados.</p>
                )}
                {data.top.map((k) => (
                  <button
                    key={k.query}
                    onClick={() => copiar(k.query)}
                    className="flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                  >
                    <span className="inline-flex items-center gap-2 truncate">
                      <Copy className="h-3 w-3 shrink-0 text-muted-foreground" />
                      {k.query}
                    </span>
                    <span className="shrink-0 rounded-full bg-action/10 px-2 py-0.5 text-xs font-semibold text-action">
                      {k.valor}
                    </span>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Flame className="h-4 w-4 text-warning" />
                  Em alta
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.rising.length === 0 && (
                  <p className="text-sm text-muted-foreground">Sem dados.</p>
                )}
                {data.rising.map((k) => (
                  <button
                    key={k.query}
                    onClick={() => copiar(k.query)}
                    className="flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                  >
                    <span className="inline-flex items-center gap-2 truncate">
                      <Copy className="h-3 w-3 shrink-0 text-muted-foreground" />
                      {k.query}
                    </span>
                    <span className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">
                      {k.crescimento || `+${k.valor}%`}
                    </span>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
