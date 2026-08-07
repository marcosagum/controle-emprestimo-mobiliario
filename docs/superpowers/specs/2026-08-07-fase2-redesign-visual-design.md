# Fase 2 — Redesign visual (paleta e linguagem do Rio Centro)

Projeto: Arena Mobília - Controle de Empréstimos (`index.html`, single-file app).

Esta é a segunda de três fases planejadas para este ciclo de trabalho:
1. Fase 1 (concluída, mesclada em `main`): correção de bugs e UX de chave/controle de ar.
2. **Fase 2 (este documento):** redesign visual, aplicando a paleta e linguagem visual do projeto Rio Centro (`riocentro-mapa`).
3. Fase 3: melhorias gerais de funcionamento (a definir).

## Contexto

O Arena Mobília usa hoje um tema escuro (fundo `#03050c`, vermelho neon `#ff1a3c`, fontes Inter/Outfit), com efeitos de brilho ("glow") pensados para contraste sobre fundo escuro. O usuário pediu para aplicar a mesma identidade visual usada no projeto Rio Centro (`C:\Users\marcos.agum\.gemini\antigravity\scratch\riocentro-mapa`), um sistema de mapa de ocupação com tema claro.

Levantamento do Rio Centro (`app/globals.css`, `app/layout.tsx`, `components/ui.tsx`):
- Paleta: `--background: #f6f5f3`, `--foreground/--ink: #0a0a0a`, `--brand: #e11518`, `--brand-deep: #a10f12`, `--brand-light: #ed7374`, `--accent-teal: #0b6e97`, `--surface: #eeece9`, `--surface-card: #ffffff`, `--ink-soft: #717784`, `--ghost: #d7dae1`, `--hairline: #e6e8ec`, `--on-brand: #ffffff`.
- Raio de borda: `--radius-card: 1.5rem`, `--radius-card-lg: 2rem`, `--radius-pill: 62.5rem` (pílula).
- Fonte: Onest (Google Fonts, via `next/font/google`, pesos 400/500).
- Botões em formato pílula, com variantes `brand` (vermelho sólido), `light`, `solid` (ink), `outline` (borda hairline), `quiet` (surface); uppercase, `tracking-wide`, `font-medium`.
- Sem cor de sucesso/status positivo definida — só marca (vermelho) e destaque (teal).

Levantamento do Arena Mobília (`index.html`, bloco `<style>` e templates JS inline):
- Quase todo o CSS deriva de variáveis `:root` (`--bg-color`, `--bg-surface`, `--bg-surface-elevated`, `--primary`, `--primary-glow`, `--primary-hover`, `--text-primary`, `--text-secondary`, `--text-muted`, `--border-color`, `--border-focus`, `--success`, `--success-glow`, `--border-radius-lg/md/sm`, `--transition-smooth`, `--transition-bounce`), definidas uma vez em `:root` (linhas ~19-38).
- ~57 ocorrências de cores literais fora das variáveis, espalhadas nos templates de string HTML gerados em JS (badges de status, overlays "vidro" `rgba(255,255,255,0.0X)` sobre fundo escuro, sombras com `--primary-glow`, cores hex diretas como `#ff1a3c`/`#03050c`/`#0a0e1c`/`#12182d`).

## Decisões (confirmadas com o usuário)

- **Escopo:** linguagem visual completa do Rio Centro — cores, tipografia (Onest) e forma (pílula, cantos arredondados grandes) — não só a paleta de cores.
- **Cor de sucesso/status positivo:** mantém verde (recalibrado para fundo claro), não substitui por teal. Vermelho continua sendo a cor de marca/ação primária; teal vira destaque secundário/informativo, sem uso definido anteriormente no Arena Mobília.
- **Splash screen:** migra para o tema claro também (sem efeito de brilho neon, que só funciona sobre fundo escuro); mantém a animação de entrada.
- **Tema único:** sem toggle claro/escuro — uso do app é majoritariamente em ambiente iluminado (escritório/backstage iluminado), confirmado com o usuário.
- **Fora de escopo:** nenhuma mudança de estrutura, layout, navegação ou funcionalidade — isso é puramente visual, em cima do que a Fase 1 já corrigiu. Nenhuma nova cor de status é introduzida além do que já existe (vermelho=ação/chave, verde=sucesso/disponível, teal=novo destaque informativo).

## Design

### 1. Sistema de cores (`:root`)

Substituir os valores atuais das variáveis existentes (mantendo os mesmos nomes de variável, para não quebrar nenhuma referência `var(--x)` já espalhada pelo CSS):

| Variável | Valor atual (escuro) | Novo valor (claro) |
|---|---|---|
| `--bg-color` | `#03050c` | `#f6f5f3` |
| `--bg-surface` | `#0a0e1c` | `#ffffff` |
| `--bg-surface-elevated` | `#12182d` | `#eeece9` |
| `--primary` | `#ff1a3c` | `#e11518` |
| `--primary-glow` | `rgba(255, 26, 60, 0.4)` | `rgba(225, 21, 24, 0.15)` (sombra suave, não brilho neon) |
| `--primary-hover` | `#ff4d66` | `#a10f12` (mais escuro no hover, padrão de tema claro) |
| `--text-primary` | `#f3f4f6` | `#0a0a0a` |
| `--text-secondary` | `#9ca3af` | `#717784` |
| `--text-muted` | `#6b7280` | `#9599a3` (derivado, meio-tom entre `--text-secondary` e `--border-color`) |
| `--border-color` | `rgba(255, 255, 255, 0.08)` | `#e6e8ec` |
| `--border-focus` | `rgba(255, 26, 60, 0.5)` | `#e11518` |
| `--success` | `#10b981` | `#0d9467` (recalibrado para contraste em fundo claro) |
| `--success-glow` | `rgba(16, 185, 129, 0.2)` | `rgba(13, 148, 103, 0.12)` |

Nova variável adicionada: `--accent-teal: #0b6e97` (destaque secundário/informativo, sem equivalente hoje — usar em pontos que hoje usam `--text-secondary`/cinza para indicar informação neutra mas relevante, como badges informativos que não são nem ação nem sucesso).

`--border-radius-lg/md/sm` sobem para `2rem`/`1rem`/`0.5rem` (hoje `16px`/`12px`/`8px`) para bater com o `--radius-card-lg`/`--radius-card`/escala menor do Rio Centro. Nova variável `--border-radius-pill: 999px` para botões.

`--transition-smooth`/`--transition-bounce` mantidos como estão (não fazem parte da identidade de cor/forma do Rio Centro, são só timing de animação).

### 2. Tipografia

Trocar o `<link>` do Google Fonts (linha ~15) de `Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700;800` para `Onest:wght@400;500;600;700`. Atualizar todas as declarações `font-family: 'Inter', sans-serif` e `font-family: 'Outfit', sans-serif` (regras `*`, `h1-h4`) para `font-family: 'Onest', sans-serif`.

### 3. Forma dos componentes

- Botões primários/de ação (`.btn-submit`, `.btn-secondary`, `.btn-badge`, e variantes inline nos templates JS) passam a usar `border-radius: var(--border-radius-pill)`, texto em maiúsculas com `letter-spacing: 0.02em`, `font-weight: 500`.
- Cards (`.section-card`, `.room-card`, cards do mural de chaves) usam `--border-radius-lg` (agora `2rem`).
- Inputs, chips e elementos menores (`.input-text`, `.chip-btn`, badges) usam `--border-radius-md`/`--border-radius-sm` (agora `1rem`/`0.5rem`).

### 4. Splash screen

Remove `.splash-glow-aura` (blur/pulse neon) e `filter: drop-shadow(...)` no `.splash-logo-svg`. Fundo passa a `var(--bg-color)` (já claro após a mudança de variável). Logo SVG passa a usar `fill: var(--primary)` sólido, sem drop-shadow. Título (`.splash-title`) troca o gradiente `linear-gradient(135deg, #ffffff 30%, #ff4d66 100%)` com `-webkit-background-clip: text` por uma cor sólida `var(--text-primary)` ou `var(--primary)` — gradiente de texto branco-para-vermelho não faz sentido sobre fundo claro. Mantém as transições/animações de entrada (`opacity`/`transform`) como estão.

### 5. Componentes com cor "hardcoded" (fora das variáveis)

Cada uma das ~57 ocorrências será avaliada e ajustada individualmente durante a implementação, seguindo estas regras gerais:
- `rgba(255, 255, 255, 0.0X)` usado como overlay "vidro" sobre fundo escuro → `rgba(0, 0, 0, 0.0X)` equivalente sobre fundo claro (mesma opacidade, inverte de branco pra preto).
- Badges de status que hoje usam `rgba(255, 26, 60, 0.1)` (fundo) + `var(--primary)` (texto) + `rgba(255, 26, 60, 0.2)` (borda) para "chave" continuam com essa mesma lógica de 3 camadas (fundo tênue + texto sólido + borda um pouco mais forte), só recalculando os valores rgba a partir do novo `--primary` hex.
- Badges que hoje usam `rgba(16, 185, 129, ...)` (verde/sucesso hardcoded) idem, recalculados a partir do novo `--success`.
- Cores hex diretas (`#ff1a3c`, `#03050c`, `#0a0e1c`, `#12182d`) usadas fora de `var()` são substituídas pela variável correspondente sempre que uma existir; se não existir variável equivalente (caso raro), usa-se o valor claro correspondente da tabela acima diretamente.
- Nenhuma mudança na estrutura HTML, nos nomes de classe, ou na lógica JS que constrói esses templates — só os valores de cor dentro deles.

## Testes

Sem suíte automatizada (mesma limitação da Fase 1). Verificação manual no navegador, cobrindo:
- As 3 abas (Empréstimos, Vistorias, Chaves) e seus respectivos formulários/modais.
- Splash screen (abertura do app).
- Todos os estados de badge/status (chave, controle de ar, divergência de vistoria, sala disponível/ocupada, histórico) para garantir contraste e legibilidade sobre fundo claro.
- Tabelas de histórico (empréstimos e chaves) e cards do mural.
- Botões em todos os estados (normal, hover, disabled) para confirmar a forma de pílula e as cores de hover.

## Fora de escopo (fases futuras)

- Toggle claro/escuro.
- Qualquer mudança de estrutura, layout, navegação ou funcionalidade (fica para a Fase 3, a definir).
