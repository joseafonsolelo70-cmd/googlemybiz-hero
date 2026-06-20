import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ChevronLeft, ChevronRight, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Tables, Enums } from "@/integrations/supabase/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScoreBadge } from "@/components/score-badge";
import { LeadDialog } from "@/components/lead-dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({ meta: [{ title: "CRM de Leads — GMN Prospect" }] }),
  component: CrmPage,
});

type Lead = Tables<"leads">;
type Status = Enums<"status_funil">;

const COLUMNS: { key: Status; label: string; accent: string }[] = [
  { key: "novo", label: "Novo", accent: "border-t-chart-1" },
  { key: "contato", label: "Contato", accent: "border-t-chart-3" },
  { key: "proposta", label: "Proposta", accent: "border-t-warning" },
  { key: "fechado", label: "Fechado", accent: "border-t-success" },
  { key: "perdido", label: "Perdido", accent: "border-t-destructive" },
];

const ORDER: Status[] = ["novo", "contato", "proposta", "fechado"];

function CrmPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Lead | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: leads, isLoading } = useQuery({
    queryKey: ["leads", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Lead[];
    },
  });

  const moveMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const { error } = await supabase.from("leads").update({ status_funil: status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
    onError: () => toast.error("Não foi possível mover o lead."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead removido.");
    },
    onError: () => toast.error("Não foi possível remover."),
  });

  const move = (lead: Lead, dir: -1 | 1) => {
    const idx = ORDER.indexOf(lead.status_funil);
    if (idx === -1) {
      // from "perdido" back to novo
      if (dir === 1) moveMutation.mutate({ id: lead.id, status: "novo" });
      return;
    }
    const next = ORDER[idx + dir];
    if (next) moveMutation.mutate({ id: lead.id, status: next });
  };

  const openLead = (lead: Lead) => {
    setSelected(lead);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">CRM de Leads</h1>
        <p className="text-sm text-muted-foreground">
          Arraste o seu pipeline com os botões e clique num lead para gerar abordagens.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {COLUMNS.map((col) => {
            const colLeads = (leads ?? []).filter((l) => l.status_funil === col.key);
            return (
              <div key={col.key} className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-sm font-semibold text-foreground">{col.label}</h2>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {colLeads.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {colLeads.map((lead) => (
                    <Card
                      key={lead.id}
                      className={cn("border-t-4 transition-shadow hover:shadow-md", col.accent)}
                    >
                      <CardContent className="space-y-2 p-3">
                        <button
                          onClick={() => openLead(lead)}
                          className="block w-full text-left"
                        >
                          <p className="truncate font-semibold text-foreground">
                            {lead.nome_empresa}
                          </p>
                          {lead.rating != null && (
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                              <Star className="h-3 w-3 fill-warning text-warning" />
                              {lead.rating} ({lead.total_avaliacoes})
                            </p>
                          )}
                          <div className="mt-2">
                            <ScoreBadge score={lead.score_seo ?? 0} />
                          </div>
                        </button>
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => move(lead, -1)}
                              disabled={lead.status_funil === "novo"}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => move(lead, 1)}
                              disabled={lead.status_funil === "fechado"}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteMutation.mutate(lead.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {colLeads.length === 0 && (
                    <p className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">
                      Vazio
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <LeadDialog lead={selected} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
