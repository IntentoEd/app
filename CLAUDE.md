@AGENTS.md

# Multi-sessão — sempre validar antes de commitar

Este repo costuma ter múltiplas sessões Claude Code rodando em paralelo (Filippe + Rafa, ou janelas separadas). Cada sessão tem seu estado mental do repo, mas o filesystem é único — incidentes acontecem quando uma sessão commita+pusha sem saber o que outra deixou pendente.

**Antes de qualquer `git add` / `git commit` / `git push`:**

1. Rode `git status` e `git log origin/main..HEAD` e `git log -5`.
2. Se houver arquivos modificados que VOCÊ não tocou nesta sessão, ou commits recentes que VOCÊ não fez, **liste pro usuário antes de prosseguir.** Pode ser trabalho de outra conversa que não pode entrar no seu commit.
3. Use `git stash push -m "outra conversa: <descrição>" -- <arquivos>` pra isolar o que não é seu antes de `git add`.
4. Após push, sempre `git stash pop` pra devolver o trabalho que era de outra sessão.

**Se descobrir mid-task que outra conversa modificou o estado** (ex: `gas/Code.gs` aparece como modificado por outra mão, ou commit novo apareceu no `git log`), pare e mostre o estado pro usuário decidir. Não tente reconciliar sozinho.

**Sincronização GAS ↔ Next:** mudanças que mexem nos dois lados (ex: novo handler no GAS + caller no Next) devem ser deployadas em janela curta. Se só uma ponta sobe, o outro lado pode quebrar silenciosamente em produção.

# Commit cirúrgico — incluir dependências

Se a sessão tem N arquivos modificados e você vai commitar SÓ alguns, **antes do `git add` faça um sweep**:

1. Pra cada arquivo que vai entrar no commit, verifique:
   - `import` ou `require` aponta pra arquivo **untracked** ou **modificado** que NÃO está sendo commitado? Se sim, ou inclui também ou aborta.
   - O comportamento esperado depende de outro arquivo modificado (ex: backend novo exige header novo do client)? Se sim, listar e perguntar antes.

2. Sempre que possível, antes do push: `git stash push --keep-index --include-untracked && npm run build && git stash pop`. Isso simula EXATO o que vai pra prod (só HEAD + arquivos staged). O hook `scripts/git-hooks/pre-push` faz isso automaticamente — se não estiver ativo, rodar manualmente. Pra ativar: `./scripts/setup-hooks.sh`.

**Por quê:** hoje tivemos 2 incidentes em prod (`/mentor/[id]` e `/mentor` lista) porque commits cirúrgicos importavam módulos cujos arquivos ficaram untracked, ou ativavam auth no backend sem que o cliente correspondente fosse atualizado. Build local passava porque o working tree tinha tudo; em prod faltava.

# Branch + PR — nunca commitar direto na `main`

Default a partir de 11/05/2026: trabalho NOVO sai numa branch própria + PR. `main` só recebe via merge de PR.

**Comandos do fluxo padrão** estão em [docs/WORKFLOW_GIT.md](docs/WORKFLOW_GIT.md). TL;DR:

```bash
git checkout -b filippe/nome-curto    # ou rafa/... ou hotfix/...
# edita, commita
git push origin filippe/nome-curto
gh pr create --title "..." --body "..."
# Vercel cria preview automático. Outro dono revisa e mergeia.
```

**Quando você (assistente) for editar+commitar+pushar:**

1. Antes de criar branch, pergunte ao usuário o nome (ou sugira `filippe/<assunto>`).
2. Se o usuário disser "sobe direto na main" pra um caso específico, OK — mas avise que está fugindo do default e diga por quê (geralmente: hotfix de prod quebrada, mudança trivial em doc).
3. Pra hotfix urgente: branch + PR + `gh pr merge --auto --squash` resolve tudo em 3 comandos extras vs commit direto, e mantém audit trail.

**Por quê:** vimos que sessões paralelas (Filippe + Rafa, ou várias janelas Claude) commitando direto na `main` causaram caos repetido (gasClient.js esquecido, MentorContext desatualizado, stashes perdidos). Branch isola o trabalho de cada um e o PR força revisão antes de prod.

# Donos por pasta — quem mexe no quê

Convenção (não enforced tecnicamente — é regra de coordenação):

**Rafa (CRM/comercial):**
- `app/vendas/`, `app/vendedor/`
- `app/api/leads/`, `app/api/agenda/`
- `components/PainelLiderPipeline.js`, `components/Modal{Lead,NovoLead}.js`
- handlers de Lead/Pipeline/Agenda/Vendedor em `gas/Code.gs`

**Filippe (mentoria/escolar):**
- `app/mentor/`, `app/painel/`, `app/onboarding/`, `app/diagnostico/`, `app/lider/`
- `app/api/mentor/`, `app/api/submit/`, `app/api/auth/`
- `components/AbaProvas.js`, `components/Boletim*.js`, `components/ModalRegistro.js`, `components/Provas*.js`, `components/Push*.js`
- handlers de Aluno/Mentor/Diagnóstico/Avaliação/Caderno/Onboarding em `gas/Code.gs`

**Compartilhado (avisar o outro dono antes de mexer):**
- `lib/`, `scripts/`, `app/layout.js`, `package.json`
- `gas/Code.gs` constantes (ABA, COL_*, FASES_LEAD, TIPOS_*, OUTCOMES_*)
- `gas/SmokeTest.gs`
- `app/api/push/` (cron+UX afeta os dois)
- `CLAUDE.md`, `AGENTS.md`, `docs/`

**Como você (assistente) usa isso:**

- Quando o usuário pede pra mexer em arquivo de outro dono (ex: Filippe pede mudança em `app/vendas/page.js`), pergunta se Rafa foi avisado antes de pushar.
- Quando aparece commit ou stash de "outra conversa" mexendo na sua área, sinalize claramente — pode ser engano.
- Pra mudança em pasta compartilhada (`lib/`, `gas/Code.gs` constantes), sempre PR com review.
