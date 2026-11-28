-- Premium prospecting layer: commercial prioritisation, cadence and outcome tracking.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS score_comercial integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_prioridade integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS temperatura text NOT NULL DEFAULT 'frio',
  ADD COLUMN IF NOT EXISTS proxima_acao text,
  ADD COLUMN IF NOT EXISTS ultima_interacao_at timestamptz,
  ADD COLUMN IF NOT EXISTS tentativas_contacto integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS decisor text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS whatsapp_confirmado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS melhor_horario text,
  ADD COLUMN IF NOT EXISTS servico_interesse text,
  ADD COLUMN IF NOT EXISTS observacoes text,
  ADD COLUMN IF NOT EXISTS valor_estimado numeric(12,2),
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'google_maps',
  ADD COLUMN IF NOT EXISTS website_status text NOT NULL DEFAULT 'nao_verificado',
  ADD COLUMN IF NOT EXISTS motivo_perda text,
  ADD COLUMN IF NOT EXISTS reuniao_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_leads_priority ON public.leads(user_id, score_prioridade DESC);
CREATE INDEX IF NOT EXISTS idx_leads_followup ON public.leads(user_id, proximo_followup);
CREATE INDEX IF NOT EXISTS idx_leads_temperature ON public.leads(user_id, temperatura);

COMMENT ON COLUMN public.leads.score_comercial IS 'Potencial de compra estimado, separado da qualidade SEO local.';
COMMENT ON COLUMN public.leads.score_prioridade IS 'Prioridade operacional combinando oportunidade, potencial e urgência.';
COMMENT ON COLUMN public.leads.proxima_acao IS 'Próxima ação recomendada pelo assistente comercial.';
COMMENT ON COLUMN public.leads.website_status IS 'Estado verificável do website: nao_verificado, ausente, existente, analisado.';
