# GMN Scout

Construa uma aplicação SaaS completa para prospecção e gestão de serviços de Google Meu Negócio (GMN). A aplicação deve ser focada em eficiência para o utilizador (eu) prospectar clientes. Use o Supabase para o backend e base de dados.1. Estrutura e Interface (UI/UX)•Crie um Dashboard moderno e responsivo com uma barra lateral de navegação.•Cores: Profissional (Azul escuro, Branco e Cinza) com botões de ação em destaque.•Páginas Principais:•Dashboard: Resumo de leads, follow-ups do dia e métricas.•Prospecção Maps: Interface para pesquisar empresas por nicho e cidade.•CRM de Leads: Pipeline (Kanban) para gerir o progresso dos leads (Novo, Contato, Proposta, FechadoConfigurações: Onde inserirei as minhas chaves de API (Google Maps e OpenAI).2. Funcionalidades Técnicas•Integração Google Maps: Configure um serviço que use a Places API para buscar empresas. Extraia: Nome, Endereço, Telefone, Rating e total de Avaliações.•Score SEO Local: Crie uma função que calcule automaticamente uma nota de 0 a 100 para cada empresa com base nos dados do Maps (ex: menos de 4.5 estrelas ou poucas avaliações = oportunidade alta).•IA de Abordagem (OpenAI): Integre com a API da OpenAI para gerar um script de venda personalizado via WhatsApp/E-mail, usando os dados da empresa (ex: 'Olá [Nome], vi que vocês têm ótimas avaliações mas poucas fotos no Google...').•Gestão de Follow-up: Sistema para agendar lembretes de retorno para cada lead.Base de Dados (Supabase)•Crie as seguintes tabelas:•leads: id, nome_empresa, telefone, endereco, rating, total_avaliacoes, score_seo, status_funil, user_id.•interacoes: id, lead_id, data, notas, tipo (chamada, mensagem).4. Fluxo de Trabalho1.Eu pesquiso 'Dentista em Lisboa'.2.O sistema lista os resultados do Maps com o Score SEO.3.Eu clico em 'Adicionar ao CRM'.4.No CRM, eu clico em 'Gerar Abordagem IA' e o sistema me dá o texto pronto para enviar.5.Eu movo o lead pelo funil até fechar o contrato.Por favor, comece criando a estrutura visual básica e a tabela de leads no Supabase."

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/dcf72795-f07e-480e-ad9c-20f62849269b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
