<script>
  function onAction() {}
</script>

<!-- A11Y ERRORS INTENTIONAL — used to validate a11y-sdk detection -->
<!-- Errors present:
  [1] <html> has no lang attribute (in index.html)
  [2] <img> missing alt
  [3] <button> with no accessible name (emoji-only, no aria-label)
  [4] <input> with no associated <label> — also caught by behave:form-navigation
  [5] <div> used as interactive element (no role, no keyboard handler)
  [6] <a> with generic "click here" text
  [7] Heading hierarchy skips h1 → h3 — also caught by behave:regions-headings (no <h1>, no <main>)
  [8] <nav> link to the current page missing aria-current="page" — behave:nav-current
  [9] role="button" element with no tabindex — not Tab-reachable — behave:tab-order
  [10] Large/bold <div> styled to look like a heading — behave:visual-headings
  [11] Radio group with no <fieldset>/<legend> — behave:form-navigation
  [12] aria-invalid="true" with no aria-describedby — behave:form-navigation
  [13] Two links named "click here" pointing to different destinations — behave:unique-labels
  [14] Two distinct "Discount code" fields — behave:unique-labels
  [15] Two "Export" buttons — behave:unique-labels (warn-only)
  [16] Fixed-height, overflow:hidden text container — clips once WCAG-minimum
       text spacing is applied — behave:text-spacing
  [17] Two 16x16px icon buttons with no gap between them — behave:target-size

  See ../good.html for the corrected version of this same page.
-->

<!-- [7] no h1 or h2 on page -->
<h3>Latest updates</h3>

<!-- [2] missing alt -->
<img src="https://placehold.co/200x150" />

<!-- [6] generic link text -->
<p>See the changelog — <a href="/changelog">click here</a></p>

<!-- [13] same generic text, different destination -->
<p>See our terms of service — <a href="/terms">click here</a></p>

<!-- [8] nav link to this page with no aria-current -->
<nav aria-label="Primary">
  <a href="/">Home</a> <a href="/archive">Archive</a>
</nav>

<!-- [10] fake heading — big and bold, but not a real heading element -->
<div style="font-size: 26px; font-weight: 700">Top Stories</div>

<!-- [4] input with no label -->
<div>
  <input type="search" placeholder="Search…" />
</div>

<!-- [3] icon button with no accessible name -->
<button on:click={onAction}>🔔</button>

<!-- [5] div acting as button — no role, no keyboard handler -->
<div
  style="cursor: pointer; padding: 8px; background: #eee"
  on:click={onAction}
>
  Dismiss
</div>

<!-- [9] role="button" with no tabindex — visually a button, not keyboard-reachable -->
<div role="button" on:click={onAction}>Subscribe</div>

<!-- [11] radio group with no fieldset/legend -->
<div>
  <input type="radio" name="frequency" value="daily" /> Daily
  <input type="radio" name="frequency" value="weekly" /> Weekly
</div>

<!-- [12] aria-invalid with no aria-describedby (label present, so this
    isolates the missing-error-association mistake) -->
<label>
  Email
  <input type="email" aria-invalid="true" />
</label>

<!-- [14] two distinct fields, same accessible name -->
<label>Discount code <input type="text" /></label>
<label>Discount code <input type="text" /></label>

<!-- [15] two buttons, same accessible name (warn-only) -->
<button on:click={onAction}>Export</button>
<button on:click={onAction}>Export</button>

<!-- [16] fixed-height, clipped text container — fits at normal spacing,
    overflows once WCAG-minimum text spacing is applied -->
<div style="height: 58px; overflow: hidden; width: 300px; font-size: 16px">
  Premium wireless headphones with active noise cancellation and thirty hour battery life.
</div>

<!-- [17] two 16x16px icon buttons flush against each other — under the
    24x24px minimum and crowded, so the spacing exception doesn't apply -->
<div style="display: flex; gap: 0">
  <button style="width: 16px; height: 16px; padding: 0; margin: 0" on:click={onAction}>
    ✏️
  </button>
  <button style="width: 16px; height: 16px; padding: 0; margin: 0" on:click={onAction}>
    🗑️
  </button>
</div>

<ul>
  <li>Update A — released today</li>
  <li>Update B — released yesterday</li>
</ul>
