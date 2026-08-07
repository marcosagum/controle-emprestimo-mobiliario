# Fase 2 — Redesign Visual (Paleta Rio Centro) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Arena Mobília's visual identity (colors, typography, shape) from its current dark neon theme to a light theme matching the Rio Centro project's design language, per `docs/superpowers/specs/2026-08-07-fase2-redesign-visual-design.md`.

**Architecture:** Single-file vanilla-JS app (`index.html`), no build step. Nearly all styling flows through CSS custom properties defined once in `:root`, so most of the visual change cascades from one variable block edit (Task 1). The remainder is ~60+ hardcoded color/shape literals scattered across `<style>` rules and JS-generated template strings, grouped below by screen/component area so each task stays reviewable as one visual unit.

**Tech Stack:** Vanilla CSS custom properties, Google Fonts (Onest), no build tooling, no test framework — verification is manual, in a browser.

## Global Constraints

- No automated test framework exists. Every task's verification step is a manual browser check — open `index.html` and visually confirm.
- Do not introduce a build step, bundler, or external CSS/JS framework. All edits stay inside `index.html`.
- Keep Portuguese (pt-BR) strings for all user-facing text — this phase touches colors/fonts/shapes only, never copy.
- No structural HTML changes, no JS logic changes, no class renames — only the color/font/radius/shadow *values* inside existing rules and `style="..."` attributes.
- No dark/light toggle — single light theme only, per the approved design.
- Semantic color mapping must stay consistent everywhere: red (`--primary`, new `#e11518`) = brand/action/chave; green (`--success`, new `#0d9467`) = positive/disponível/devolvido; teal (new `--accent-teal: #0b6e97`) = informational/secondary highlight, introduced fresh (no prior usage to preserve).
- File edited throughout: `C:\Users\marcos.agum\.gemini\antigravity\scratch\controle-emprestimo-mobiliario\index.html`. Line numbers below are from the pre-Fase-2 file state; if earlier tasks shift line numbers, use the quoted code snippets (not the numbers) to relocate each edit.

### Color conversion table (reference for every task below)

| Old value | New value | Meaning |
|---|---|---|
| `#03050c` (old `--bg-color`) | `#f6f5f3` | page background |
| `#0a0e1c` (old `--bg-surface`) | `#ffffff` | card/surface background |
| `#12182d` (old `--bg-surface-elevated`) | `#eeece9` | elevated/input background |
| `#ff1a3c` (old `--primary`) | `#e11518` | brand red |
| `#ff4d66` (old `--primary-hover`) | `#a10f12` | brand red, darker (hover) |
| `rgba(255, 26, 60, X)` | `rgba(225, 21, 24, X)` | primary tint at any alpha `X` |
| `rgba(16, 185, 129, X)` or `rgba(0, 230, 118, X)` | `rgba(13, 148, 103, X)` | success tint at any alpha `X` (both old greens normalize to the one new green) |
| `#10b981` (old `--success`) | `#0d9467` | success green |
| `rgba(255, 255, 255, X)` (glass-on-dark overlay) | `rgba(0, 0, 0, X)` | glass-on-light overlay, same alpha `X` |
| `rgba(3, 5, 12, X)` | `var(--bg-color)` or `var(--bg-surface-elevated)` (see each site) | replaces old near-black literal tints |
| `#f3f4f6` (old `--text-primary`) | `#0a0a0a` | primary text |
| `#9ca3af` (old `--text-secondary`) | `#717784` | secondary text |
| `#6b7280` (old `--text-muted`) | `#9599a3` | muted text |

---

### Task 1: Foundation — fonts and `:root` color/shape variables

**Files:**
- Modify: `index.html` (Google Fonts `<link>`, `~line 15`; `:root` block, `~line 19-38`; universal/heading font-family, `~line 45, 58`)

**Interfaces:**
- Produces: two new CSS custom properties, `--accent-teal: #0b6e97` and `--border-radius-pill: 999px`, available to every later task. All existing variable *names* are unchanged — only their values and (for the three radius variables) their numbers change — so every `var(--x)` reference elsewhere in the file keeps working without edits.

- [ ] **Step 1: Swap the Google Font**

Find:
```html
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700;800&display=swap" rel="stylesheet">
```

Replace with:
```html
    <link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Rewrite the `:root` variable block**

Find:
```css
        :root {
            --bg-color: #03050c;
            --bg-surface: #0a0e1c;
            --bg-surface-elevated: #12182d;
            --primary: #ff1a3c;
            --primary-glow: rgba(255, 26, 60, 0.4);
            --primary-hover: #ff4d66;
            --text-primary: #f3f4f6;
            --text-secondary: #9ca3af;
            --text-muted: #6b7280;
            --border-color: rgba(255, 255, 255, 0.08);
            --border-focus: rgba(255, 26, 60, 0.5);
            --success: #10b981;
            --success-glow: rgba(16, 185, 129, 0.2);
            --border-radius-lg: 16px;
            --border-radius-md: 12px;
            --border-radius-sm: 8px;
            --transition-smooth: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            --transition-bounce: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
```

Replace with:
```css
        :root {
            --bg-color: #f6f5f3;
            --bg-surface: #ffffff;
            --bg-surface-elevated: #eeece9;
            --primary: #e11518;
            --primary-glow: rgba(225, 21, 24, 0.15);
            --primary-hover: #a10f12;
            --text-primary: #0a0a0a;
            --text-secondary: #717784;
            --text-muted: #9599a3;
            --border-color: #e6e8ec;
            --border-focus: #e11518;
            --success: #0d9467;
            --success-glow: rgba(13, 148, 103, 0.12);
            --accent-teal: #0b6e97;
            --border-radius-lg: 32px;
            --border-radius-md: 16px;
            --border-radius-sm: 8px;
            --border-radius-pill: 999px;
            --transition-smooth: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            --transition-bounce: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
```

- [ ] **Step 3: Update the universal font-family rule**

Find (inside the `*` reset rule, `~line 45`):
```css
            font-family: 'Inter', sans-serif;
```
(this specific occurrence is the one inside the `* { ... }` block near the top of `<style>` — the one at `~line 41-47`, not the later `.qty-value-input`/`.btn-submit` ones, which Tasks 4/3 handle)

Replace with:
```css
            font-family: 'Onest', sans-serif;
```

- [ ] **Step 4: Update the heading font-family rule**

Find:
```css
        h1, h2, h3, h4 {
            font-family: 'Outfit', sans-serif;
            font-weight: 700;
        }
```

Replace with:
```css
        h1, h2, h3, h4 {
            font-family: 'Onest', sans-serif;
            font-weight: 700;
        }
```

- [ ] **Step 5: Manual verification**

Open `index.html` in a browser. Confirm: page background is now a warm off-white (not black), body text renders in Onest (check via DevTools → Elements → Computed → font-family on any `<body>` text), and nothing crashes (the app still loads past the splash screen, even though the splash itself still looks broken/dark at this point — that's expected, Task 2 fixes it).

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: swap Arena Mobília theme foundation to Rio Centro palette, fonts, and radii"
```

---

### Task 2: Splash screen

**Files:**
- Modify: `index.html` (`#splash-screen`, `.splash-glow-aura`, `.splash-title`, `.splash-logo-svg`, `~line 78-151`)

**Interfaces:**
- Consumes: `--bg-color`, `--primary`, `--primary-glow`, `--text-primary` from Task 1.

- [ ] **Step 1: Remove the neon glow aura and its background literal**

Find:
```css
        #splash-screen {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background-color: #03050c;
            z-index: 999999;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            transition: opacity 0.6s ease-out;
        }

        .splash-glow-aura {
            position: absolute;
            width: 250px;
            height: 250px;
            background-color: #ff1a3c;
            border-radius: 50%;
            filter: blur(95px);
            opacity: 0.6;
            animation: pulse-glow 3s infinite ease-in-out;
            pointer-events: none;
            z-index: 1;
        }

        @keyframes pulse-glow {
            0%, 100% { transform: scale(1); opacity: 0.5; }
            50% { transform: scale(1.2); opacity: 0.7; }
        }
```

Replace with:
```css
        #splash-screen {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background-color: var(--bg-color);
            z-index: 999999;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            transition: opacity 0.6s ease-out;
        }

        .splash-glow-aura {
            display: none;
        }
```

(`.splash-glow-aura` is kept as a rule targeting `display: none` rather than deleted outright, since its `<div>` still exists in the HTML body and this phase makes no structural HTML changes — hiding it via CSS is the correct minimal fix.)

- [ ] **Step 2: Replace the gradient text-clip title with a solid color**

Find:
```css
        .splash-title {
            font-size: 2.2rem;
            font-weight: 800;
            letter-spacing: 2px;
            background: linear-gradient(135deg, #ffffff 30%, #ff4d66 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 30px;
            opacity: 1;
            transform: translateY(0);
            transition: opacity 0.5s ease, transform 0.5s ease;
        }
```

Replace with:
```css
        .splash-title {
            font-size: 2.2rem;
            font-weight: 800;
            letter-spacing: 2px;
            color: var(--text-primary);
            margin-bottom: 30px;
            opacity: 1;
            transform: translateY(0);
            transition: opacity 0.5s ease, transform 0.5s ease;
        }
```

- [ ] **Step 3: Remove the neon drop-shadow on the splash logo**

Find:
```css
        .splash-logo-svg {
            width: 100%;
            height: 100%;
            fill: var(--primary);
            filter: drop-shadow(0 0 15px var(--primary-glow));
        }
```

Replace with:
```css
        .splash-logo-svg {
            width: 100%;
            height: 100%;
            fill: var(--primary);
        }
```

- [ ] **Step 4: Manual verification**

Reload `index.html`. Confirm the splash screen shows a light background, a solid dark title (no gradient/glow), and a solid red logo with no blurred aura behind it, then transitions into the (still dark-themed at this point) app body.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "style: migrate splash screen to light theme, remove neon glow effects"
```

---

### Task 3: Global chrome — header, modal shell, toast, and primary buttons

**Files:**
- Modify: `index.html` (`header`, `.header-title`, `~line 194-237`; `.btn-badge`, `~line 245-264`; `.btn-submit`, `~line 577-600`; `.btn-secondary`, `~line 880-900`; `.toast`, `.text-gradient`, `~line 838-871`; `.modal-overlay`, `.modal-content`, `~line 934-982`)

**Interfaces:**
- Consumes: `--primary`, `--primary-hover`, `--bg-color`, `--bg-surface`, `--bg-surface-elevated`, `--text-primary`, `--border-color`, `--border-radius-lg`, `--border-radius-pill` from Task 1.

- [ ] **Step 1: Header background and logo/title gradients**

Find:
```css
        /* Header Navigation */
        header {
            position: sticky;
            top: 0;
            z-index: 100;
            background-color: rgba(3, 5, 12, 0.85);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border-bottom: 1px solid var(--border-color);
            padding: 16px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
```

Replace with:
```css
        /* Header Navigation */
        header {
            position: sticky;
            top: 0;
            z-index: 100;
            background-color: rgba(246, 245, 243, 0.85);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border-bottom: 1px solid var(--border-color);
            padding: 16px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
```

Find:
```css
        .header-logo-visible {
            width: 100%;
            height: 100%;
            fill: var(--primary);
            filter: drop-shadow(0 0 8px var(--primary-glow));
        }

        .header-title {
            font-size: 1.3rem;
            font-weight: 800;
            letter-spacing: 0.5px;
            background: linear-gradient(135deg, #ffffff 40%, #ff4d66 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
```

Replace with:
```css
        .header-logo-visible {
            width: 100%;
            height: 100%;
            fill: var(--primary);
        }

        .header-title {
            font-size: 1.3rem;
            font-weight: 800;
            letter-spacing: 0.5px;
            color: var(--text-primary);
        }
```

- [ ] **Step 2: `.text-gradient` utility class (also used elsewhere via `class="text-gradient"`)**

Find:
```css
        .text-gradient {
            background: linear-gradient(135deg, #ffffff 40%, #ff4d66 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
```

Replace with:
```css
        .text-gradient {
            color: var(--text-primary);
        }
```

- [ ] **Step 3: `.btn-badge` (header action badge) — no hardcoded colors here, only verify radius cascades correctly; no code change needed.** Skip — this rule already uses `var(--border-radius-sm)`, `var(--bg-surface-elevated)`, `var(--border-color)`, `var(--text-primary)`, `var(--primary)` exclusively; Task 1's variable swap already recolors it correctly.

- [ ] **Step 4: `.btn-submit` — replace hardcoded gradient/shadow, apply pill radius, fix leftover Outfit font**

Find:
```css
        /* Submit Button */
        .btn-submit {
            background: linear-gradient(135deg, #ff1a3c, #c00c28);
            border: none;
            color: white;
            padding: 16px;
            border-radius: var(--border-radius-lg);
            font-size: 1.1rem;
            font-family: 'Outfit', sans-serif;
            font-weight: 700;
            letter-spacing: 0.5px;
            cursor: pointer;
            width: 100%;
            box-shadow: 0 6px 20px rgba(255, 26, 60, 0.3);
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 8px;
            transition: var(--transition-bounce);
        }

        .btn-submit:active {
            transform: scale(0.97);
            box-shadow: 0 2px 10px rgba(255, 26, 60, 0.2);
        }
```

Replace with:
```css
        /* Submit Button */
        .btn-submit {
            background: var(--primary);
            border: none;
            color: white;
            padding: 16px;
            border-radius: var(--border-radius-pill);
            font-size: 1.1rem;
            font-family: 'Onest', sans-serif;
            font-weight: 600;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            cursor: pointer;
            width: 100%;
            box-shadow: 0 4px 14px rgba(225, 21, 24, 0.18);
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 8px;
            transition: var(--transition-bounce);
        }

        .btn-submit:active {
            transform: scale(0.97);
            background: var(--primary-hover);
            box-shadow: 0 2px 8px rgba(225, 21, 24, 0.15);
        }
```

- [ ] **Step 5: `.btn-secondary` — pill radius, active-state color**

Find:
```css
        .btn-secondary {
            background-color: var(--bg-surface-elevated);
            border: 1px solid var(--border-color);
            color: var(--text-primary);
            padding: 14px;
            border-radius: var(--border-radius-lg);
            font-size: 0.95rem;
            font-weight: 600;
            cursor: pointer;
            flex: 1;
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 8px;
            transition: var(--transition-smooth);
        }

        .btn-secondary:active {
            background-color: var(--border-focus);
            transform: scale(0.98);
        }
```

Replace with:
```css
        .btn-secondary {
            background-color: var(--bg-surface-elevated);
            border: 1px solid var(--border-color);
            color: var(--text-primary);
            padding: 14px;
            border-radius: var(--border-radius-pill);
            font-size: 0.95rem;
            font-weight: 600;
            cursor: pointer;
            flex: 1;
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 8px;
            transition: var(--transition-smooth);
        }

        .btn-secondary:active {
            background-color: var(--primary);
            color: white;
            transform: scale(0.98);
        }
```

(The old `:active` rule set `background-color: var(--border-focus)`, which was a semi-transparent red overlay meant to read against a dark surface. On light theme that reads as a washed-out pink; switching to a solid `var(--primary)` fill with white text gives a clear pressed-state on light backgrounds, matching the Rio Centro `PillButton` `light`/`outline` variants' hover behavior of inverting to a solid fill.)

- [ ] **Step 6: `.toast` — replace hardcoded dark surface and shadow**

Find:
```css
        /* Floating Toast Notification */
        .toast {
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%) translateY(100px);
            background-color: #12182d;
            border: 1px solid var(--primary);
            color: var(--text-primary);
            padding: 12px 24px;
            border-radius: 30px;
            font-size: 0.85rem;
            font-weight: 600;
            z-index: 1000;
            box-shadow: 0 10px 25px rgba(255, 26, 60, 0.2);
            transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.4s;
            opacity: 0;
            display: flex;
            align-items: center;
            gap: 8px;
            pointer-events: none;
            white-space: nowrap;
        }
```

Replace with:
```css
        /* Floating Toast Notification */
        .toast {
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%) translateY(100px);
            background-color: var(--bg-surface);
            border: 1px solid var(--primary);
            color: var(--text-primary);
            padding: 12px 24px;
            border-radius: var(--border-radius-pill);
            font-size: 0.85rem;
            font-weight: 600;
            z-index: 1000;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
            transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.4s;
            opacity: 0;
            display: flex;
            align-items: center;
            gap: 8px;
            pointer-events: none;
            white-space: nowrap;
        }
```

- [ ] **Step 7: `.modal-overlay` and `.modal-content` — light-theme scrim and softened shadow**

Find:
```css
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(3, 5, 12, 0.8);
            backdrop-filter: blur(8px);
            z-index: 999999;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s cubic-bezier(0.76, 0, 0.24, 1);
        }

        .modal-overlay.show {
            opacity: 1;
            pointer-events: auto;
        }

        .modal-content {
            background-color: var(--bg-surface);
            border-top-left-radius: 20px;
            border-top-right-radius: 20px;
            border: 1px solid var(--border-color);
            border-bottom: none;
            width: 100%;
            max-width: 480px;
            padding: 24px;
            box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.5);
            transform: translateY(100%);
            transition: transform 0.3s cubic-bezier(0.76, 0, 0.24, 1);
        }

        .modal-overlay.show .modal-content {
            transform: translateY(0);
        }

        @media (min-width: 768px) {
            .modal-overlay {
                align-items: center;
            }
            .modal-content {
                border-radius: 20px;
                border-bottom: 1px solid var(--border-color);
            }
        }
```

Replace with:
```css
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(10, 10, 10, 0.5);
            backdrop-filter: blur(8px);
            z-index: 999999;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s cubic-bezier(0.76, 0, 0.24, 1);
        }

        .modal-overlay.show {
            opacity: 1;
            pointer-events: auto;
        }

        .modal-content {
            background-color: var(--bg-surface);
            border-top-left-radius: var(--border-radius-lg);
            border-top-right-radius: var(--border-radius-lg);
            border: 1px solid var(--border-color);
            border-bottom: none;
            width: 100%;
            max-width: 480px;
            padding: 24px;
            box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.12);
            transform: translateY(100%);
            transition: transform 0.3s cubic-bezier(0.76, 0, 0.24, 1);
        }

        .modal-overlay.show .modal-content {
            transform: translateY(0);
        }

        @media (min-width: 768px) {
            .modal-overlay {
                align-items: center;
            }
            .modal-content {
                border-radius: var(--border-radius-lg);
                border-bottom: 1px solid var(--border-color);
            }
        }
```

- [ ] **Step 8: Manual verification**

Reload the app. Confirm: sticky header has a light frosted-glass effect (not a dark bar), the app title reads in solid dark text, the primary "Registrar Empréstimo" button is a solid red pill, "Cancelar"/secondary buttons are pill-shaped too, opening any modal (e.g. click a room card, or "Registrar Empréstimo") shows a light sheet sliding up with rounded top corners over a dark semi-transparent backdrop, and triggering any toast (e.g. submit a form) shows a white pill-shaped toast with a red border.

- [ ] **Step 9: Commit**

```bash
git add index.html
git commit -m "style: apply light theme and pill shape to header, modals, toast, and primary buttons"
```

---

### Task 4: Form controls and selection states

**Files:**
- Modify: `index.html` (`.item-option-card.selected`, `~line 351-362`; `.qty-value-input`, `~line 428-440`; `.input-text:focus`, `~line 493-496`; `.signature-area`/`.signature-canvas`/`.signature-img-container`, `~line 536-551, 772-787`; `.btn-text`, `~line 558-574`)

**Interfaces:**
- Consumes: `--primary`, `--primary-glow`, `--bg-surface-elevated`, `--border-color` from Task 1.

- [ ] **Step 1: `.item-option-card.selected` — recalculate primary-tint literals**

Find:
```css
        /* Selected State */
        .item-option-card.selected {
            border-color: var(--primary);
            background-color: rgba(255, 26, 60, 0.05);
            box-shadow: 0 0 15px rgba(255, 26, 60, 0.15);
            transform: scale(1.02);
        }
```

Replace with:
```css
        /* Selected State */
        .item-option-card.selected {
            border-color: var(--primary);
            background-color: rgba(225, 21, 24, 0.05);
            box-shadow: 0 2px 8px rgba(225, 21, 24, 0.12);
            transform: scale(1.02);
        }
```

- [ ] **Step 2: `.qty-value-input` — dashed underline literal and leftover Outfit font**

Find:
```css
        .qty-value-input {
            background: none;
            border: none;
            color: var(--text-primary);
            font-size: 1.5rem;
            font-weight: 700;
            font-family: 'Outfit', sans-serif;
            width: 60px;
            text-align: center;
            outline: none;
            border-bottom: 2px dashed rgba(255, 255, 255, 0.2);
            transition: var(--transition-smooth);
        }
```

Replace with:
```css
        .qty-value-input {
            background: none;
            border: none;
            color: var(--text-primary);
            font-size: 1.5rem;
            font-weight: 700;
            font-family: 'Onest', sans-serif;
            width: 60px;
            text-align: center;
            outline: none;
            border-bottom: 2px dashed var(--border-color);
            transition: var(--transition-smooth);
        }
```

- [ ] **Step 3: `.input-text:focus` — recalculate primary-tint literal**

Find:
```css
        .input-text:focus {
            border-color: var(--primary);
            box-shadow: 0 0 10px rgba(255, 26, 60, 0.15);
        }
```

Replace with:
```css
        .input-text:focus {
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(225, 21, 24, 0.1);
        }
```

- [ ] **Step 4: `.signature-area` / `.signature-canvas` / `.signature-img-container` — replace dark literals, fix ink-inversion bug**

Find:
```css
        .signature-canvas {
            display: block;
            width: 100%;
            height: 150px;
            touch-action: none;
            background-color: rgba(3, 5, 12, 0.3);
        }
```

Replace with:
```css
        .signature-canvas {
            display: block;
            width: 100%;
            height: 150px;
            touch-action: none;
            background-color: var(--bg-surface-elevated);
        }
```

Find:
```css
        .signature-img-container {
            background-color: rgba(3, 5, 12, 0.4);
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius-sm);
            height: 50px;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 4px;
        }

        .signature-img-container img {
            max-height: 100%;
            max-width: 100%;
            object-fit: contain;
            filter: invert(1); /* Invert base64 black ink signature to display cleanly as white ink on dark bg */
        }
```

Replace with:
```css
        .signature-img-container {
            background-color: var(--bg-surface-elevated);
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius-sm);
            height: 50px;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 4px;
        }

        .signature-img-container img {
            max-height: 100%;
            max-width: 100%;
            object-fit: contain;
        }
```

(The captured signature ink is drawn in black on the canvas. The old dark theme inverted it to white so it would be visible against a near-black container; on the new light `--bg-surface-elevated` background, black ink is already visible on its own, so the `filter: invert(1)` must be removed — leaving it in would make signatures invisible/white-on-light.)

- [ ] **Step 5: `.btn-text:active` — no hardcoded color here, uses `var(--primary)` already.** Skip — no change needed, cascades correctly from Task 1.

- [ ] **Step 6: Manual verification**

Reload the app, go to "Registrar Empréstimo". Select a furniture item card and confirm the selected state shows a light red tint (not a dark box with a red glow). Focus a text input and confirm a soft red focus ring appears. Draw a test signature in the signature pad; confirm the ink draws in a visible dark color against the light signature-area background. Submit a loan with a signature, then find it in the history list and confirm the saved signature thumbnail shows dark ink on a light background (not blank/white-on-white).

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "style: recalibrate form control selection states and fix signature ink visibility for light theme"
```

---

### Task 5: Loan cards and status badges (Empréstimos tab)

**Files:**
- Modify: `index.html` (`.status-badge.active-badge`/`.returned-badge`, `~line 725-735`; `.loan-card-details`/`.loan-card-actions` borders, `~line 743, 792`; `.btn-action-return`, `~line 799-818`; `.card-action-icon-btn`, `~line 902-927`; `.nav-tab-btn:active/.active`, `~line 1013-1017`)

**Interfaces:**
- Consumes: `--primary`, `--success`, `--border-color` from Task 1.

- [ ] **Step 1: `.status-badge` variants — recalculate primary/success tint literals**

Find:
```css
        .status-badge.active-badge {
            background-color: rgba(255, 26, 60, 0.1);
            color: var(--primary);
            border: 1px solid rgba(255, 26, 60, 0.2);
        }

        .status-badge.returned-badge {
            background-color: rgba(16, 185, 129, 0.1);
            color: var(--success);
            border: 1px solid rgba(16, 185, 129, 0.2);
        }
```

Replace with:
```css
        .status-badge.active-badge {
            background-color: rgba(225, 21, 24, 0.08);
            color: var(--primary);
            border: 1px solid rgba(225, 21, 24, 0.2);
        }

        .status-badge.returned-badge {
            background-color: rgba(13, 148, 103, 0.08);
            color: var(--success);
            border: 1px solid rgba(13, 148, 103, 0.2);
        }
```

- [ ] **Step 2: `.loan-card-details` / `.loan-card-actions` — replace glass-on-dark hairline**

Find (two separate rules share this exact declaration — both need the same edit):
```css
            border-top: 1px solid rgba(255,255,255,0.04);
```
This exact line appears twice: once inside `.loan-card-details` (`~line 743`) and once inside `.loan-card-actions` (`~line 792`). Replace **both** occurrences with:
```css
            border-top: 1px solid var(--border-color);
```

- [ ] **Step 3: `.btn-action-return` — recalculate success tint literal**

Find:
```css
        .btn-action-return {
            background-color: rgba(16, 185, 129, 0.1);
            border: 1px solid var(--success);
            color: var(--success);
            padding: 8px 14px;
            border-radius: var(--border-radius-sm);
            font-size: 0.75rem;
            font-weight: 700;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 4px;
            transition: var(--transition-smooth);
        }
```

Replace with:
```css
        .btn-action-return {
            background-color: rgba(13, 148, 103, 0.1);
            border: 1px solid var(--success);
            color: var(--success);
            padding: 8px 14px;
            border-radius: var(--border-radius-sm);
            font-size: 0.75rem;
            font-weight: 700;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 4px;
            transition: var(--transition-smooth);
        }
```

- [ ] **Step 4: `.card-action-icon-btn` — glass-on-dark background and delete-hover tint**

Find:
```css
        /* Card Action Icon Buttons */
        .card-action-icon-btn {
            background-color: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-color);
            color: var(--text-secondary);
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: var(--transition-smooth);
        }

        .card-action-icon-btn:active {
            background-color: var(--bg-surface-elevated);
            color: var(--text-primary);
            transform: scale(1.1);
        }

        .card-action-icon-btn.delete-btn:active {
            background-color: rgba(255, 26, 60, 0.1);
            border-color: var(--primary);
            color: var(--primary);
        }
```

Replace with:
```css
        /* Card Action Icon Buttons */
        .card-action-icon-btn {
            background-color: rgba(0, 0, 0, 0.03);
            border: 1px solid var(--border-color);
            color: var(--text-secondary);
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: var(--transition-smooth);
        }

        .card-action-icon-btn:active {
            background-color: var(--bg-surface-elevated);
            color: var(--text-primary);
            transform: scale(1.1);
        }

        .card-action-icon-btn.delete-btn:active {
            background-color: rgba(225, 21, 24, 0.1);
            border-color: var(--primary);
            color: var(--primary);
        }
```

- [ ] **Step 5: `.nav-tab-btn:active, .nav-tab-btn.active` — recalculate primary tint literal**

Find:
```css
        .nav-tab-btn:active, .nav-tab-btn.active {
            color: var(--primary);
            border-bottom-color: var(--primary);
            background-color: rgba(255, 26, 60, 0.03);
        }
```

Replace with:
```css
        .nav-tab-btn:active, .nav-tab-btn.active {
            color: var(--primary);
            border-bottom-color: var(--primary);
            background-color: rgba(225, 21, 24, 0.05);
        }
```

- [ ] **Step 6: Manual verification**

Reload the app, go to the "Empréstimos" tab. Register a loan, confirm the new history card shows a red "Ativo" badge with a light red tint background. Mark it as returned, confirm the badge switches to a green "Devolvido" badge with a light green tint. Confirm the card's icon-action buttons (edit/delete) render as light circular buttons, not dark ones. Switch between the three top navigation tabs and confirm the active tab shows a red underline with a faint red-tinted background.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "style: recalibrate loan card badges and nav tab active state for light theme"
```

---

### Task 6: Room/inspection cards and checklist (Vistorias tab)

**Files:**
- Modify: `index.html` (`.room-card`, `~line 1033-1052`; `.room-status-badge` variants, `~line 1077-1086`; `.room-details`, `~line 1087-1097`; `.checklist-item-row`, `~line 1121-1129`; `.checklist-state-btn` default/selected, `~line 1154-1179`; `.btn-photo-capture`, `~line 1188-1205`; `.photo-delete-btn`, `~line 1223-1239`; `.comparison-meta`/`.comparison-table`/`.comparison-table tr.divergence`, `~line 1247-1300`)

**Interfaces:**
- Consumes: `--primary`, `--success`, `--border-color`, `--bg-surface-elevated` from Task 1.

- [ ] **Step 1: `.room-card` — hardcoded radius and shadow**

Find:
```css
        .room-card {
            background-color: var(--bg-surface);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            transition: var(--transition-smooth);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            position: relative;
            overflow: hidden;
            border-left: 4px solid var(--text-secondary);
        }
```

Replace with:
```css
        .room-card {
            background-color: var(--bg-surface);
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius-lg);
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            transition: var(--transition-smooth);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
            position: relative;
            overflow: hidden;
            border-left: 4px solid var(--text-secondary);
        }
```

- [ ] **Step 2: `.room-status-badge` variants — normalize both greens to the one new success green, recalculate primary tint**

Find:
```css
        .room-status-badge.badge-available {
            background-color: rgba(0, 230, 118, 0.1);
            color: var(--success);
            border: 1px solid rgba(0, 230, 118, 0.2);
        }
        .room-status-badge.badge-occupied {
            background-color: rgba(255, 26, 60, 0.1);
            color: var(--primary);
            border: 1px solid rgba(255, 26, 60, 0.2);
        }
```

Replace with:
```css
        .room-status-badge.badge-available {
            background-color: rgba(13, 148, 103, 0.08);
            color: var(--success);
            border: 1px solid rgba(13, 148, 103, 0.2);
        }
        .room-status-badge.badge-occupied {
            background-color: rgba(225, 21, 24, 0.08);
            color: var(--primary);
            border: 1px solid rgba(225, 21, 24, 0.2);
        }
```

- [ ] **Step 3: `.room-details` — glass-on-dark panel**

Find:
```css
        .room-details {
            display: flex;
            flex-direction: column;
            gap: 6px;
            font-size: 0.85rem;
            color: var(--text-secondary);
            background-color: rgba(255, 255, 255, 0.02);
            padding: 10px;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.03);
        }
```

Replace with:
```css
        .room-details {
            display: flex;
            flex-direction: column;
            gap: 6px;
            font-size: 0.85rem;
            color: var(--text-secondary);
            background-color: rgba(0, 0, 0, 0.02);
            padding: 10px;
            border-radius: var(--border-radius-sm);
            border: 1px solid var(--border-color);
        }
```

- [ ] **Step 4: `.checklist-item-row` — hardcoded radius (cascades color correctly from vars already)**

Find:
```css
        .checklist-item-row {
            display: flex;
            flex-direction: column;
            gap: 8px;
            background-color: var(--bg-surface-elevated);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 12px;
        }
```

Replace with:
```css
        .checklist-item-row {
            display: flex;
            flex-direction: column;
            gap: 8px;
            background-color: var(--bg-surface-elevated);
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius-md);
            padding: 12px;
        }
```

- [ ] **Step 5: `.checklist-state-btn` default state and "Inteiro"/"Ausente" selected states — glass-on-dark default, green/red tint recalculation. "Danificado" (orange `#FFB300`) is a distinct warning color, not derived from `--primary`/`--success`, and needs no change.**

Find:
```css
        .checklist-state-btn {
            padding: 4px 8px;
            font-size: 0.75rem;
            font-weight: 600;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            color: var(--text-secondary);
            cursor: pointer;
            transition: var(--transition-smooth);
        }
        .checklist-state-btn.selected[data-state="Inteiro"] {
            background-color: rgba(0, 230, 118, 0.15);
            color: var(--success);
            border-color: var(--success);
        }
        .checklist-state-btn.selected[data-state="Danificado"] {
            background-color: rgba(255, 179, 0, 0.15);
            color: #FFB300;
            border-color: #FFB300;
        }
        .checklist-state-btn.selected[data-state="Ausente"] {
            background-color: rgba(255, 26, 60, 0.15);
            color: var(--primary);
            border-color: var(--primary);
        }
```

Replace with:
```css
        .checklist-state-btn {
            padding: 4px 8px;
            font-size: 0.75rem;
            font-weight: 600;
            background: rgba(0, 0, 0, 0.03);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            color: var(--text-secondary);
            cursor: pointer;
            transition: var(--transition-smooth);
        }
        .checklist-state-btn.selected[data-state="Inteiro"] {
            background-color: rgba(13, 148, 103, 0.12);
            color: var(--success);
            border-color: var(--success);
        }
        .checklist-state-btn.selected[data-state="Danificado"] {
            background-color: rgba(255, 179, 0, 0.15);
            color: #FFB300;
            border-color: #FFB300;
        }
        .checklist-state-btn.selected[data-state="Ausente"] {
            background-color: rgba(225, 21, 24, 0.12);
            color: var(--primary);
            border-color: var(--primary);
        }
```

- [ ] **Step 6: `.btn-photo-capture` — glass-on-dark backgrounds**

Find:
```css
        .btn-photo-capture {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            background-color: rgba(255, 255, 255, 0.05);
            border: 1px dashed var(--border-color);
            color: var(--text-primary);
            padding: 14px;
            border-radius: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: var(--transition-smooth);
        }
        .btn-photo-capture:active {
            background-color: rgba(255, 255, 255, 0.1);
            border-color: var(--primary);
        }
```

Replace with:
```css
        .btn-photo-capture {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            background-color: rgba(0, 0, 0, 0.02);
            border: 1px dashed var(--border-color);
            color: var(--text-primary);
            padding: 14px;
            border-radius: var(--border-radius-md);
            font-weight: 600;
            cursor: pointer;
            transition: var(--transition-smooth);
        }
        .btn-photo-capture:active {
            background-color: rgba(0, 0, 0, 0.05);
            border-color: var(--primary);
        }
```

- [ ] **Step 7: `.photo-delete-btn` — recalculate primary tint literal**

Find:
```css
        .photo-delete-btn {
            position: absolute;
            top: 2px;
            right: 2px;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background-color: rgba(255, 26, 60, 0.8);
            color: #FFF;
            border: none;
            font-size: 10px;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
        }
```

Replace with:
```css
        .photo-delete-btn {
            position: absolute;
            top: 2px;
            right: 2px;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background-color: rgba(225, 21, 24, 0.85);
            color: #FFF;
            border: none;
            font-size: 10px;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
        }
```

- [ ] **Step 8: `.comparison-table tr.divergence` — recalculate primary tint literal**

Find:
```css
        .comparison-table tr.divergence {
            background-color: rgba(255, 26, 60, 0.05);
        }
```

Replace with:
```css
        .comparison-table tr.divergence {
            background-color: rgba(225, 21, 24, 0.06);
        }
```

- [ ] **Step 9: Manual verification**

Reload the app, go to "Vistorias". Confirm room cards show a soft shadow (not a heavy dark one) and rounded corners matching the new card radius. Confirm the "Disponível" badge is green-tinted and "Ocupado" is red-tinted, both readable on the light card background. Start a check-in, confirm the checklist item rows and the default/unselected state buttons look correct (light backgrounds, not dark translucent boxes), then mark an item "Inteiro", "Danificado", and "Ausente" in turn and confirm each shows its distinct color (green/orange/red) clearly. Attach a photo and confirm the delete "X" button is a visible red circle. Complete a check-out with at least one intentional quantity mismatch, open the comparison report, and confirm the divergent row is highlighted with a faint red tint.

- [ ] **Step 10: Commit**

```bash
git add index.html
git commit -m "style: recalibrate room/inspection cards, checklist states, and comparison report for light theme"
```

---

### Task 7: JS-rendered inline templates (Empréstimos export, Chaves tab, empty states)

**Files:**
- Modify: `index.html` (inline `style="..."` attributes and template-literal strings at `~line 1670, 1748, 1781, 1969, 2002, 2004, 2468, 2538, 3699, 3750, 3812, 3814, 3824`)

**Interfaces:**
- Consumes: `--primary`, `--success`, `--border-color`, `--text-primary`, `--text-secondary` (referenced via `var(--x)`, unaffected) from Task 1. This task only touches the literal (non-`var()`) color values embedded directly in HTML/JS template strings.

- [ ] **Step 1: Finalize-event button (static HTML)**

Find:
```html
                    <button class="btn-secondary" id="btn-finalize-event" style="flex: 1; min-width: 150px; justify-content: center; background-color: rgba(255, 26, 60, 0.08); border-color: var(--primary); color: var(--primary);">
```

Replace with:
```html
                    <button class="btn-secondary" id="btn-finalize-event" style="flex: 1; min-width: 150px; justify-content: center; background-color: rgba(225, 21, 24, 0.06); border-color: var(--primary); color: var(--primary);">
```

- [ ] **Step 2: Export table header row (static HTML)**

Find:
```html
                                <tr style="background-color: rgba(255,255,255,0.02); border-bottom: 1px solid var(--border-color);">
```

Replace with:
```html
                                <tr style="background-color: rgba(0,0,0,0.02); border-bottom: 1px solid var(--border-color);">
```

- [ ] **Step 3: Export/print buttons (two occurrences, same literal, static HTML)**

Find (appears once for the text-export button, `~line 1781`):
```html
                <button type="button" class="btn-submit" id="btn-export-text" style="background-color: rgba(255,255,255,0.05); border: 1px solid var(--border-color); color: var(--text-primary); justify-content: center;">
```

Replace with:
```html
                <button type="button" class="btn-submit" id="btn-export-text" style="background-color: rgba(0,0,0,0.03); border: 1px solid var(--border-color); color: var(--text-primary); justify-content: center;">
```

Find (the print-comparison button, `~line 1969`, same literal pattern):
```html
                      <button type="button" class="btn-submit" id="btn-print-comparison" style="flex: 1; background-color: rgba(255, 255, 255, 0.05); border: 1px solid var(--border-color); color: var(--text-primary); justify-content: center;">
```

Replace with:
```html
                      <button type="button" class="btn-submit" id="btn-print-comparison" style="flex: 1; background-color: rgba(0, 0, 0, 0.03); border: 1px solid var(--border-color); color: var(--text-primary); justify-content: center;">
```

(Both buttons use the `.btn-submit` class, which Task 3 already made solid red with white text — but these two instances override the background/color via inline `style`, intentionally turning them into a *secondary*-looking button despite the class. That inline-override pattern is preserved as-is; only the literal color values inside it are recalculated.)

- [ ] **Step 4: Key-loan modal "Itens Retirados" panel and inner divider (static HTML)**

Find:
```html
                      <div style="display: flex; flex-direction: column; gap: 12px; padding: 12px; background-color: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 8px;">
```

Replace with:
```html
                      <div style="display: flex; flex-direction: column; gap: 12px; padding: 12px; background-color: rgba(0,0,0,0.02); border: 1px solid var(--border-color); border-radius: 8px;">
```

Find:
```html
                          <div style="display: flex; flex-direction: column; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">
```

Replace with:
```html
                          <div style="display: flex; flex-direction: column; gap: 8px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
```

- [ ] **Step 5: Empty-state panels — rooms grid and keys mural (two near-identical occurrences in JS template strings)**

Find (inside `renderRoomsGrid`, `~line 2468`):
```javascript
                        <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: var(--text-secondary); background: rgba(255, 255, 255, 0.02); border: 1px dashed var(--border-color); border-radius: 12px;">
```

Replace with:
```javascript
                        <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: var(--text-secondary); background: rgba(0, 0, 0, 0.02); border: 1px dashed var(--border-color); border-radius: 12px;">
```

Find (inside `renderKeysMural`, `~line 3699`, identical literal pattern):
```javascript
                    <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: var(--text-secondary); background: rgba(255, 255, 255, 0.02); border: 1px dashed var(--border-color); border-radius: 12px;">
```

Replace with:
```javascript
                    <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: var(--text-secondary); background: rgba(0, 0, 0, 0.02); border: 1px dashed var(--border-color); border-radius: 12px;">
```

- [ ] **Step 6: Archive-room button (JS template string)**

Find:
```javascript
                            <button type="button" class="btn-secondary" onclick="archiveRoomCard('${room.id}')" style="margin-top: 8px; border-color: rgba(255, 26, 60, 0.3); color: rgba(255, 26, 60, 0.8); justify-content: center; width: 100%;">
```

Replace with:
```javascript
                            <button type="button" class="btn-secondary" onclick="archiveRoomCard('${room.id}')" style="margin-top: 8px; border-color: rgba(225, 21, 24, 0.3); color: rgba(225, 21, 24, 0.85); justify-content: center; width: 100%;">
```

- [ ] **Step 7: Key-loan mural card items panel (JS template string)**

Find:
```javascript
                        <div style="margin: 10px 0; padding: 10px; background-color: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 8px;">
```

Replace with:
```javascript
                        <div style="margin: 10px 0; padding: 10px; background-color: rgba(0,0,0,0.02); border: 1px solid var(--border-color); border-radius: 8px;">
```

- [ ] **Step 8: Key/AC status badges in `renderKeysHistory` (JS template literals)**

Find:
```javascript
                        itemsHTML += `<span class="status-badge" style="background: rgba(255, 26, 60, 0.1); color: var(--primary); border: 1px solid rgba(255, 26, 60, 0.2); font-size: 0.75rem; padding: 2px 6px; border-radius: 6px; width: fit-content; white-space: nowrap; font-weight: 600;">Chave (${loan.qtyKey} un)</span>`;
```

Replace with:
```javascript
                        itemsHTML += `<span class="status-badge" style="background: rgba(225, 21, 24, 0.08); color: var(--primary); border: 1px solid rgba(225, 21, 24, 0.2); font-size: 0.75rem; padding: 2px 6px; border-radius: 6px; width: fit-content; white-space: nowrap; font-weight: 600;">Chave (${loan.qtyKey} un)</span>`;
```

Find:
```javascript
                        itemsHTML += `<span class="status-badge" style="background: rgba(16, 185, 129, 0.1); color: var(--success); border: 1px solid rgba(16, 185, 129, 0.2); font-size: 0.75rem; padding: 2px 6px; border-radius: 6px; width: fit-content; white-space: nowrap; font-weight: 600;">Ar (${loan.qtyAc} un)</span>`;
```

Replace with:
```javascript
                        itemsHTML += `<span class="status-badge" style="background: rgba(13, 148, 103, 0.08); color: var(--success); border: 1px solid rgba(13, 148, 103, 0.2); font-size: 0.75rem; padding: 2px 6px; border-radius: 6px; width: fit-content; white-space: nowrap; font-weight: 600;">Ar (${loan.qtyAc} un)</span>`;
```

- [ ] **Step 9: Key history table row border (JS template string)**

Find:
```javascript
                    tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
```

Replace with:
```javascript
                    tr.style.borderBottom = '1px solid var(--border-color)';
```

- [ ] **Step 10: Manual verification**

Reload the app. On "Empréstimos": open the export modal and confirm the "Copiar Texto" button and export table preview look correct on light background (no dark boxes). On "Vistorias" with zero active inspections: confirm the empty-state panel (dashed border, centered message) reads clearly on light background. On "Chaves" with zero active key loans: confirm the same for the keys-mural empty state. Register a key + AC-control loan, return it, and check the "Histórico de Chaves" table: confirm the "Chave"/"Ar" badges are colored correctly (red/green tint) and row borders are visible but subtle. Archive a room card (master password `gl@operacoes`) and confirm the archive button renders in a visible red outline before clicking.

- [ ] **Step 11: Commit**

```bash
git add index.html
git commit -m "style: recalibrate remaining inline template colors across export, keys, and empty-state panels"
```

---

### Task 8: Full manual verification pass

**Files:** None modified — this task is verification-only, confirming Tasks 1-7 together produce a coherent, legible light theme across the whole app.

**Interfaces:** N/A (verification task).

- [ ] **Step 1: Cold-start check**

Open `index.html` fresh (hard refresh / clear cache if testing repeatedly). Confirm the splash screen shows, transitions cleanly into the app, and the whole app renders in the light theme with no leftover dark boxes, no invisible text (dark-on-dark or light-on-light), and the Onest font visibly applied (rounder letterforms than the old Inter/Outfit) across headings and body text.

- [ ] **Step 2: Empréstimos tab full flow**

Register a furniture loan (with and without a signature), confirm it appears in history with a red "Ativo" badge, mark it returned, confirm the badge turns green. Filter/search the history list. Open the export modal, try both "Copiar Texto" and "Baixar Excel". Edit an existing loan, delete one (master password `gl@operacoes`).

- [ ] **Step 3: Vistorias tab full flow**

Start a check-in on a room with photos, complete a check-out with at least one changed quantity to trigger a divergence, view the comparison report, confirm it prints/exports cleanly. Archive a room.

- [ ] **Step 4: Chaves tab full flow**

Register a key loan for 2-3 rooms plus an AC-control loan for the same event in one submission (per Fase 1's data model, this should produce separate room-scoped key cards and one event-scoped AC card). Return items individually and via "Devolver Todas as Chaves e Controles". Check the history table.

- [ ] **Step 5: Cross-cutting checks**

Resize the browser window (or use DevTools device toolbar) to a narrow mobile width and confirm nothing overflows or clips awkwardly with the new pill buttons/larger card radii. Check color contrast informally: confirm no text is hard to read against its background anywhere visited above (this app has no automated contrast-checking tooling, so this is a visual judgment call, not a formal audit).

- [ ] **Step 6: Report findings**

If everything above renders correctly with no visual regressions or illegible text, the phase is complete — no commit needed for this task since nothing was changed. If any issue is found, note the exact screen/element and fix it as a small follow-up commit before considering Fase 2 done.

---

## Post-plan check

After Task 8, re-read the design spec's component list (§5, "Componentes com cor 'hardcoded'") and confirm every category it names — badges, glass overlays, gradients/shadows using the old primary-glow, hardcoded hex — was addressed by a task above. All are covered: badges (Tasks 5, 6, 7), glass overlays (Tasks 3, 4, 5, 6, 7), gradients (Tasks 2, 3), hardcoded hex/rgba literals (all tasks, per the color conversion table). The splash screen, typography, and shape/radius requirements from the spec's §2-4 are covered by Tasks 1-3.
