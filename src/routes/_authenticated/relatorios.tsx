import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Flame, Loader2, Search, Target } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreBadge } from "@/components/score-badge";
import { exportarLeadsCsv, prioridadeLabel, temperaturaLabel } from "@/lib/premium";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — JAL Digital" }] }),
  component: RelatoriosPage,
});

function RelatoriosPage() {
  const { user } = useAuth();
  const [filtro, setFiltro] = useState("");
  const [minPrioridade, setMinPrioridade] = useState(0);
  const { data: leads, isLoading } = useQuery({
    queryKey: ["leads", "report", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").order("score_prioridade", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtrados = useMemo(() => {
    const termo = filtro.trim().toLowerCase();
    return (leads ?? []).filter((lead) => {
      const matchesText = !termo || [lead.nome_empresa, lead.nicho, lead.cidade, lead.telefone].some((v) => v?.toLowerCase().includes(termo));
      return matchesText && (lead.score_prioridade ?? 0) >= minPrioridade;
    });
  }, [leads, filtro, minPrioridade]);

  const exportar = () => {
    const blob = new Blob(["\ufeff" + exportarLeadsCsv(filtrados)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jal-digital-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filtrados.length} leads exportados.`);
  };

  const pipeline = filtrados.reduce((sum, lead) => sum + (lead.valor_estimado ?? 0), 0);
  const urgentes = filtrados.filter((lead) => (lead.score_prioridade ?? 0) >= 80).length;
  const quentes = filtrados.filter((lead) => lead.temperatura === "quente").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios premium</h1>
          <p className="text-sm text-muted-foreground">Encontre rapidamente os leads com maior potencial comercial e exporte a sua lista de trabalho.</p>
        </div>
        <Button variant="action" onClick={exportar} disabled={filtrados.length === 0}><Download className="h-4 w-4" /> Exportar CSV</Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">Leads filtrados</p><p className="text-2xl font-bold">{filtrados.length}</p></div><Target className="h-7 w-7 text-action" /></CardContent></Card>
        <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">Prioridade máxima</p><p className="text-2xl font-bold">{urgentes}</p></div><Flame className="h-7 w-7 text-warning" /></CardContent></Card>
        <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">Pipeline estimado</p><p className="text-2xl font-bold">{pipeline.toLocaleString("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}</p></div><FileSpreadsheet className="h-7 w-7 text-success" /></CardContent></Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Empresa, nicho, cidade ou telefone" className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" /></div>
          <select value={minPrioridade} onChange={(e) => setMinPrioridade(Number(e.target.value))} className="h-9 rounded-md border border-input bg-background px-3 text-sm"><option value={0}>Todas as prioridades</option><option value={35}>Prioridade média+</option><option value={60}>Prioridade alta+</option><option value={80}>Prioridade máxima</option></select>
        </CardContent>
      </Card>

      {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : (
        <Card>
          <CardHeader><CardTitle className="text-base">Fila de prospecção ({quentes} leads quentes)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {filtrados.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum lead corresponde aos filtros.</p>}
            {filtrados.map((lead) => <div key={lead.id} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate font-semibold">{lead.nome_empresa}</p><p className="text-xs text-muted-foreground">{[lead.nicho, lead.cidade].filter(Boolean).join(" · ") || "Sem segmento definido"}</p><p className="mt-1 text-xs text-muted-foreground">Próxima ação: {lead.proxima_acao || "Definir próxima ação"}</p></div><div className="flex shrink-0 items-center gap-2"><ScoreBadge score={lead.score_seo ?? 0} /><span className="rounded-full bg-action/10 px-2 py-1 text-xs font-semibold text-action">{lead.score_prioridade ?? 0} · {prioridadeLabel(lead.score_prioridade ?? 0)}</span><span className="rounded-full bg-muted px-2 py-1 text-xs capitalize text-muted-foreground">{temperaturaLabel(lead.temperatura)}</span></div></div>)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
