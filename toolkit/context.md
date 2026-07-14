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
| `lint` | framework ESLint a11y plugin + built-in contract checks | pre-commit hook, on staged files |
| `axe` | `node .a11y/scripts/audit.cjs <url>` | on demand |
| `behave` | `node .a11y/scripts/behave.cjs <url>` | on demand |
| judgment | LLM / human review | generation & review time |

| Criterion | Deterministic checker(s) | Remaining judgment |
|---|---|---|
| 1.1.1 Non-text Content | lint + axe | alt text meaningful? decorative correctly hidden? |
| 1.3.1 Info and Relationships | lint + axe (incl. best-practice `region`/`landmark-*`/`heading-order`/`page-has-heading-one`/`empty-heading`, force-enabled — see `audit.ts`'s `BEST_PRACTICE_RULES`) + behave `nav-labels`, `table`, `regions-headings`, `form-navigation`, `visual-headings` | semantics match visual structure; which flagged candidates are really headings |
| 1.3.2 Meaningful Sequence | — | DOM order vs. reading order |
| 1.3.5 Identify Input Purpose | lint (token validity; missing autocomplete on personal-data inputs) + behave `autocomplete` | correct token choice |
| 1.4.1 Use of Color | — | color-only signalling |
| 1.4.3 Contrast (Minimum) | axe | — |
| 1.4.4 Resize Text | lint (px font sizes) + behave `zoom-200` | runtime-computed px sizes |
| 1.4.10 Reflow | behave `reflow-320` | — |
| 1.4.11 Non-text Contrast | — | component & focus-ring contrast |
| 1.4.12 Text Spacing | axe (`avoid-inline-spacing`) + behave `text-spacing` (injects WCAG-minimum spacing, diffs clipping/overflow before/after) | — |
| 1.4.13 Content on Hover/Focus | — | tooltip behavior |
| 2.1.1 Keyboard | lint + behave `menu-keyboard`, `tab-order` | full operability of custom widgets |
| 2.1.2 No Keyboard Trap | behave `dialog`, `tab-order` | traps that don't manifest as forward/backward asymmetry |
| 2.4.1 Bypass Blocks | axe + behave `skip-link` | — |
| 2.4.3 Focus Order | lint (`tabindex-no-positive`) + behave `tab-order` (reachability, positive tabindex, Tab/Shift+Tab symmetry) | is the order meaning-preserving for the visual layout |
| 2.4.4 Link Purpose | lint + axe + behave `unique-labels` (identical text, different destination) | text describes destination |
| 2.4.6 Headings and Labels | lint + behave `regions-headings` (h1 presence, empty headings, skipped levels), `visual-headings` (candidates only), `unique-labels` (distinct fields sharing a name) | descriptive quality; which visual-headings candidates should become real headings |
| 2.4.7 Focus Visible | behave `focus-visible` | — |
| 2.4.11 Focus Appearance | behave `focus-visible` (presence only) | 2px perimeter / 3:1 contrast |
| 2.5.3 Label in Name | axe | — |
| 2.5.8 Target Size (Minimum) | axe (`target-size`) + behave `target-size` (measures rendered targets, flags crowded/undersized, warns on exception candidates) | does a flagged target legitimately qualify for the inline/equivalent-target exception |
| 3.1.1 Language of Page | lint + axe | correct language code |
| 3.2.1 On Focus | lint (`no-autofocus`) | unexpected context changes |
| 3.2.2 On Input | lint (Vue) | auto-submit behavior |
| 3.3.1 Error Identification | behave `form-navigation` (aria-invalid/aria-describedby pairing) | does the error text accurately describe the problem; is validation triggered app-appropriately |
| 3.3.2 Labels or Instructions | lint + axe + behave `form-navigation` (accessible name, radio-group fieldset/legend) | label describes purpose |
| 4.1.1 Parsing | axe | — |
| 4.1.2 Name, Role, Value | lint (incl. dialog & aria-expanded contracts) + axe + behave `disclosure`, `dialog`, `nav-current`, `unique-labels` (repeated button names, warn) | state completeness of custom widgets |
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

**1.3.4 Orientation (WCAG 2.1)** — Content must not be locked to a single
display orientation (portrait or landscape) unless a specific orientation is
essential (e.g. a piano-keyboard app). Never force orientation via
`transform: rotate()` media-query hacks.

**1.3.5 Identify Input Purpose** — Form inputs for personal data must carry
`autocomplete` attributes (`name`, `email`, `tel`, `street-address`, etc.).

**1.4.1 Use of Color** — Never rely on color alone to convey information. Pair
color with text, icon, or pattern.

**1.4.2 Audio Control** — Audio that plays automatically for more than 3
seconds must have a visible mechanism to pause, stop, or mute it, or must not
autoplay at all. Never autoplay audio with no user-facing control.

**1.4.3 Contrast (Minimum)** — Normal text: 4.5:1 contrast ratio minimum.
Large text (≥ 18pt or ≥ 14pt bold): 3:1 minimum. Use a contrast checker for
any custom color combinations.

**1.4.4 Resize Text** — UI must remain usable at 200% text zoom without
horizontal scrolling. Use `rem`/`em` units, not `px`, for font sizes.

**1.4.10 Reflow** — Content must be presentable at 320px width without
requiring horizontal scrolling. Avoid fixed-width containers for text content.

**1.4.11 Non-text Contrast** — UI components (buttons, inputs, checkboxes) and
focus indicators must have at least 3:1 contrast against adjacent colors.

**1.4.12 Text Spacing (WCAG 2.1)** — No loss of content or functionality when
a user overrides text spacing to: line-height 1.5x, paragraph spacing 2x,
letter-spacing 0.12x, word-spacing 0.16x. Never set fixed heights on text
containers; never use `overflow: hidden`/`clip` on elements that hold
user-facing text.

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

**2.5.8 Target Size (Minimum) (WCAG 2.2)** — Interactive targets (buttons,
links styled as controls, form controls) must be at least 24×24 CSS pixels,
OR have enough spacing that a 24×24px zone centered on the target does not
overlap another target's zone, OR qualify for an exception (the target is
inline within a sentence, its size is not author-controlled, or an
equivalent-function target of adequate size is available elsewhere on the
page). Never rely on the exception as a first choice — pad small controls.

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

## Judgment-Only — Media, Timing & Motion

These criteria have no reliable script coverage (no behave recipe simulates a
video, a countdown, or a strobe effect) and axe's coverage, where it exists,
only catches the *absence of a mechanism* — never whether that mechanism is
adequate. Treat these as review checklist items, not tool output.

**1.2.1 Audio-only / Video-only (Prerecorded)** — Prerecorded audio-only
content needs a text transcript; prerecorded video-only content needs a text
alternative or an audio track describing the visuals. `axe:audio-caption` /
`axe:video-caption` only flag a `<video>`/`<audio>` element with zero
`<track>` children — they cannot judge whether a transcript exists elsewhere
on the page or whether a provided track is actually a transcript vs. captions.

**1.2.2 Captions (Prerecorded)** — `axe:video-caption` only checks that a
`<track kind="captions">` is present, never that the captions are accurate,
synced, or complete. Caption quality review stays manual.

**1.2.3 Audio Description or Media Alternative (Prerecorded)** — Prerecorded
video with meaningful visual information needs either an audio-described
track or a full text alternative. No checker verifies this; confirm manually
whenever a video conveys information not present in its own audio.

**1.2.4 Captions (Live)** — Live audio content (webinars, live streams) needs
real-time captions. Entirely a process/judgment concern — nothing in this
toolkit runs against live streams.

**1.2.5 Audio Description (Prerecorded)** — Stronger than 1.2.3: prerecorded
video needs audio description whenever visual-only information exists, even
if a separate text alternative is also provided. Judgment call on whether the
existing audio track already conveys the visual content.

**1.2.6–1.2.9 (AAA: sign language, extended audio description, media
alternative for live, audio-only for live)** — Only apply when this project's
AAA gate is enabled (see `runAxeScan(page, "AAA")`). Judgment-only; no
automated signal.

**2.2.1 Timing Adjustable** — Time limits (session timeouts, auto-advancing
carousels) must be extendable, disable-able, or absent. `axe:meta-refresh`
only catches the `<meta http-equiv="refresh">` tag — it says nothing about
JavaScript-driven `setTimeout`/`setInterval` redirects, session expiry, or
countdown UI, which are the common real-world cases. Ask "does this
auto-advance or expire, and can the user stop it?" whenever generating
timed UI.

**2.2.2 Pause, Stop, Hide** — Moving, blinking, scrolling, or auto-updating
content that starts automatically and lasts more than 5 seconds needs a
pause/stop/hide control. `axe:blink` and `axe:marquee` only catch the
deprecated `<blink>`/`<marquee>` tags — they do not see CSS `animation`,
`transition` carousels, auto-playing video backgrounds, or JS ticker
widgets. Every auto-rotating carousel or auto-refreshing dashboard needs a
visible pause control regardless of what the checkers report.

**2.2.6 Timeouts (AAA)** — Users must be warned of data-loss timeouts (e.g.
session expiry clearing a form) unless the data is preserved for 20+ hours
after timeout. Judgment-only.

**2.3.1 Three Flashes or Below Threshold** — Nothing may flash more than
three times per second unless the flashing area and contrast are below the
general/red flash thresholds. No checker measures flash rate; treat any
strobing, rapidly-blinking, or high-contrast-flickering effect as a hard stop
and flag it for manual review — this is a seizure-safety criterion, not a
style preference.

**2.3.2 / 2.3.3 (AAA: no flashing at all / animation from interactions)** —
2.3.2 forbids any flashing outright; 2.3.3 requires motion-triggered
animation (e.g. parallax on scroll) to respect `prefers-reduced-motion` and
offer a way to disable it. Judgment-only; when generating scroll- or
interaction-triggered animation, gate it behind
`@media (prefers-reduced-motion: no-preference)` by default.

---

## Component-Aware Patterns

Detailed rules for components that require specific ARIA contracts. See
`rules/` for deep-dive docs on each pattern.

### Keyboard Navigation (Tab Stops)

**Required behavior:**
- Every interactive element (native or `role="button"`/`"link"`/`"checkbox"`/
  `"radio"`/`"switch"`/`"menuitem"`/`"tab"`/`"option"`) must be reachable by
  Tab, unless it's a roving-tabindex item inside a composite widget
  (`role="menu"`, `"tablist"`, `"listbox"`, `"radiogroup"`, `"tree"`,
  `"grid"`) where arrow keys — not Tab — move focus between siblings
- Never use `tabindex` greater than `0` — it creates a separate tab order
  disconnected from the DOM; reorder the DOM instead
- Shift+Tab must retrace the exact reverse of the forward Tab sequence; a
  custom `keydown` handler that intercepts Tab in only one direction is a
  keyboard trap even outside a dialog

**Implementation pointer:** see `rules/keyboard-nav.md` for the Tab model vs.
arrow-key (roving tabindex) model, and the menu/listbox/tablist keyboard
contracts.

**Deterministic check:** `node .a11y/scripts/behave.cjs <url> --recipes tab-order`
walks the page as a keyboard-only user: it fails on positive tabindex,
ARIA-interactive elements outside composite widgets that aren't
Tab-focusable, and any mismatch between the forward Tab sequence and its
Shift+Tab retrace. Whether the resulting order is meaning-preserving for the
visual layout remains a judgment check.

---

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
`--dialog-trigger "<css selector>"`. The pre-commit hook already flags
`role="dialog"` markup missing `aria-modal` or an accessible name at commit
time.

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
`audit.cjs`; personal-data inputs missing `autocomplete` are flagged both by
the pre-commit hook (statically) and `behave.cjs --recipes autocomplete`
(rendered). `behave.cjs --recipes form-navigation` walks the form the way a
screen reader user's forms mode would: every visible control must resolve to
a non-empty accessible name, radio groups sharing a `name` must sit inside a
labelled `<fieldset><legend>` (or a named `role="radiogroup"`), and any field
carrying `aria-invalid="true"` must have `aria-describedby` pointing at real,
non-empty text. `behave.cjs --recipes unique-labels` additionally fails when
two distinct (non-grouped) fields resolve to the same accessible name — a
page with two fields both just called "Email" is as broken for a screen
reader user's form-fields list as a missing label. Whether the error TEXT
accurately explains the problem, and grouping strategies beyond same-name
radio groups (checkbox groups, multi-field address blocks), remain judgment
checks.

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

**Deterministic check:** `behave.cjs --recipes nav-labels,disclosure,menu-keyboard,nav-current`
verifies unique nav labels, that `aria-expanded` toggles actually toggle (and
`aria-controls` resolves), that `role="menu"` implements the arrow-key
contract it promises, and — for any nav link whose `href` resolves to the
current page's URL — that it (and only it) carries `aria-current="page"`.
Pages where no nav link points at the current page (SPA navs driven entirely
by client-side routing, or a page just not represented in the nav) skip this
check rather than guessing.

---

### Page Structure (Landmarks & Headings)

**Required structure:**
- Exactly one `<main>` (or `role="main"`) per page — the primary jump target
  for screen reader region navigation
- If more than one `<header>`/`role="banner"`, `<footer>`/`role="contentinfo"`,
  or `<aside>`/`role="complementary"` exists, each needs a unique accessible
  name
- Exactly one `<h1>` per page; heading levels never skip (`h2` cannot jump
  straight to `h4`); no heading is empty

**Implementation pointer:** see `rules/landmark-usage.md`.

**Deterministic check:** `behave.cjs --recipes regions-headings` walks the
page the way a screen reader user's rotor (regions/headings navigation)
would: it fails on zero or multiple `<main>` landmarks, unnamed/duplicate
banner-contentinfo-complementary landmarks when more than one exists, a
missing `<h1>`, skipped heading levels, and empty headings — and warns when
visible content sits outside every landmark (a heuristic with legitimate
exceptions, so it doesn't block). `audit.cjs` covers the same ground with
axe-core's `region`/`landmark-*`/`heading-order`/`page-has-heading-one`/
`empty-heading` rules — the overlap is intentional (the same "commit-time
lint / runtime behave twin" pattern this toolkit already uses elsewhere), so
`regions-headings` still catches these when `behave.cjs` runs standalone.
Region/landmark navigation is itself a static structural property, not a
runtime interaction — there's no meaningful additional *behavioral* test to
add here beyond what these two layers already check. Whether the chosen HTML
semantics actually match the visual structure remains a judgment check.

**Fake headings:** `behave.cjs --recipes visual-headings` finds visually
prominent text (font-size and weight relative to body text) that isn't
marked up as a heading — the classic `<div class="title">` styled to look
like an `<h2>` but never given one. This only `warn`s, never `fail`s: the
visual-prominence signal is fully script-detectable, but whether a given
candidate is *really* acting as a heading (versus a stat tile, CTA button,
pull-quote, or logo — all excluded from candidacy, along with anything
inside `header`/`nav`/`footer` chrome) is a judgment call. Read the
candidate list and decide per-element whether it should become a real
heading or `role="heading"`.

---

### Unique Labels (Links, Buttons, Form Fields)

A screen reader user browsing a "links list", "buttons list", or "form
fields list" hears only the accessible name — no surrounding visual
context. Identical names that don't mean the same thing break that
navigation mode even though sighted users never notice.

**Required behavior:**
- Links with the same visible/accessible text must point to the same
  destination — a "Read more" repeated across a list of articles must not
  reuse the exact same wording for different articles (add per-item context:
  "Read more about Widget Pro")
- Two distinct form fields must not resolve to the same accessible name
  (two fields both just called "Email" is as broken as a missing label) —
  this doesn't apply to a radio/checkbox group's own options, which
  legitimately have different labels under one shared `name` attribute
- Prefer a more specific accessible name (`aria-label`) over identical
  visible button text when the same action repeats across a list (e.g. "Add
  Widget Pro to cart" rather than a bare "Add to cart" repeated per row)

**Deterministic check:** `behave.cjs --recipes unique-labels` fails when
links sharing an accessible name resolve to different destinations, and
when distinct (non-grouped) form controls share an accessible name. It only
`warn`s on repeated button names — a card-grid "Add to cart" pattern is
extremely common in real apps and lower severity than the other two, so
it's a heads-up rather than a hard block.

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

Behavioral recipes: `reflow-320`, `zoom-200`, `text-spacing`, `target-size`,
`skip-link`, `focus-visible`, `tab-order`, `dialog`, `disclosure`,
`menu-keyboard`, `nav-labels`, `nav-current`, `regions-headings`,
`visual-headings`, `unique-labels`, `table`, `autocomplete`, `form-navigation`,
`live-region-static`. All run by default; `--recipes` selects a subset. Each
recipe reloads the page, so they cannot interfere with each other.

`text-spacing` injects the WCAG-minimum spacing values (1.5 line-height,
0.12em letter-spacing, 0.16em word-spacing, 2em paragraph spacing) and
diffs clipping/scroll-overflow before vs. after, excluding elements that
were already clipped before injection. `target-size` measures every
interactive element's rendered box: under 24×24px with another target
inside its 24×24px zone `fail`s, under 24×24px but isolated `warn`s (the
inline/exception cases need a human to confirm), 24×24px or larger `pass`es.

`visual-headings` never `fail`s — it only `warn`s or `pass`es, since it
hands back a candidate list (visually prominent non-heading text) rather
than a verdict. Treat a `warn` there as "go read these elements," not as a
violation to fix mechanically. `unique-labels` is similar but partial: it
`fail`s on duplicate link destinations and duplicate form-field names (both
unambiguous), but only `warn`s on duplicate button names (real severity
varies too much for a hard rule).

Three recipes are organized around assistive-technology personas rather than
a single component: `tab-order` walks the page the way a sighted keyboard-only
user would (every ARIA-interactive element reachable by Tab, no positive
tabindex, Shift+Tab retraces Tab exactly); `regions-headings`, `nav-current`,
and `form-navigation` walk it the way a screen reader user's rotor/forms mode
would (one `<main>`, uniquely-labelled banner/contentinfo/complementary
landmarks, a sane heading hierarchy, "you are here" marked correctly in nav,
every control named, radio groups grouped, error states wired with
aria-describedby).

`audit.cjs` force-enables a curated set of axe-core rules that ship tagged
only `best-practice` (no `wcag2a`/`wcag2aa`/`wcag2aaa` tag, so the default
tag filter would silently skip them): `region` (all content inside a
landmark), `landmark-one-main`, `landmark-unique`, the `landmark-*-is-top-level`
and `landmark-no-duplicate-*` family, `heading-order`, `page-has-heading-one`,
and `empty-heading`. See `audit.ts`'s `BEST_PRACTICE_RULES` for the exact list.

`audit.cjs` also tags in `wcag21a`/`wcag21aa`/`wcag22aa` alongside the
WCAG 2.0 `wcag2a`/`wcag2aa` tags, so WCAG 2.1/2.2-only criteria
(1.3.4 Orientation, 1.3.5 autocomplete validity, 1.4.12 Text Spacing,
2.5.3 Label in Name, 2.5.8 Target Size) are included in the AA scan, not
just AAA. It force-enables `target-size`, `css-orientation-lock`, and
`label-content-name-mismatch` for the same reason as the best-practice
rules above — axe-core drops tag-matched rules that aren't also listed in
`.options({ rules })` once that option is used at all. See `audit.ts`'s
`WCAG_21_22_RULES`.

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
