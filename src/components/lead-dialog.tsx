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
type AnaliseAbordagem = {
  nomeNegocio: string;
  oportunidade: string;
  evidencia: string;
  oportunidadeComercial: string;
  perguntaFinal: string;
  assunto: string;
};

type Lead = Tables<"leads">;
type EtapaFunil = "novo" | "contato" | "proposta" | "fechado";

const ETAPAS: { value: EtapaFunil; label: string; hint: string }[] = [
  { value: "novo", label: "Chegada", hint: "Primeiro contacto — quebrar o gelo" },
  { value: "contato", label: "Acompanhamento", hint: "Reativar e nutrir o interesse" },
  { value: "proposta", label: "Proposta", hint: "Negociar e desfazer objeções" },
  { value: "fechado", label: "Fechamento", hint: "Agradecer e confirmar próximos passos" },
];

const FOLLOWUP_TEMPLATES = [
  "Olá! Veja, por favor, a minha última mensagem. Posso criar um site profissional para a {empresa}, apresentar bem os vossos serviços e melhorar a vossa visibilidade online. Posso enviar-lhe uma demonstração sem compromisso?",
  "Olá novamente! Talvez ainda não tenha conseguido ver a minha mensagem. Estou a falar de um site para a {empresa}, pensado para mostrar os vossos serviços com clareza e gerar mais contactos. Posso enviar-lhe uma demonstração?",
  "Bom dia! Um site bem apresentado ajuda os clientes a conhecer a {empresa} antes de entrar em contacto. A JAL Digital pode criar uma solução profissional à vossa medida. Quer ver um exemplo de demonstração?",
  "Olá! Só queria reforçar a minha proposta: criar um site moderno para a {empresa}, com os vossos serviços, contactos e uma apresentação que transmita confiança. Posso preparar e mostrar-lhe uma demonstração?",
  "Olá! Muitas pessoas procuram uma empresa online antes de pedir um orçamento. Um site pode apresentar melhor a {empresa} e transformar visitas em contactos. Quer que lhe mostre como poderia ficar?",
  "Bom dia! Posso criar para a {empresa} um site simples, profissional e adaptado ao vosso serviço, para melhorar a visibilidade e facilitar os pedidos de contacto. Posso enviar uma demonstração?",
  "Olá! A minha proposta é exclusivamente sobre a criação de um site para a {empresa}. O site apresentará os vossos serviços, contactos e diferenciais de forma profissional. Posso mostrar-lhe uma demonstração?",
  "Olá novamente! Se a {empresa} ainda não tem um site ou se o atual não apresenta bem o vosso serviço, posso ajudar. Quer receber uma demonstração de um site pensado para o vosso negócio?",
  "Olá! Faço este último acompanhamento porque acredito que um site profissional pode ajudar a {empresa} a ganhar visibilidade e confiança. Se quiser, preparo uma demonstração para ver sem compromisso.",
  "Olá! Este será o meu último contacto sobre a criação do site. Se quiser melhorar a visibilidade da {empresa} e apresentar melhor os vossos serviços, pode chamar-me para ver uma demonstração. Desejo-vos muito sucesso!",
];

function mensagemFollowup(indice: number, empresa: string): string {
  return FOLLOWUP_TEMPLATES[indice - 1].replaceAll("{empresa}", empresa);
}

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
  const [analise, setAnalise] = useState<AnaliseAbordagem | null>(null);
  const [clienteInput, setClienteInput] = useState("");
  const [anexos, setAnexos] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [canal, setCanal] = useState<"whatsapp" | "email">("whatsapp");
  const [followupMessage, setFollowupMessage] = useState("");
  const [followupSubject, setFollowupSubject] = useState("");
  const [followupStep, setFollowupStep] = useState(1);
  const [nota, setNota] = useState("");
  const [email, setEmail] = useState("");
  const [decisor, setDecisor] = useState("");
  const [valorEstimado, setValorEstimado] = useState("");
  const [etapa, setEtapa] = useState<EtapaFunil>(
    (lead?.status_funil as EtapaFunil | null) ?? "novo",
  );

  // Reinicia a conversa ao abrir/trocar de lead, recuperando a última abordagem salva.
  useEffect(() => {
    if (lead && open) {
      setConversa(lead.abordagem_ia ? [{ autor: "vendedor", texto: lead.abordagem_ia }] : []);
      setAnalise(null);
      setClienteInput("");
      setAnexos([]);
      setEtapa((lead.status_funil as EtapaFunil | null) ?? "novo");
      setEmail(lead.email ?? "");
      setDecisor(lead.decisor ?? "");
      setValorEstimado(lead.valor_estimado?.toString() ?? "");
      setFollowupSubject("");
      const nextFollowup = Math.min(Math.max((lead.tentativas_contacto ?? 0) + 1, 1), 10);
      setFollowupStep(nextFollowup);
      setFollowupMessage(mensagemFollowup(nextFollowup, lead.nome_empresa));
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
      const novaConversa: MensagemTurno[] = [...historico, { autor: "vendedor", texto: res.texto }];
      setAnalise(res.analise);
      setConversa(novaConversa);
      setClienteInput("");
      setAnexos([]);
      const { error } = await supabase.from("leads").update({
        abordagem_ia: res.texto,
        tentativas_contacto: (lead!.tentativas_contacto ?? 0) + 1,
        ultima_interacao_at: new Date().toISOString(),
      }).eq("id", lead!.id);
      if (error) throw error;
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

  const removerAnexo = (idx: number) => setAnexos((prev) => prev.filter((_, i) => i !== idx));

  const copyTexto = (texto: string) => {
    navigator.clipboard.writeText(texto);
    toast.success("Copiado!");
  };

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

  const dadosComerciaisMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("leads").update({
        email: email.trim() || null,
        decisor: decisor.trim() || null,
        valor_estimado: valorEstimado ? Number(valorEstimado) : null,
      }).eq("id", lead!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Dados comerciais atualizados.");
    },
    onError: () => toast.error("Não foi possível guardar os dados comerciais."),
  });

  const registarFollowupMutation = useMutation({
    mutationFn: async () => {
      const texto = followupMessage.trim();
      if (!texto) throw new Error("Escreve primeiro a mensagem de follow-up.");
      const [{ error: interactionError }, { error: leadError }] = await Promise.all([
        supabase.from("interacoes").insert({ lead_id: lead!.id, user_id: user!.id, notas: texto, tipo: canal === "email" ? "email" : "mensagem" }),
        supabase.from("leads").update({ tentativas_contacto: (lead!.tentativas_contacto ?? 0) + 1, ultima_interacao_at: new Date().toISOString(), proxima_acao: "Aguardar resposta ao follow-up" }).eq("id", lead!.id),
      ]);
      if (interactionError || leadError) throw interactionError ?? leadError;
    },
    onSuccess: () => {
      const nextFollowup = Math.min(followupStep + 1, 10);
      setFollowupStep(nextFollowup);
      setFollowupMessage(mensagemFollowup(nextFollowup, lead!.nome_empresa));
      setFollowupSubject("");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["interacoes", lead?.id] });
      toast.success(followupStep < 10 ? `Follow-up ${followupStep} registado. Próxima mensagem preparada.` : "Décimo follow-up registado. Agora deixa o cliente responder.");
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível registar o follow-up."),
  });

  const abrirCanalFollowup = () => {
    const texto = followupMessage.trim();
    if (!texto) { toast.error("Escreve primeiro a mensagem de follow-up."); return; }
    if (canal === "email") {
      if (!email) { toast.error("Este lead ainda não tem e-mail."); return; }
      window.open(`mailto:${email}?subject=${encodeURIComponent(followupSubject || "Follow-up — JAL Digital")}&body=${encodeURIComponent(texto)}`, "_blank");
    } else {
      if (!lead.telefone) { toast.error("Este lead ainda não tem telefone."); return; }
      window.open(`https://wa.me/${lead.telefone.replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`, "_blank");
    }
    registarFollowupMutation.mutate();
  };

  if (!lead) return null;

  const temConversa = conversa.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">{lead.nome_empresa}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <ScoreBadge score={lead.score_seo ?? 0} />
            <span className="rounded-full bg-action/10 px-2 py-1 text-xs font-medium text-action">Comercial {lead.score_comercial ?? 0}</span>
            <span className="rounded-full bg-warning/10 px-2 py-1 text-xs font-medium text-warning">Prioridade {lead.score_prioridade ?? 0}</span>
            <span className="rounded-full bg-muted px-2 py-1 text-xs capitalize text-muted-foreground">{lead.temperatura ?? "frio"}</span>
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
                {analise && (
                  <div className="space-y-2 border-l-2 border-action px-3 py-2 text-sm">
                    <p className="font-semibold text-foreground">Análise do negócio</p>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Negócio</p>
                      <p className="whitespace-pre-wrap text-foreground">{analise.nomeNegocio}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Oportunidade</p>
                      <p className="whitespace-pre-wrap text-foreground">{analise.oportunidade}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Evidência</p>
                      <p className="whitespace-pre-wrap text-foreground">{analise.evidencia}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        Oportunidade comercial
                      </p>
                      <p className="whitespace-pre-wrap text-foreground">
                        {analise.oportunidadeComercial}
                      </p>
                    </div>
                    {analise.assunto && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Assunto</p>
                        <p className="whitespace-pre-wrap text-foreground">{analise.assunto}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Pergunta final</p>
                      <p className="whitespace-pre-wrap text-foreground">{analise.perguntaFinal}</p>
                    </div>
                  </div>
                )}
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
                      {m.imagens && m.imagens.length > 0 && (
                        <div className="mb-1 flex flex-wrap gap-1.5">
                          {m.imagens.map((src, idx) => (
                            <img
                              key={idx}
                              src={src}
                              alt={`Anexo ${idx + 1}`}
                              className="h-20 w-20 rounded-md border border-border object-cover"
                            />
                          ))}
                        </div>
                      )}
                      {m.texto && <p className="whitespace-pre-wrap break-words">{m.texto}</p>}
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

                {/* Pré-visualização dos anexos */}
                {anexos.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {anexos.map((src, idx) => (
                      <div key={idx} className="relative">
                        <img
                          src={src}
                          alt={`Anexo ${idx + 1}`}
                          className="h-16 w-16 rounded-md border border-border object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removerAnexo(idx)}
                          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow"
                          aria-label="Remover anexo"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={gerarMutation.isPending || anexos.length >= 4}
                    onClick={() => fileInputRef.current?.click()}
                    title="Anexar captura de ecrã ou imagem"
                  >
                    <ImagePlus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="action"
                    size="sm"
                    className="flex-1"
                    disabled={
                      gerarMutation.isPending || (!clienteInput.trim() && anexos.length === 0)
                    }
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
            <div className="rounded-md border border-action/30 bg-action/5 p-3">
              <p className="mb-1 text-sm font-semibold text-foreground">Sequência de follow-up</p>
              <p className="mb-3 text-xs text-muted-foreground">Escolhe o contacto seguinte. As mensagens já estão preparadas para clientes que ainda não responderam.</p>
              <div className="mb-2 flex gap-1.5">
                {(["whatsapp", "email"] as const).map((c) => <button key={c} type="button" onClick={() => setCanal(c)} className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium ${canal === c ? "border-action bg-action/10 text-action" : "border-border text-muted-foreground"}`}>{c === "whatsapp" ? "WhatsApp" : "E-mail"}</button>)}
              </div>
              <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
                {FOLLOWUP_TEMPLATES.map((_, index) => { const step = index + 1; return <button key={step} type="button" onClick={() => { setFollowupStep(step); setFollowupMessage(mensagemFollowup(step, lead.nome_empresa)); }} className={`rounded-md border px-1 py-1.5 text-[10px] font-semibold ${followupStep === step ? "border-action bg-action text-action-foreground" : "border-border text-muted-foreground hover:bg-muted"}`}>{step}º</button>; })}
              </div>
              <p className="mt-2 text-[11px] font-medium text-action">{followupStep}º follow-up de 10</p>
              {canal === "email" && <Input value={followupSubject} onChange={(e) => setFollowupSubject(e.target.value)} placeholder="Assunto do e-mail" className="mb-2" />}
              <Textarea value={followupMessage} onChange={(e) => setFollowupMessage(e.target.value)} placeholder="A mensagem do follow-up aparece aqui automaticamente..." rows={5} />
              <div className="mt-2 flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={!followupMessage.trim()} onClick={() => copyTexto(followupMessage)}><Copy className="h-4 w-4" /> Copiar</Button><Button variant="action" size="sm" disabled={!followupMessage.trim() || registarFollowupMutation.isPending} onClick={abrirCanalFollowup}><Send className="h-4 w-4" /> Abrir e registar envio</Button><Button variant="outline" size="sm" disabled={!followupMessage.trim() || registarFollowupMutation.isPending} onClick={() => registarFollowupMutation.mutate()}><MessageSquarePlus className="h-4 w-4" /> Só registar</Button></div>
              {followupStep === 10 && <p className="mt-2 text-[11px] text-muted-foreground">Depois deste décimo contacto, deixa o cliente descansar e só retoma se ele responder.</p>}
            </div>
            <div className="rounded-md border bg-muted/20 p-3">
              <p className="mb-2 text-xs font-semibold text-foreground">Dados comerciais</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div><Label htmlFor="lead-email" className="text-xs">E-mail</Label><Input id="lead-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@empresa.pt" /></div>
                <div><Label htmlFor="lead-decisor" className="text-xs">Decisor</Label><Input id="lead-decisor" value={decisor} onChange={(e) => setDecisor(e.target.value)} placeholder="Nome do responsável" /></div>
                <div><Label htmlFor="lead-valor" className="text-xs">Valor estimado (€)</Label><Input id="lead-valor" type="number" min="0" value={valorEstimado} onChange={(e) => setValorEstimado(e.target.value)} placeholder="1500" /></div>
              </div>
              <Button variant="outline" size="sm" className="mt-3" disabled={dadosComerciaisMutation.isPending} onClick={() => dadosComerciaisMutation.mutate()}>Guardar dados comerciais</Button>
            </div>
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
