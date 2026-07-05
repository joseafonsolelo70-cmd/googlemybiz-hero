import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Sparkles,
  Copy,
  Star,
  Phone,
  Globe,
  MapPin,
  CalendarClock,
  MessageSquarePlus,
  Send,
  Bot,
  User as UserIcon,
  ImagePlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { gerarAbordagem } from "@/lib/ai.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Tables } from "@/integrations/supabase/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScoreBadge } from "@/components/score-badge";
import { whatsappLink } from "@/lib/utils";

type MensagemTurno = { autor: "vendedor" | "cliente"; texto: string; imagens?: string[] };

type Lead = Tables<"leads">;
type EtapaFunil = "novo" | "contato" | "proposta" | "fechado";

const ETAPAS: { value: EtapaFunil; label: string; hint: string }[] = [
  { value: "novo", label: "Chegada", hint: "Primeiro contacto — quebrar o gelo" },
  { value: "contato", label: "Acompanhamento", hint: "Reativar e nutrir o interesse" },
  { value: "proposta", label: "Proposta", hint: "Negociar e desfazer objeções" },
  { value: "fechado", label: "Fechamento", hint: "Agradecer e confirmar próximos passos" },
];

export function LeadDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const gerar = useServerFn(gerarAbordagem);
  const [conversa, setConversa] = useState<MensagemTurno[]>([]);
  const [clienteInput, setClienteInput] = useState("");
  const [anexos, setAnexos] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [canal, setCanal] = useState<"whatsapp" | "email">("whatsapp");
  const [followup, setFollowup] = useState("");
  const [nota, setNota] = useState("");
  const [etapa, setEtapa] = useState<EtapaFunil>(
    (lead?.status_funil as EtapaFunil | null) ?? "novo",
  );

  // Reinicia a conversa ao abrir/trocar de lead, recuperando a última abordagem salva.
  useEffect(() => {
    if (lead && open) {
      setConversa(
        lead.abordagem_ia ? [{ autor: "vendedor", texto: lead.abordagem_ia }] : [],
      );
      setClienteInput("");
      setAnexos([]);
      setEtapa((lead.status_funil as EtapaFunil | null) ?? "novo");
    }
  }, [lead, open]);

  const { data: interacoes } = useQuery({
    queryKey: ["interacoes", lead?.id],
    enabled: !!lead && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interacoes")
        .select("*")
        .eq("lead_id", lead!.id)
        .order("data", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const gerarMutation = useMutation({
    mutationFn: (historico: MensagemTurno[]) =>
      gerar({ data: { leadId: lead!.id, canal, etapa, historico } }),
    onSuccess: async (res, historico) => {
      if (!res.texto.trim()) {
        toast.error("A IA não retornou texto. Tente novamente.");
        return;
      }
      const novaConversa: MensagemTurno[] = [
        ...historico,
        { autor: "vendedor", texto: res.texto },
      ];
      setConversa(novaConversa);
      setClienteInput("");
      setAnexos([]);
      await supabase.from("leads").update({ abordagem_ia: res.texto }).eq("id", lead!.id);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Mensagem gerada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const gerarPrimeira = () => gerarMutation.mutate([]);

  const responder = () => {
    const texto = clienteInput.trim();
    if (!texto && anexos.length === 0) {
      toast.error("Escreva o que o cliente respondeu ou anexe uma imagem.");
      return;
    }
    gerarMutation.mutate([...conversa, { autor: "cliente", texto, imagens: anexos }]);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const restantes = 4 - anexos.length;
    if (restantes <= 0) {
      toast.error("Máximo de 4 imagens por mensagem.");
      return;
    }
    const selecionados = Array.from(files).slice(0, restantes);
    const novos: string[] = [];
    for (const file of selecionados) {
      if (!file.type.startsWith("image/")) {
        toast.error(`"${file.name}" não é uma imagem.`);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`"${file.name}" é maior que 5 MB.`);
        continue;
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      novos.push(dataUrl);
    }
    if (novos.length) setAnexos((prev) => [...prev, ...novos]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removerAnexo = (idx: number) =>
    setAnexos((prev) => prev.filter((_, i) => i !== idx));

  const copyTexto = (texto: string) => {
    navigator.clipboard.writeText(texto);
    toast.success("Copiado!");
  };


  const followupMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("leads")
        .update({ proximo_followup: followup ? new Date(followup).toISOString() : null })
        .eq("id", lead!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Follow-up agendado.");
    },
    onError: () => toast.error("Não foi possível agendar."),
  });

  const notaMutation = useMutation({
    mutationFn: async (tipo: Tables<"interacoes">["tipo"]) => {
      const { error } = await supabase.from("interacoes").insert({
        lead_id: lead!.id,
        user_id: user!.id,
        notas: nota,
        tipo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNota("");
      queryClient.invalidateQueries({ queryKey: ["interacoes", lead?.id] });
      toast.success("Interação registada.");
    },
    onError: () => toast.error("Não foi possível registar."),
  });

  if (!lead) return null;

  const temConversa = conversa.length > 0;


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">{lead.nome_empresa}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <ScoreBadge score={lead.score_seo ?? 0} />
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 text-sm text-muted-foreground">
          {lead.rating != null && (
            <p className="flex items-center gap-2">
              <Star className="h-3.5 w-3.5 fill-warning text-warning" />
              {lead.rating} · {lead.total_avaliacoes} avaliações
            </p>
          )}
          {lead.endereco && (
            <p className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5" /> {lead.endereco}
            </p>
          )}
          {lead.telefone && (
            <a
              href={whatsappLink(lead.telefone) ?? undefined}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-action hover:underline"
            >
              <Phone className="h-3.5 w-3.5" /> {lead.telefone}
              <span className="text-xs text-muted-foreground">(WhatsApp)</span>
            </a>
          )}
          {lead.website && (
            <a
              href={lead.website}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-action hover:underline"
            >
              <Globe className="h-3.5 w-3.5" /> {lead.website}
            </a>
          )}
        </div>

        <Tabs defaultValue="ia" className="mt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ia">Abordagem IA</TabsTrigger>
            <TabsTrigger value="followup">Follow-up</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="ia" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Etapa do cliente no funil</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {ETAPAS.map((e) => (
                  <button
                    key={e.value}
                    type="button"
                    onClick={() => setEtapa(e.value)}
                    className={`rounded-md border px-2 py-1.5 text-left text-xs transition-colors ${
                      etapa === e.value
                        ? "border-action bg-action/10 text-action"
                        : "border-border text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <span className="block font-medium">{e.label}</span>
                    <span className="block text-[10px] leading-tight opacity-80">{e.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Canal</Label>
              <div className="flex gap-1.5">
                {(["whatsapp", "email"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCanal(c)}
                    className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium capitalize transition-colors ${
                      canal === c
                        ? "border-action bg-action/10 text-action"
                        : "border-border text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    {c === "whatsapp" ? "WhatsApp" : "E-mail"}
                  </button>
                ))}
              </div>
            </div>

            {/* Conversa */}
            {temConversa ? (
              <div className="space-y-2 rounded-md border bg-muted/20 p-2">
                {conversa.map((m, i) => (
                  <div
                    key={i}
                    className={`flex gap-2 ${m.autor === "cliente" ? "flex-row-reverse" : ""}`}
                  >
                    <div
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                        m.autor === "vendedor"
                          ? "bg-action/15 text-action"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {m.autor === "vendedor" ? (
                        <Bot className="h-3.5 w-3.5" />
                      ) : (
                        <UserIcon className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        m.autor === "vendedor"
                          ? "bg-card text-foreground"
                          : "bg-action text-action-foreground"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.texto}</p>
                      {m.autor === "vendedor" && (
                        <button
                          type="button"
                          onClick={() => copyTexto(m.texto)}
                          className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-action"
                        >
                          <Copy className="h-3 w-3" /> Copiar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {gerarMutation.isPending && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> A IA está a escrever...
                  </div>
                )}
              </div>
            ) : (
              <p className="rounded-md border border-dashed bg-muted/10 p-3 text-center text-xs text-muted-foreground">
                Gere a primeira abordagem e depois diga aqui o que o cliente respondeu — a IA cria a
                resposta certa para enviar.
              </p>
            )}

            {/* Ações */}
            {!temConversa ? (
              <Button
                variant="action"
                size="sm"
                className="w-full"
                disabled={gerarMutation.isPending}
                onClick={gerarPrimeira}
              >
                {gerarMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Gerar primeira abordagem
              </Button>
            ) : (
              <div className="space-y-2">
                <Textarea
                  value={clienteInput}
                  onChange={(e) => setClienteInput(e.target.value)}
                  placeholder="O que o cliente respondeu? Ex.: 'Quanto custa?' ou 'Já tenho quem faz isso'"
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button
                    variant="action"
                    size="sm"
                    className="flex-1"
                    disabled={gerarMutation.isPending || !clienteInput.trim()}
                    onClick={responder}
                  >
                    {gerarMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Gerar resposta da IA
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={gerarMutation.isPending}
                    onClick={gerarPrimeira}
                    title="Recomeçar a conversa com uma nova abordagem"
                  >
                    <Sparkles className="h-4 w-4" /> Recomeçar
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>


          <TabsContent value="followup" className="space-y-3 pt-3">
            <Label htmlFor="followup">Próximo lembrete</Label>
            <Input
              id="followup"
              type="datetime-local"
              value={followup}
              onChange={(e) => setFollowup(e.target.value)}
            />
            {lead.proximo_followup && (
              <p className="text-xs text-muted-foreground">
                Atual: {format(new Date(lead.proximo_followup), "dd/MM/yyyy HH:mm")}
              </p>
            )}
            <Button
              variant="action"
              size="sm"
              className="w-full"
              disabled={followupMutation.isPending}
              onClick={() => followupMutation.mutate()}
            >
              <CalendarClock className="h-4 w-4" /> Agendar follow-up
            </Button>
          </TabsContent>

          <TabsContent value="historico" className="space-y-3 pt-3">
            <Textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Registar uma nota, chamada ou mensagem..."
              rows={3}
            />
            <div className="flex flex-wrap gap-2">
              {(["chamada", "mensagem", "email", "nota"] as const).map((t) => (
                <Button
                  key={t}
                  variant="outline"
                  size="sm"
                  disabled={!nota.trim() || notaMutation.isPending}
                  onClick={() => notaMutation.mutate(t)}
                >
                  <MessageSquarePlus className="h-4 w-4" /> {t}
                </Button>
              ))}
            </div>
            <div className="space-y-2">
              {interacoes?.length === 0 && (
                <p className="text-xs text-muted-foreground">Sem interações ainda.</p>
              )}
              {interacoes?.map((i) => (
                <div key={i.id} className="rounded-md border bg-muted/30 p-2 text-sm">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-medium capitalize">{i.tipo}</span>
                    <span>{format(new Date(i.data), "dd/MM/yyyy HH:mm")}</span>
                  </div>
                  {i.notas && <p className="mt-1 text-foreground">{i.notas}</p>}
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
