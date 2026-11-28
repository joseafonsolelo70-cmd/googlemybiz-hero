import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Globe2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const REPO_URL = "https://github.com/joseafonsolelo70-cmd/googlemybiz-hero";
type Lead = Tables<"leads">;

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function SiteBuilderDialog({ lead, open, onOpenChange }: { lead: Lead | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ nicho: "", cidade: "", telefone: "", email: "", whatsapp: "", servicos: "", descricao: "", chamada: "Pedir orçamento", cor: "#7c3aed", logo: "" });

  useEffect(() => {
    if (!lead || !open) return;
    setForm({ nicho: lead.nicho ?? "", cidade: lead.cidade ?? "", telefone: lead.telefone ?? "", email: lead.email ?? "", whatsapp: lead.telefone ?? "", servicos: lead.servico_interesse ?? "", descricao: "", chamada: "Pedir orçamento", cor: "#7c3aed", logo: "" });
  }, [lead, open]);

  const slug = useMemo(() => slugify(lead?.nome_empresa ?? "novo-site"), [lead?.nome_empresa]);
  const briefing = lead ? `Criar um website profissional, rápido e responsivo para ${lead.nome_empresa}, negócio de ${form.nicho || "serviços locais"} em ${form.cidade || "Portugal"}.\n\nServiços: ${form.servicos || "A definir com o cliente"}.\nDescrição: ${form.descricao || "Apresentar a empresa, gerar confiança e captar pedidos de orçamento."}\nCTA principal: ${form.chamada}.\nContacto: ${form.telefone || "não definido"} | ${form.email || "não definido"}.\nWhatsApp: ${form.whatsapp || "não definido"}.\nIdentidade: cor ${form.cor}${form.logo ? `, logótipo ${form.logo}` : ""}.\n\nUsar a identidade JAL Digital apenas como contexto interno; a marca visível deve ser a do cliente.` : "";

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!lead || !user) throw new Error("Sessão inválida.");
      const { error } = await supabase.from("site_projects").upsert({ user_id: user.id, lead_id: lead.id, slug, nome_empresa: lead.nome_empresa, nicho: form.nicho || null, cidade: form.cidade || null, telefone: form.telefone || null, email: form.email || null, whatsapp: form.whatsapp || null, servicos: form.servicos || null, descricao: form.descricao || null, chamada_acao: form.chamada || null, cor_marca: form.cor, logo_url: form.logo || null, briefing, status: "briefing", github_path: `client-sites/${slug}` }, { onConflict: "user_id,slug" });
      if (error) throw error;
      await supabase.from("leads").update({ website_status: "em_criacao", proxima_acao: "Apresentar proposta de website" }).eq("id", lead.id);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["leads"] }); queryClient.invalidateQueries({ queryKey: ["site_projects"] }); toast.success("Briefing guardado. O site está pronto para ser criado no repositório ligado à Lovable."); },
    onError: (error: Error) => toast.error(error.message || "Não foi possível guardar o briefing."),
  });

  const copyBriefing = async () => { await navigator.clipboard.writeText(briefing); toast.success("Briefing copiado para a Lovable."); };
  if (!lead) return null;

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle className="flex items-center gap-2"><Globe2 className="h-5 w-5 text-action" /> Criar site para {lead.nome_empresa}</DialogTitle><DialogDescription>Recolhe os dados do negócio, guarda o projecto e prepara o briefing para gerar o site no repositório GitHub ligado à Lovable.</DialogDescription></DialogHeader>
    <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><div><Label>Nicho</Label><Input value={form.nicho} onChange={(e) => setForm({ ...form, nicho: e.target.value })} placeholder="Ex.: clínica dentária" /></div><div><Label>Cidade</Label><Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} placeholder="Ex.: Luanda" /></div><div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div><div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div><div><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div><div><Label>CTA principal</Label><Input value={form.chamada} onChange={(e) => setForm({ ...form, chamada: e.target.value })} /></div></div><div><Label>Serviços principais</Label><Input value={form.servicos} onChange={(e) => setForm({ ...form, servicos: e.target.value })} placeholder="Separe por vírgulas" /></div><div><Label>Descrição e diferenciais</Label><Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="O que torna este negócio especial?" rows={3} /></div><div className="grid gap-3 sm:grid-cols-2"><div><Label>URL do logótipo (opcional)</Label><Input value={form.logo} onChange={(e) => setForm({ ...form, logo: e.target.value })} placeholder="https://..." /></div><div><Label>Cor principal</Label><div className="flex gap-2"><Input type="color" value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} className="w-14 p-1" /><Input value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} /></div></div></div><div className="rounded-md border bg-muted/20 p-3"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold">Briefing para Lovable</p><Button variant="ghost" size="sm" onClick={copyBriefing}><Copy className="h-3.5 w-3.5" /> Copiar</Button></div><p className="whitespace-pre-wrap text-xs text-muted-foreground">{briefing}</p><p className="mt-2 text-[11px] text-muted-foreground">Destino previsto: <span className="font-medium">{REPO_URL}/tree/main/client-sites/{slug}</span></p></div><div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => window.open(REPO_URL, "_blank")}><ExternalLink className="h-4 w-4" /> Abrir GitHub</Button><Button variant="action" disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>{createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Guardar e preparar site</Button></div></div>
  </DialogContent></Dialog>;
}
