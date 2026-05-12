# Workflow Git — branch + PR pra trabalhar em paralelo

> Pra evitar o caos de quando 2+ pessoas mexem no mesmo working tree (vide incidentes de 05-08/05/2026: gasClient.js esquecido, MentorContext desatualizado, stashes perdidos).
>
> Regra principal: **nunca commitar direto na `main`**, exceto hotfix de prod quebrada.

## TL;DR — fluxo padrão

```bash
# 1. Antes de começar, garante que main está atualizada
git checkout main
git pull origin main

# 2. Cria branch própria (com seu prefixo)
git checkout -b filippe/nome-curto-da-feature

# 3. Edita arquivos, comita normal
git add <arquivos>
git commit -m "feat: o que fez"

# 4. Push da branch (não da main)
git push origin filippe/nome-curto-da-feature

# 5. Abre PR no GitHub
gh pr create --title "Título curto" --body "Descrição do que faz"
# (ou clica "Compare & pull request" no botão verde que aparece no GitHub.com)

# 6. Vercel cria URL de preview automática (aparece no PR)
#    Testa lá antes de mergear

# 7. Outro dono revisa o diff. Aprovado → Merge. Vercel deploya prod.

# 8. Volta pra main e limpa
git checkout main
git pull origin main
git branch -d filippe/nome-curto-da-feature
```

## Convenção de nome de branch

Sempre prefixo do dono + assunto curto em kebab-case:

```
filippe/joice-pendencias
filippe/fix-diagnostico-erro-silencioso
rafa/webhook-no-show
rafa/permissoes-vendedor
hotfix/login-quebrado     ← sem dono pra emergências
```

**Por quê:** quando aparece no `git branch -a`, vê na hora de quem é cada trabalho em andamento.

## Quando fazer PR review vs auto-merge

### Feature normal (default)
1. Abre PR
2. Outra pessoa revisa o diff (5min)
3. Aprovado → Merge

### Hotfix urgente (prod quebrada)
Você ainda usa branch + PR, mas pode auto-mergear sem esperar review:
```bash
git checkout -b hotfix/login-quebrado
# edita
git commit -am "hotfix: ..."
git push origin hotfix/login-quebrado
gh pr create --title "hotfix: ..." --body "Prod quebrada, mergeando direto"
gh pr merge --auto --squash    # mergeia assim que CI passa
```

A vantagem mesmo em hotfix: fica registro do que mudou + Vercel preview onde você testou + dá pra reverter o PR inteiro com 1 clique se piorar.

### Mudança em código compartilhado (`lib/`, `gas/Code.gs` constantes, `app/layout.js`)
Sempre PR review, sem auto-merge. Avisa o outro dono no chat.

## Como abrir PR pelo GitHub web (sem `gh` CLI)

1. Após `git push origin sua-branch`, o GitHub mostra um banner "Compare & pull request" no topo do repositório
2. Clica
3. Preenche título + descrição
4. "Create pull request"
5. Outro dono recebe notificação por email

## Vercel preview por branch

Toda branch pushada gera uma URL automática tipo:
```
https://intento-platform-git-rafa-pegar-lead-IntentoEd.vercel.app
```

Aparece no PR como comentário do bot da Vercel. Testa **lá** antes de mergear pra `main`. Se quebrar no preview, conserta na branch (mais commits) — preview atualiza automático.

## O que fazer quando dá conflito

Se sua branch divergiu da `main` (alguém mergeou outra coisa enquanto você trabalhava):

```bash
# Atualiza main local
git checkout main
git pull origin main

# Volta pra sua branch e traz as mudanças da main
git checkout filippe/sua-branch
git merge main

# Se git apontar conflito em algum arquivo:
#   - Abre o arquivo, procura por <<<<<<<, ======, >>>>>>>
#   - Decide qual versão fica (sua, do main, ou mistura)
#   - Remove os marcadores
#   - git add <arquivo conflitado>
#   - git commit (sem -m, ele preenche mensagem padrão de merge)

# Push de novo
git push origin filippe/sua-branch
```

## Regras pra reverter PR

Se mergeou e descobriu que quebrou prod:

```bash
# Opção 1 — Revert pelo GitHub
# No PR mergeado, botão "Revert" cria PR oposto. Mergeia esse, prod volta.

# Opção 2 — git local
git checkout main
git pull
git revert <SHA-do-merge>
git push origin main
```

`git revert` cria um commit novo que **desfaz** o anterior. Não reescreve história. Vercel deploya o revert.

## Donos por pasta (CODEOWNERS implícito)

Documentado em [CLAUDE.md](../CLAUDE.md). Resumo:

- **Rafa**: CRM/comercial — `app/vendas/`, `app/vendedor/`, `app/api/leads/`, `app/api/agenda/`, `components/PainelLiderPipeline.js`, `components/Modal{Lead,NovoLead}.js`, handlers de Lead/Pipeline/Agenda em `gas/Code.gs`
- **Filippe**: Mentoria/escolar — `app/mentor/`, `app/painel/`, `app/onboarding/`, `app/diagnostico/`, `app/lider/`, `app/api/{mentor,submit,auth}/`, `components/Aba*`, `Boletim*`, `Modal{Lead,Registro}.js`, `Provas*`, `Push*`, handlers de Aluno/Mentor/Diagnóstico/Avaliação/Caderno em `gas/Code.gs`
- **Ambos** (avisar antes de mexer): `lib/`, `scripts/`, `app/layout.js`, `package.json`, `gas/Code.gs` constantes (ABA, COL_*, FASES_LEAD, etc.), `gas/SmokeTest.gs`

## Checklist antes de mergear PR

- [ ] Branch tá atualizada com `main` (sem conflitos)
- [ ] Pre-push hook rodou (build local passou) — automático no `git push`
- [ ] Vercel preview testado pelo menos no caminho principal
- [ ] Se mexe em `gas/Code.gs`: roda `smokeTest()` mentalmente — listou impacto na descrição do PR
- [ ] Se mexe em código de outro dono: avisou no chat

## Erros comuns

| Erro | Causa | Fix |
|---|---|---|
| `git push` recusado em `main` (depois que ativarmos branch protection) | Você commitou direto na main por engano | `git checkout -b filippe/oops`, `git push origin filippe/oops`, abre PR |
| Vercel deploya da branch errada em prod | Improvável — só `main` deploya prod, branches são preview | — |
| Pre-push hook bloqueia (build falhou) | `.gas` ou `npm` quebrou | Lê o erro, conserta, tenta de novo |
| Pop de stash dá conflito | Trabalho do outro dono e seu mexem no mesmo arquivo | Resolve conflito manualmente, commita |

## Comandos uteis no dia-a-dia

```bash
# Ver branches (suas e remotas)
git branch -a

# Ver PRs abertos no repo
gh pr list

# Ver PR específico
gh pr view 42

# Ver diff de um PR antes de aprovar
gh pr diff 42

# Aprovar PR pela CLI (em vez do botão)
gh pr review 42 --approve

# Mergear PR pela CLI
gh pr merge 42 --squash

# Apagar branch já mergeada (limpeza)
git branch -d filippe/feature-mergeada
```

## Fora do nosso escopo

Fluxos que NÃO vamos adotar (complicação demais pra time de 2):
- **Git flow** (`develop`, `release`, etc.) — use só `main` + branches de feature
- **Rebase interactive** — squash no merge do GitHub resolve
- **Múltiplos reviewers** — 1 review do outro dono basta
- **Staging/QA branches separadas** — Vercel preview já cobre

Quando virar time de 5+, revisita.
