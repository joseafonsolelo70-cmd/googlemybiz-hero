import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, KeyRound, MapPin, Sparkles, User, Building2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — GMN Prospect" }] }),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [googleKey, setGoogleKey] = useState("");
  const [nomeVendedor, setNomeVendedor] = useState("");
  const [empresaVendedor, setEmpresaVendedor] = useState("");
  
  const [saving, setSaving] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("google_api_key, nome_vendedor, empresa_vendedor")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (profile) {
      setGoogleKey(profile.google_api_key ?? "");
      setNomeVendedor(profile.nome_vendedor ?? "");
      setEmpresaVendedor(profile.empresa_vendedor ?? "");
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        google_api_key: googleKey.trim() || null,
        nome_vendedor: nomeVendedor.trim() || null,
        empresa_vendedor: empresaVendedor.trim() || null,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível guardar as chaves.");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Configurações guardadas com sucesso.");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Insira as suas chaves de API. Ficam guardadas em segurança na sua conta.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4 text-action" />
                Google Maps API
              </CardTitle>
              <CardDescription>
                Usada para pesquisar empresas. Ative a <strong>Places API (New)</strong> no
                Google Cloud e cole a chave abaixo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label htmlFor="google">Chave Google Maps</Label>
              <Input
                id="google"
                type="password"
                placeholder="AIza..."
                value={googleKey}
                onChange={(e) => setGoogleKey(e.target.value)}
                autoComplete="off"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-action" />
                Google Gemini (IA)
              </CardTitle>
              <CardDescription>
                As abordagens de venda são geradas com o modelo <strong>Gemini</strong>. A chave
                de API (<code>GEMINI_API_KEY</code>) é gerida de forma segura no servidor, não
                sendo necessário configurá-la aqui.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Está tudo pronto — basta usar o botão <strong>Gerar Abordagem IA</strong> no CRM.
              </p>
            </CardContent>
          </Card>


          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4 text-action" />
                Dados do Vendedor
              </CardTitle>
              <CardDescription>
                Estes dados aparecem nas abordagens geradas pela IA.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nomeVendedor">Nome do vendedor</Label>
                <Input
                  id="nomeVendedor"
                  placeholder="José"
                  value={nomeVendedor}
                  onChange={(e) => setNomeVendedor(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="empresaVendedor">Nome da empresa</Label>
                <Input
                  id="empresaVendedor"
                  placeholder="JAL Digital"
                  value={empresaVendedor}
                  onChange={(e) => setEmpresaVendedor(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Button type="submit" variant="action" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Guardar configurações
          </Button>
        </form>
      )}
    </div>
  );
}
