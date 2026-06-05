<script>
  function onAction() {}
</script>

<!-- A11Y ERRORS INTENTIONAL — used to validate a11y-sdk detection -->
<!-- Errors present:
  [1] <html> has no lang attribute (in index.html)
  [2] <img> missing alt
  [3] <button> with no accessible name (emoji-only, no aria-label)
  [4] <input> with no associated <label>
  [5] <div> used as interactive element (no role, no keyboard handler)
  [6] <a> with generic "click here" text
  [7] Heading hierarchy skips h1 → h3
-->

<!-- [7] no h1 or h2 on page -->
<h3>Latest updates</h3>

<!-- [2] missing alt -->
<img src="https://placehold.co/200x150" />

<!-- [6] generic link text -->
<p>See the changelog — <a href="/changelog">click here</a></p>

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

<ul>
  <li>Update A — released today</li>
  <li>Update B — released yesterday</li>
</ul>
