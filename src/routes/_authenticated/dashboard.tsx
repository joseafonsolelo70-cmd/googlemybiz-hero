import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Flame,
  CalendarClock,
  CheckCircle2,
  Loader2,
  ArrowUpRight,
  Star,
} from "lucide-react";
import { format, isToday, isPast } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Tables } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScoreBadge } from "@/components/score-badge";
import { oportunidadeFromScore } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — GMN Prospect" }] }),
  component: DashboardPage,
});

type Lead = Tables<"leads">;

function DashboardPage() {
  const { user } = useAuth();

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

  const all = leads ?? [];
  const total = all.length;
  const fechados = all.filter((l) => l.status_funil === "fechado").length;
  const oportunidadesAltas = all.filter(
    (l) => oportunidadeFromScore(l.score_seo ?? 0) === "alta",
  ).length;
  const followupsHoje = all.filter(
    (l) => l.proximo_followup && (isToday(new Date(l.proximo_followup)) || isPast(new Date(l.proximo_followup))),
  );

  const stats = [
    { label: "Total de leads", value: total, icon: Users, color: "text-chart-1" },
    { label: "Oportunidades altas", value: oportunidadesAltas, icon: Flame, color: "text-success" },
    { label: "Follow-ups pendentes", value: followupsHoje.length, icon: CalendarClock, color: "text-warning" },
    { label: "Contratos fechados", value: fechados, icon: CheckCircle2, color: "text-action" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Resumo da sua prospecção e tarefas do dia.
          </p>
        </div>
        <Button variant="action" asChild>
          <Link to="/prospeccao">
            Nova prospecção <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {stats.map((s) => (
              <Card key={s.label}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">
                      {s.value}
                    </p>
                  </div>
                  <s.icon className={`h-8 w-8 ${s.color}`} />
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarClock className="h-4 w-4 text-warning" />
                  Follow-ups do dia
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {followupsHoje.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Nenhum follow-up pendente. 🎉
                  </p>
                ) : (
                  followupsHoje.map((l) => (
                    <Link
                      key={l.id}
                      to="/crm"
                      className="flex items-center justify-between rounded-md border p-2 text-sm transition-colors hover:bg-muted/50"
                    >
                      <span className="font-medium text-foreground">{l.nome_empresa}</span>
                      <span className="text-xs text-muted-foreground">
                        {l.proximo_followup &&
                          format(new Date(l.proximo_followup), "dd/MM HH:mm")}
                      </span>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Flame className="h-4 w-4 text-success" />
                  Melhores oportunidades
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {all.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Ainda sem leads. Comece pela{" "}
                    <Link to="/prospeccao" className="text-action hover:underline">
                      Prospecção
                    </Link>
                    .
                  </p>
                ) : (
                  [...all]
                    .sort((a, b) => (a.score_seo ?? 0) - (b.score_seo ?? 0))
                    .slice(0, 5)
                    .map((l) => (
                      <Link
                        key={l.id}
                        to="/crm"
                        className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm transition-colors hover:bg-muted/50"
                      >
                        <span className="min-w-0 truncate font-medium text-foreground">
                          {l.nome_empresa}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          {l.rating != null && (
                            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                              <Star className="h-3 w-3 fill-warning text-warning" />
                              {l.rating}
                            </span>
                          )}
                          <ScoreBadge score={l.score_seo ?? 0} />
                        </span>
                      </Link>
                    ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
