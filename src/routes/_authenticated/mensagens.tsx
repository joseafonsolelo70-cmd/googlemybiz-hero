import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, ExternalLink, Loader2, Mail, MessageCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Tables } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/mensagens")({
  head: () => ({ meta: [{ title: "Mensagens agendadas — JAL Digital" }] }),
  component: MensagensPage,
});

type ScheduledMessage = Tables<"scheduled_messages">;
type Lead = Tables<"leads">;

function MensagensPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: messages, isLoading } = useQuery({
    queryKey: ["scheduled_messages", user?.id], enabled: !!user,
    queryFn: async () => { const { data, error } = await supabase.from("scheduled_messages").select("*").order("send_at", { ascending: true }); if (error) throw error; return data as ScheduledMessage[]; },
  });
  const { data: leads } = useQuery({
    queryKey: ["leads", user?.id], enabled: !!user,
    queryFn: async () => { const { data, error } = await supabase.from("leads").select("*"); if (error) throw error; return data as Lead[]; },
  });
  const leadMap = useMemo(() => new Map((leads ?? []).map((lead) => [lead.id, lead])), [leads]);
  const cancelMutation = useMutation({ mutationFn: async (id: string) => { const { error } = await supabase.from("scheduled_messages").update({ status: "cancelled" }).eq("id", id); if (error) throw error; }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["scheduled_messages"] }); toast.success("Mensagem cancelada."); }, onError: () => toast.error("Não foi possível cancelar a mensagem.") });

  const openChannel = (message: ScheduledMessage) => {
    const lead = leadMap.get(message.lead_id);
    if (!lead) return;
    if (message.channel === "email" && lead.email) window.open(`mailto:${lead.email}?subject=${encodeURIComponent(message.subject ?? "")}&body=${encodeURIComponent(message.body)}`, "_blank");
    else if (lead.telefone) window.open(`https://wa.me/${lead.telefone.replace(/\D/g, "")}?text=${encodeURIComponent(message.body)}`, "_blank");
  };

  return <div className="space-y-6"><div><h1 className="text-2xl font-bold text-foreground">Mensagens agendadas</h1><p className="text-sm text-muted-foreground">Escreve uma vez, agenda o horário e acompanha toda a fila de contacto comercial.</p></div><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-4 w-4 text-action" /> Fila de envio</CardTitle></CardHeader><CardContent className="space-y-3">{isLoading ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div> : (messages ?? []).length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">Ainda não existem mensagens agendadas.</p> : (messages ?? []).map((message) => { const lead = leadMap.get(message.lead_id); const cancelled = message.status === "cancelled"; return <div key={message.id} className={`flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-start sm:justify-between ${cancelled ? "opacity-60" : ""}`}><div className="min-w-0"><div className="flex items-center gap-2"><p className="font-semibold">{lead?.nome_empresa ?? "Lead"}</p>{message.channel === "email" ? <Mail className="h-3.5 w-3.5 text-muted-foreground" /> : <MessageCircle className="h-3.5 w-3.5 text-success" />}</div><p className="text-xs text-muted-foreground">{format(new Date(message.send_at), "dd/MM/yyyy HH:mm")} · {message.status === "pending" ? "Pendente" : message.status === "sent" ? "Enviada" : message.status === "cancelled" ? "Cancelada" : message.status}</p><p className="mt-2 whitespace-pre-wrap text-sm">{message.body}</p></div><div className="flex shrink-0 gap-2">{message.status === "pending" && <><Button variant="outline" size="sm" onClick={() => openChannel(message)}><ExternalLink className="h-4 w-4" /> Abrir canal</Button><Button variant="ghost" size="sm" onClick={() => cancelMutation.mutate(message.id)}><XCircle className="h-4 w-4" /> Cancelar</Button></>}{message.status === "sent" && <CheckCircle2 className="mt-2 h-5 w-5 text-success" />}</div></div>; })}</CardContent></Card><p className="text-xs text-muted-foreground">Nota: a fila já está preparada para um trabalhador de envio oficial. Sem WhatsApp Business API ou provedor de e-mail ligado, o botão “Abrir canal” abre a mensagem pronta sem afirmar que foi enviada automaticamente.</p></div>;
}
