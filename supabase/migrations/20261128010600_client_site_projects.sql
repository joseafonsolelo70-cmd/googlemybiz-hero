-- Site Builder: project briefs generated from prospecting leads.
CREATE TABLE IF NOT EXISTS public.site_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  slug text NOT NULL,
  status text NOT NULL DEFAULT 'briefing' CHECK (status IN ('briefing', 'gerado', 'entregue', 'publicado')),
  nome_empresa text NOT NULL,
  nicho text,
  cidade text,
  telefone text,
  email text,
  whatsapp text,
  servicos text,
  descricao text,
  chamada_acao text,
  cor_marca text NOT NULL DEFAULT '#7c3aed',
  logo_url text,
  briefing text NOT NULL,
  github_path text,
  preview_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_site_projects_user ON public.site_projects(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_projects_lead ON public.site_projects(lead_id);

ALTER TABLE public.site_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own site projects" ON public.site_projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own site projects" ON public.site_projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own site projects" ON public.site_projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own site projects" ON public.site_projects FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_site_projects_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS set_site_projects_updated_at ON public.site_projects;
CREATE TRIGGER set_site_projects_updated_at BEFORE UPDATE ON public.site_projects FOR EACH ROW EXECUTE FUNCTION public.set_site_projects_updated_at();
