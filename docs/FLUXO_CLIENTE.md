# Fluxo do Cliente — porta de entrada

> Mapa do que acontece desde "lead chega" até "aluno em mentoria ativa". Documento vivo — revisar a cada release maior ou quando aparecer bug que afete onboarding/diagnóstico.
>
> Última revisão: 2026-05-06.

## Por que esse documento existe

A porta de entrada (Typebot → lead → onboarding → diagnóstico → painel) é onde o cliente decide se confia na plataforma. Bug aqui = aluno premium pagando ticket alto que não consegue nem começar. **Cada estado precisa ter um único gatilho de transição e um único responsável por escrevê-lo.** Quando isso quebra, dá no que deu na Joice/Otavio (duplicata, status fake, etc.).

---

## Estados do funil

### Estados de **Lead** (BD_Leads, fase em `COL_LEAD.FASE`)

Vocabulário fechado em `gas/Code.gs:52` (`FASES_LEAD`):

```
Lead → Numero invalido → Contactado WPP → Ativo WPP →
Reuniao agendada → Reuniao realizada → Convertido →
Taxa matricula paga → Contrato assinado → 1a mensalidade paga →
Em mentoria → Churn
```

Outcome de reunião (campo separado, `COL_LEAD.OUTCOME_REUNIAO`): `'' | realizada | no-show | reagendada | cancelada`. Padrão HubSpot/Pipedrive — fase é o trilho, outcome é o resultado da última reunião.

### Estados de **Aluno** (BD_Alunos, em `COL_MESTRE.STATUS_ONBOARDING`)

Não tem enum formal — strings livres usadas hoje:

| Valor | Quem escreve | Quando |
|---|---|---|
| (vazio) | — | linha sem onboarding submetido (não deveria existir; sempre é criada com algum status abaixo) |
| `Aguardando Diagnóstico` | `handleOnboarding` (pelo `/api/submit`) ou `handleConverterLeadEmAluno` (CRM converte lead) | logo que entra |
| `Onboarding Completo` | `handleDiagnostico` (única função) | aluno termina o diagnóstico |
| `Duplicada — ver linha N` | `repararDuplicataPorEmail()` (manual) | quando líder roda o reparo |

Outras flags relevantes na BD_Alunos:
- `COL_MESTRE.MENTOR_RESPONSAVEL` — preenchida pelo `handleDesignarMentor` (líder atribui)
- `COL_MESTRE.PLANO` — preenchida na conversão de lead OU pelo líder ao designar mentor
- `COL_MESTRE.TIPO_ALUNO` — `ENEM` (default) ou `EM`
- `COL_MESTRE.ID_PLANILHA` — ID da planilha individual no Drive

---

## Caminhos de entrada — 2 trilhos

### Trilho A — Lead comercial (CRM)

```
Typebot/Make
   │  webhook + LEADS_WEBHOOK_SECRET
   ▼
POST /api/leads/webhook  →  GAS handleCriarLead  →  BD_Leads (fase=Lead)
   │
   │  vendedor pega no /vendas (Kanban) ou auto-atribui
   ▼
moverLeadFase: Lead → Contactado WPP → Ativo WPP
   │
   │  agente WPP / vendedor agenda reunião (UI ou n8n via /api/agenda/agendar)
   ▼
fase=Reuniao agendada + Google Calendar event criado
   │
   ▼
fase=Reuniao realizada + outcome=realizada
   │
   │  vendedor cobra matrícula, gera contrato (manual ou Asaas — backlog)
   ▼
fase=Convertido → Taxa matricula paga → Contrato assinado → 1a mensalidade paga
   │
   │  no /vendas, vendedor clica "Converter em aluno"
   ▼
handleConverterLeadEmAluno
   ├─ cria nova planilha individual no Drive
   ├─ insere linha em BD_Alunos com STATUS_ONBOARDING="Aguardando Diagnóstico"
   ├─ marca lead com ID_ALUNO_GERADO + fase="Em mentoria"
   └─ notifica líder (push) "🎯 Aluno aguardando designação"
```

⚠️ **Atenção**: este caminho não passa por onboarding (formulário) nem por diagnóstico. Aluno entra direto com `Aguardando Diagnóstico`. Cabe ao líder designar mentor + cabe ao aluno fazer diagnóstico depois.

### Trilho B — Cadastro direto pelo aluno (sem CRM)

```
Aluno acessa landing (/) → faz login Firebase (Google OU email/senha)
   │
   ▼
processarAcessoNoSistema (app/page.js)  →  POST /api/mentor { acao:'loginGlobal' }  →  GAS handleLoginGlobal
   │
   │  porteiro decide rota (ver §Porteiro abaixo)
   ▼
/hub  (checklist visual, se nunca preencheu nada)
   │
   │  aluno clica "Questionário de Onboarding"
   ▼
/onboarding  (PASSOS 1-4 + 30 perguntas técnicas)
   │
   │  submit
   ▼
POST /api/submit  →  GAS handleOnboarding
   ├─ valida: email já existe? → bloqueia (Política A, desde 2026-05-06)
   ├─ cria nova planilha individual no Drive
   ├─ grava resposta completa em BD_Onboarding (planilha individual)
   ├─ insere linha em BD_Alunos com STATUS_ONBOARDING="Aguardando Diagnóstico"
   ├─ envia email de boas-vindas pro aluno (com link pro diagnóstico)
   └─ envia email pro líder (notificação de novo aluno)
   │
   ▼
Aluno volta pra /hub (ou clica no email)
   │
   │  faz logout/login OU navega pra /diagnostico
   ▼
Porteiro novo: STATUS="Aguardando Diagnóstico" → /diagnostico
   │
   ▼
/diagnostico  (180 questões: 45 Bio + 45 Quim + 45 Fis + 45 Mat)
   │
   │  só permite enviar com 4 disciplinas concluídas (desde 2026-05-06)
   ▼
POST /api/mentor { acao:'diagnostico' }  →  GAS handleDiagnostico
   ├─ acha email no BD_Alunos → pega ID_PLANILHA correspondente
   ├─ cria/usa aba BD_Diagnostico na planilha individual
   ├─ appendRow com [data, acertosBio, acertosQuim, acertosFis, acertosMat]
   ├─ atualiza STATUS_ONBOARDING="Onboarding Completo" no BD_Alunos
   └─ notifica líder (push) "🎯 Aluno aguardando designação"
```

### Convergência — depois do diagnóstico (ou conversão CRM)

```
STATUS_ONBOARDING="Aguardando Diagnóstico" + MENTOR_RESPONSAVEL vazio
   │
   │  líder vê em /lider, designa mentor manualmente
   ▼
GAS handleDesignarMentor
   ├─ preenche MENTOR_RESPONSAVEL
   ├─ envia email pro mentor (alerta de novo aluno)
   └─ envia email pro aluno (com plano + nome do mentor)
   │
   │  mentor aparece em /mentor com novo aluno na lista
   ▼
Mentor + aluno agendam encontro (fora da plataforma — WhatsApp/Calendar)
   │
   ▼
Mentor abre /mentor/[idAluno], aba "Diário de Bordo"
   ├─ registra encontro (vitórias, desafios, meta, planos de ação 1-5)
   └─ semanalmente: aba "Acompanhamento Semanal" (registro de horas, indicadores 1-6)
   │
   ▼
Aluno recebe push Segunda 8h (cron) → entra em /painel
Mentor recebe push Segunda 9h (cron) → entra em /mentor pra fazer registros
```

---

## Porteiro — `handleLoginGlobal` (gas/Code.gs:1429)

Toda vez que um usuário loga, esta função decide pra onde mandar:

```
emailLogado
   │
   ├─ é filippe@ ou rafael@ ?  →  /selecionar-modo  (líder)
   │
   ├─ está em BD_Vendedores ativo + BD_Mentores?  →  /selecionar-modo  (híbrido)
   │
   ├─ está em BD_Vendedores ativo?  →  /vendas  (vendedor)
   │
   ├─ termina em @metodointento.com.br ?  →  /mentor  (mentor)
   │
   └─ é aluno (qualquer outro email)
        │
        ├─ não tem linha em BD_Alunos  →  /hub  (novo)
        │
        ├─ tem linha + STATUS_ONBOARDING:
        │     "Onboarding Completo"      →  /painel
        │     "Aguardando Diagnóstico"   →  /diagnostico  (desde 2026-05-06)
        │     qualquer outro             →  /hub
        │
        └─ duplicata? pega a "melhor" linha (Completo > Aguardando > resto)
```

---

## Pontos de controle pra revisar periodicamente

Roda essa lista (smoke manual ~10min) **toda Segunda de manhã** ou após qualquer deploy que mexa em onboarding/diagnóstico/login:

### A. Login + porteiro
1. Logout completo. Acessa `/` em janela anônima.
2. Login com email de teste novo (ex: `teste-YYYYMMDD@gmail.com`). Esperado: vai pra `/hub`.
3. Login com aluno em `Aguardando Diagnóstico` (Joice se ainda no estado). Esperado: vai pra `/diagnostico`.
4. Login com aluno em `Onboarding Completo`. Esperado: vai pra `/painel`.
5. Login com mentor (`@metodointento.com.br` mas não líder). Esperado: vai pra `/mentor`.
6. Login com filippe. Esperado: vai pra `/selecionar-modo`.

### B. Onboarding novo (não-CRM)
1. Em janela anônima, login com email **inédito**.
2. Cai em `/hub`, clica "Questionário de Onboarding".
3. Preenche os 4 passos.
4. Esperado: tela de sucesso. Verificar:
   - ✅ Linha nova em BD_Alunos com `STATUS_ONBOARDING=Aguardando Diagnóstico`.
   - ✅ Planilha individual criada no Drive (pasta de triagem).
   - ✅ Aba `BD_Onboarding` da planilha individual com a linha preenchida.
   - ✅ Email de boas-vindas chegou pro aluno.

### C. Onboarding duplicado (deve falhar)
1. Imediatamente após (B), abre nova aba, tenta submeter onboarding de novo com **mesmo email**.
2. Esperado: erro `"Já existe um cadastro com este e-mail. Faça login pra continuar de onde parou."`
3. ❌ Se criar 2ª linha em BD_Alunos: **bug crítico, abrir issue na hora**.

### D. Diagnóstico
1. Login com aluno do passo (B) (status Aguardando Diagnóstico).
2. Esperado: porteiro joga em `/diagnostico` direto.
3. Tenta clicar "Ver meus Resultados" sem completar as 4 disciplinas. Esperado: botão não aparece (só aparece quando 4/4 concluídas).
4. Completa as 4 disciplinas (180 questões — pra teste, marca tudo "A" rapidamente).
5. Submete. Verificar:
   - ✅ Aba `BD_Diagnostico` da planilha individual criada com 5 colunas (data + 4 acertos).
   - ✅ Linha em BD_Alunos virou `STATUS_ONBOARDING=Onboarding Completo`.
   - ✅ Push imediato chegou pra filippe ("🎯 Aluno aguardando designação").

### E. Designação de mentor (líder)
1. Login filippe → `/lider` → painel "Aguardando Designação" lista o aluno do (D).
2. Designa um mentor + escolhe plano.
3. Verificar:
   - ✅ `MENTOR_RESPONSAVEL` preenchido em BD_Alunos.
   - ✅ Email chegou pro mentor com nome + planilha do aluno.
   - ✅ Email chegou pro aluno com nome do mentor.

### F. Painel do aluno + Mentor
1. Login com aluno (D). Esperado: `/painel` carrega sem erro, sidebar mostra abas (Visão Geral, Acompanhamento Semanal, Mentoria, Semana Padrão, Simulados, Caderno de Erros).
2. Login com mentor designado. Esperado: `/mentor` lista o aluno novo.
3. Mentor abre `/mentor/[idAluno]`. Verificar abas: Diário de Bordo, Semana Padrão, Histórico Analítico, Simulados, Onboarding (visualização do questionário).

### G. Push notifications semanais
**Toda Terça de manhã**: confirmar com 1 aluno e 1 mentor se receberam push de Segunda. Se ninguém recebeu:
- Verificar Apps Script → Project Settings → Script Properties: `AGENT_API_TOKEN` está setado?
- Verificar Apps Script → Triggers: `cronLembreteAluno` (8h Seg) e `cronLembreteMentor` (9h Seg) ativos?
- Verificar Apps Script → Executions: log dessas funções da Segunda — rodaram? Devolveram quantos `_enviarPush`?

### H. Aviso de erros novos
**Toda manhã**: filippe deve receber email diário se houve erro em prod. Se nunca chega:
- Verificar Apps Script → Triggers: `cronAvisoErrosNovos` (diário) ativo?
- Conferir aba Logs_Erro — está crescendo? Erros novos não notificados.

---

## Histórico de bugs já encontrados nesse fluxo (cautionary tale)

Pra evitar repetir e pra dar contexto de por que algumas defesas existem:

| Data | Bug | Sintoma observado | Causa raiz | Fix |
|---|---|---|---|---|
| 2026-05-06 | Onboarding duplicado pra Joice e Otavio | Aluno aparecia em 2 linhas no BD_Alunos. Porteiro mandava pra `/hub` (linha mais recente em `Aguardando`), apesar de outra linha estar `Completo`. Diagnóstico aparecia incompleto | `handleOnboarding` aceitava 2ª submissão silenciosamente; porteiro pegava a última ocorrência sem priorizar a mais avançada | Fix em `e48cd12`: porteiro busca a "melhor" linha por prioridade; `handleOnboarding` rejeita duplicata (Política A); função one-shot `repararDuplicataPorEmail()` |
| 2026-05-06 | Diagnóstico parcial gravando 0/0 indistinguível | Joice apareceu com 2/4/0/0 em BD_Diagnostico. Não dava pra saber se ela performou mal ou enviou parcial | Botão "Enviar resultados parciais mesmo assim" no /diagnostico permitia submit incompleto, registrava 0 nas disciplinas não-feitas | Fix em `5f575d3`: botão removido. Aluno só consegue submeter com 4/4 disciplinas concluídas |
| 2026-05-06 | Porteiro mandava aluno em `Aguardando Diagnóstico` pra `/hub` em vez de `/diagnostico` | Hub mostrava "fazer onboarding" mesmo pra quem já tinha feito | `handleLoginGlobal` só conhecia 2 destinos: `Onboarding Completo → /painel` ou `qualquer outro → /hub` | Fix em `e48cd12`: 3 destinos (Completo → /painel, Aguardando → /diagnostico, resto → /hub) |
| 2026-05-05 | `/mentor/[id]` quebrava com "Sem identidade" | Mentor não conseguia abrir planilha de aluno individual | Race do Firebase auth: `apiFetch` chamado antes do `auth.currentUser` carregar | Fix em `82257c2`: `apiFetch` aguarda `auth.authStateReady()` |
| 2026-05-05 | `/mentor` (lista) ficava vazio pra todos os mentores | Lista de alunos sumia | `MentorContext` usava `fetch` direto (sem Bearer), gateway começou a exigir | Fix em `1796d0a`: troca por `apiFetch` |

---

## Cadência de revisão

| Frequência | Quem | O quê |
|---|---|---|
| **Toda Segunda manhã** | Filippe | Smoke A+B+G da seção §Pontos de Controle (~10min) |
| **Toda Terça manhã** | Filippe | Confirmar push de Segunda chegou pra ao menos 1 aluno + 1 mentor |
| **Toda manhã** | Filippe | Verificar email de `cronAvisoErrosNovos` — se chegou, abrir Logs_Erro e triagem |
| **Após qualquer deploy que mexa em onboarding/diagnóstico/login** | Quem deployou | Smoke completo A→F (~30min) |
| **A cada 3 meses** | Filippe + dev | Releitura completa deste documento. Atualizar §Histórico de bugs com novos casos. Verificar se o fluxo descrito ainda bate com o código (mudanças de produto podem ter saído fora deste documento) |

Quando este documento estiver desalinhado com o código, **o documento é a especificação** — código que diverge é considerado bug. Atualizar este doc primeiro, depois código.
