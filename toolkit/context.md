# a11y-sdk: Accessibility Rules for AI-Assisted Development

This file is automatically loaded into your AI context. It gives the AI
everything it needs to generate accessible UI components without being
prompted. You do not need to mention accessibility — the AI will apply
these rules automatically.

To use the audit feature, ask: "audit this page at localhost:3000".

---

## Enforcement Map — run scripts before reasoning

Most rules in this file are enforced by deterministic tooling. **Never assert
that a script-owned rule passes or fails by reading code or reasoning about
it** — run the owning checker and report its output. Reserve judgment for the
rules marked "judgment" below, and for interpreting and fixing checker
findings. The machine-readable version of this map is `.a11y/rules/registry.json`.

| Layer | Tool | When it runs |
|---|---|---|
| `lint` | framework ESLint a11y plugin | pre-commit hook, on staged files |
| `axe` | `node .a11y/scripts/audit.cjs <url>` | on demand |
| `behave` | `node .a11y/scripts/behave.cjs <url>` | on demand |
| judgment | LLM / human review | generation & review time |

| Criterion | Deterministic checker(s) | Remaining judgment |
|---|---|---|
| 1.1.1 Non-text Content | lint + axe | alt text meaningful? decorative correctly hidden? |
| 1.3.1 Info and Relationships | lint + axe + behave `nav-labels`, `table` | semantics match visual structure |
| 1.3.2 Meaningful Sequence | — | DOM order vs. reading order |
| 1.3.5 Identify Input Purpose | lint (token validity) + behave `autocomplete` | correct token choice |
| 1.4.1 Use of Color | — | color-only signalling |
| 1.4.3 Contrast (Minimum) | axe | — |
| 1.4.4 Resize Text | behave `zoom-200` | px→rem source review |
| 1.4.10 Reflow | behave `reflow-320` | — |
| 1.4.11 Non-text Contrast | — | component & focus-ring contrast |
| 1.4.13 Content on Hover/Focus | — | tooltip behavior |
| 2.1.1 Keyboard | lint + behave `menu-keyboard` | full operability of custom widgets |
| 2.1.2 No Keyboard Trap | behave `dialog` | traps outside dialogs |
| 2.4.1 Bypass Blocks | axe + behave `skip-link` | — |
| 2.4.3 Focus Order | lint (`tabindex-no-positive`) | logical order |
| 2.4.4 Link Purpose | lint + axe | text describes destination |
| 2.4.6 Headings and Labels | lint | descriptive quality |
| 2.4.7 Focus Visible | behave `focus-visible` | — |
| 2.4.11 Focus Appearance | behave `focus-visible` (presence only) | 2px perimeter / 3:1 contrast |
| 2.5.3 Label in Name | axe | — |
| 3.1.1 Language of Page | lint + axe | correct language code |
| 3.2.1 On Focus | lint (`no-autofocus`) | unexpected context changes |
| 3.2.2 On Input | lint (Vue) | auto-submit behavior |
| 3.3.1 Error Identification | — | error wiring on real validation |
| 3.3.2 Labels or Instructions | lint + axe | label describes purpose |
| 4.1.1 Parsing | axe | — |
| 4.1.2 Name, Role, Value | lint + axe + behave `disclosure`, `dialog` | state completeness of custom widgets |
| 4.1.3 Status Messages | behave `live-region-static` (partial) | role choice; injection timing |

The full prose rules below remain the **generation-time guidance** — apply
them when writing code. The map above governs **verification**: what to run,
and what is left for judgment, when checking code.

---

## WCAG 2.1 AA — Minimum Coverage

Every component generated or reviewed MUST satisfy these criteria.

### Perceivable

**1.1.1 Non-text Content** — Every `<img>`, `<svg>`, `<canvas>`, and icon button
must have a text alternative. Use `alt` on images, `aria-label` on icon buttons,
`aria-hidden="true"` on decorative images, and `title` on `<svg>` elements that
carry meaning.

**1.3.1 Info and Relationships** — Structure must be conveyed through semantics,
not only visual presentation. Use heading elements (`h1`–`h6`) in logical order.
Use `<table>` with `<th scope>` for tabular data. Use `<ul>` / `<ol>` for lists.
Never use a `<div>` where a semantic element exists.

**1.3.2 Meaningful Sequence** — DOM order must match reading order. Do not
position content visually out of sequence with CSS (e.g. `order` in flexbox or
`position: absolute`) without ensuring screen readers follow the correct order.

**1.3.5 Identify Input Purpose** — Form inputs for personal data must carry
`autocomplete` attributes (`name`, `email`, `tel`, `street-address`, etc.).

**1.4.1 Use of Color** — Never rely on color alone to convey information. Pair
color with text, icon, or pattern.

**1.4.3 Contrast (Minimum)** — Normal text: 4.5:1 contrast ratio minimum.
Large text (≥ 18pt or ≥ 14pt bold): 3:1 minimum. Use a contrast checker for
any custom color combinations.

**1.4.4 Resize Text** — UI must remain usable at 200% text zoom without
horizontal scrolling. Use `rem`/`em` units, not `px`, for font sizes.

**1.4.10 Reflow** — Content must be presentable at 320px width without
requiring horizontal scrolling. Avoid fixed-width containers for text content.

**1.4.11 Non-text Contrast** — UI components (buttons, inputs, checkboxes) and
focus indicators must have at least 3:1 contrast against adjacent colors.

**1.4.13 Content on Hover or Focus** — Tooltips and hover content must be:
(a) dismissible without moving focus, (b) hoverable (pointer can move over the
tooltip content), (c) persistent until dismissed or focus moves.

### Operable

**2.1.1 Keyboard** — All interactive elements must be operable by keyboard.
Tab order must be logical. No keyboard traps unless inside a modal (see modal
pattern below). Every action available via mouse must be available via keyboard.

**2.1.2 No Keyboard Trap** — Keyboard focus must never be trapped in a component
unless that trapping is intentional and part of a modal dialog pattern. Modal
dialogs MUST trap focus inside (see modal pattern). Other components must not.

**2.4.1 Bypass Blocks** — Pages with repeated navigation must offer a skip link
as the first focusable element: `<a href="#main-content" class="skip-link">Skip to main content</a>`.

**2.4.3 Focus Order** — Focus must move in a logical order that preserves
meaning and operability. Do not use `tabindex > 0` to manipulate focus order —
reorder the DOM instead.

**2.4.4 Link Purpose** — Link text must describe the destination. Never use
"click here", "read more", or "link". If visual context supplements sparse link
text, add `aria-label` or `aria-labelledby` for screen readers.

**2.4.6 Headings and Labels** — Headings must describe the content that follows.
Form labels must describe the input's purpose. Do not use placeholder as the
only label.

**2.4.7 Focus Visible** — Every focusable element must have a visible focus
indicator. Never remove the outline without providing a custom equivalent with
at least 3:1 contrast.

**2.4.11 Focus Appearance (AA, WCAG 2.2)** — Focus indicator must have a 2px
minimum perimeter and at least 3:1 contrast ratio change between focused and
unfocused states.

**2.5.3 Label in Name** — For interactive elements with visible text labels,
the accessible name must contain the visible label text. `aria-label` that
contradicts visible text will confuse users.

### Understandable

**3.1.1 Language of Page** — The `<html>` element must have `lang` set to the
correct language code (e.g. `lang="en"`, `lang="pl"`).

**3.2.1 On Focus** — Receiving focus must not cause unexpected context changes
(e.g. form submit, navigation). Interactive behavior must be triggered by
explicit user action.

**3.2.2 On Input** — Changing a form field must not automatically submit the
form or navigate away without warning.

**3.3.1 Error Identification** — When a form input has an error, describe the
error in text. Connect the error message to the field via `aria-describedby`.
Use `aria-invalid="true"` on the invalid field.

**3.3.2 Labels or Instructions** — Every form input must have a visible
`<label>` element associated via `for` / `id` or wrapping the input. Do not
rely on placeholder text as the label.

### Robust

**4.1.1 Parsing** — HTML must be well-formed. No duplicate IDs. No incorrectly
nested elements. Self-closing tags must be properly terminated in HTML5.

**4.1.2 Name, Role, Value** — Every custom interactive widget must have:
- An accessible name (via `aria-label`, `aria-labelledby`, or label element)
- A semantic role (via HTML semantics or `role` attribute)
- A state that is programmatically determinable (via `aria-expanded`,
  `aria-checked`, `aria-selected`, `aria-disabled`, etc.)

**4.1.3 Status Messages** — Status messages (form success, cart update, loading
complete) must be conveyed to assistive technology without receiving focus. Use
`role="status"` (polite) or `role="alert"` (assertive). Do not use `role="alert"`
for non-critical messages.

---

## Component-Aware Patterns

Detailed rules for components that require specific ARIA contracts. See
`rules/` for deep-dive docs on each pattern.

### Modal / Dialog

**Required ARIA:**
- Wrapper: `role="dialog"` and `aria-modal="true"`
- Accessible name: `aria-labelledby` pointing to the dialog title `id`
- Accessible description (optional): `aria-describedby` pointing to body text `id`

**Focus management:**
1. When dialog opens: move focus to the first focusable element inside, or to the
   dialog wrapper if no focusable element exists
2. Focus MUST be trapped inside the dialog while open — Tab and Shift+Tab cycle
   only within the dialog
3. When dialog closes: return focus to the element that triggered it

**Keyboard:**
- `Escape` must close the dialog
- Tab cycles forward through focusable elements, wrapping at the end
- Shift+Tab cycles backward, wrapping at the start

**Backdrop:** clicking the backdrop is a common close affordance but is not
required by WCAG. If implemented, ensure there is also a close button inside
the dialog.

**Implementation pointer:** see `rules/focus-trap.md` for the focus-trap loop.

**Deterministic check:** `node .a11y/scripts/behave.cjs <url> --recipes dialog`
verifies aria-modal, accessible name, focus trap, Escape-to-close, and focus
restore. If auto-detection can't open the dialog, pass
`--dialog-trigger "<css selector>"`.

---

### Form

**Required structure:**
- Every input must have a `<label>` element (associated via `for`/`id` or
  by wrapping), OR `aria-label`, OR `aria-labelledby`
- Placeholder is supplementary only — never the sole label
- Group related inputs with `<fieldset>` + `<legend>` (radio groups, checkbox
  groups, address blocks)
- Required fields: use `required` attribute (native) AND `aria-required="true"`
  for maximum compatibility

**Error handling:**
- On validation failure: set `aria-invalid="true"` on the input
- Error message: associate with `aria-describedby`; place the message near the
  field (inline preferred over summary-only)
- Success / status: use `role="status"` live region

**Implementation pointer:** see `rules/form-labeling.md`.

**Deterministic check:** labels are covered by the pre-commit lint and
`audit.cjs`; `behave.cjs --recipes autocomplete` flags personal-data inputs
missing `autocomplete`. Error-state wiring on real validation remains a
judgment check.

---

### Data Table

**Required structure:**
- Use `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>`
- Column headers: `<th scope="col">`
- Row headers: `<th scope="row">`
- Complex tables (spanning): add `id` to each `<th>` and `headers` attribute
  to each `<td>` listing the relevant header IDs
- Caption: always provide `<caption>` or `aria-label` on the table

**Sortable columns:**
- Use `aria-sort="ascending"` / `"descending"` / `"none"` on the `<th>` button
- Toggle the attribute on click; announce the change via a live region

**Pagination / loading:** use `aria-live="polite"` on the table container so
screen readers are informed when rows update.

**Deterministic check:** `behave.cjs --recipes table` verifies caption/name,
`<th>` header cells with scope, and that `aria-sort` actually toggles on
activation.

---

### Navigation

**Landmark structure:**
- `<nav aria-label="Main navigation">` for primary navigation
- `<nav aria-label="Breadcrumb">` for breadcrumbs
- If multiple `<nav>` elements exist on a page, each MUST have a unique
  `aria-label` to distinguish them
- Current page: `aria-current="page"` on the active link

**Disclosure / dropdown menus:**
- Toggle button: `aria-expanded="false"` / `"true"` on the button that controls
  the menu; `aria-controls` pointing to the menu `id`
- Menu container: `role="menu"` or use a plain list — depends on keyboard
  model chosen (see `rules/keyboard-nav.md`)
- Do NOT use `role="menu"` unless you also implement full menu keyboard behavior
  (arrow keys navigate, Home/End move to first/last, typeahead)

**Implementation pointer:** see `rules/landmark-usage.md` and `rules/keyboard-nav.md`.

**Deterministic check:** `behave.cjs --recipes nav-labels,disclosure,menu-keyboard`
verifies unique nav labels, that `aria-expanded` toggles actually toggle (and
`aria-controls` resolves), and that `role="menu"` implements the arrow-key
contract it promises.

---

### Toast / Alert / Notification

| Urgency | Role | When to use |
|---|---|---|
| Assertive — interrupts speech | `role="alert"` | Errors, session expiry, critical failures |
| Polite — waits for pause | `role="status"` | Success messages, progress, info |
| Time-based | `role="timer"` | Countdown, session-expiry warning |

**Rules:**
- The live region container must exist in the DOM BEFORE content is injected —
  adding the element and the text simultaneously may not trigger the
  announcement in all screen readers
- Do not inject alerts inside `aria-live` containers — `role="alert"` already
  implies `aria-live="assertive"`
- Never stack multiple `role="alert"` announcements within 1–2 seconds; they
  will be cut off

**Implementation pointer:** see `rules/live-region.md`.

**Deterministic check:** `behave.cjs --recipes live-region-static` catches
live regions nested inside `aria-live` containers and static alert text
present at load. Injection timing and role-urgency choice remain judgment
checks.

---

## Rules Reference

Detailed guidance for patterns that require precise implementation:

- [Focus Trap](rules/focus-trap.md) — keyboard containment for modal dialogs and
  other overlay components
- [ARIA State](rules/aria-state.md) — correct use of `aria-expanded`,
  `aria-checked`, `aria-selected`, and other state attributes
- [Live Region](rules/live-region.md) — announcing dynamic content changes to
  screen readers without moving focus
- [Keyboard Navigation](rules/keyboard-nav.md) — Tab model vs. arrow-key model;
  implementing custom widget keyboard interactions
- [Form Labeling](rules/form-labeling.md) — labeling strategies, error patterns,
  and accessible form groups
- [Landmark Usage](rules/landmark-usage.md) — correct use of landmark elements
  and roles for page structure

---

## Running the Audits

When a developer asks to audit a page or component, run BOTH deterministic
audit scripts against their dev server, then present merged results
conversationally. Your role is orchestration and interpretation — the scripts
decide pass/fail for everything they cover.

**Invocation:**
```
node .a11y/scripts/audit.cjs <url>                 # axe-core static scan
node .a11y/scripts/audit.cjs <url> --level AAA
node .a11y/scripts/behave.cjs <url>                # behavioral recipes
node .a11y/scripts/behave.cjs <url> --recipes dialog,focus-visible
node .a11y/scripts/behave.cjs <url> --dialog-trigger "#open-settings"
```

Behavioral recipes: `reflow-320`, `zoom-200`, `skip-link`, `focus-visible`,
`dialog`, `disclosure`, `menu-keyboard`, `nav-labels`, `table`,
`autocomplete`, `live-region-static`. All run by default; `--recipes` selects
a subset. Each recipe reloads the page, so they cannot interfere with each
other.

**Step-by-step:**
1. Ask the developer: "What URL is the component available at?" (if not stated)
2. Confirm a dev server is running at that URL before launching the audits
3. Run `node .a11y/scripts/audit.cjs <url>`
4. Run `node .a11y/scripts/behave.cjs <url>` — if a modal exists but the
   `dialog` recipe reports it could not open it, find the trigger control and
   re-run with `--dialog-trigger "<selector>"`. Supplying that selector is
   your job (glue), not the script's.
5. Present merged results grouped by WCAG criterion, ordered by impact:
   `critical → serious → moderate → minor`, with behave failures ranked
   alongside axe violations — a broken focus trap is as real as a missing alt
6. For each violation: name the element, state the WCAG success criterion and
   its plain-English title, give a one-sentence fix prescription
7. ONLY THEN apply the judgment checks from the Enforcement Map (right
   column) — alt-text quality, link-text clarity, color-only signalling,
   reading order, error-state wiring, live-region injection timing. Do not
   re-litigate anything a script already decided.

**If Playwright is not installed (exit code 3 from either script):**
Tell the developer:
> The audit requires Playwright. Run these commands in your project:
> ```
> npm install --save-dev playwright @axe-core/playwright
> npx playwright install chromium
> ```
> Then re-run the audit.

**Exit codes (both scripts):** `0` clean, `1` violations found, `2`
infrastructure error (bad URL, unreachable server), `3` Playwright missing.
behave warnings do not affect the exit code — surface them as advisories.

**Output location:** results are also written to `.a11y/audit-results.json`
and `.a11y/behave-results.json` for reference.

**Conversational framing:** Do not dump raw JSON at the developer. Present a
narrative summary: "I found 3 critical issues and 2 serious issues. The most
important one is…" then list each violation with its fix.

---

## Config

Developer-editable configuration lives at `.a11y/config/a11y.config.json`.
It controls which rule categories the pre-commit hook enforces.

```json
{
  "wcagLevel": "AA",
  "rules": {
    "focus-management": true,
    "aria-roles": true,
    "keyboard-navigation": true,
    "color-contrast": true,
    "form-labeling": true,
    "landmark-structure": true,
    "live-regions": true,
    "images": true
  }
}
```

Setting any category to `false` disables those checks in the pre-commit hook.
The audit script always runs all checks regardless of this config — config
only affects the static hook (Layer 2).

To temporarily skip the hook for a specific commit (e.g. WIP):
```
git commit --no-verify -m "WIP: ..."
```
