<template>
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
  <div>
    <!-- [7] no h1 or h2 on page -->
    <h3>Nasze oferty</h3>

    <!-- [2] missing alt -->
    <img src="https://placehold.co/200x150" />

    <!-- [6] generic link text -->
    <p>Sprawdź promocje — <a href="/promocje">kliknij tutaj</a></p>

    <!-- [4] input with no label -->
    <div>
      <input type="email" placeholder="Twój e-mail…" />
    </div>

    <!-- [3] icon button with no accessible name -->
    <button @click="subscribe">✉️</button>

    <!-- [5] div as interactive element -->
    <div
      style="cursor: pointer; padding: 8px; background: #eee"
      @click="dismiss"
    >
      Zamknij powiadomienie
    </div>

    <ul>
      <li>Oferta A — 49 zł</li>
      <li>Oferta B — 99 zł</li>
    </ul>
  </div>
</template>

<script setup>
function subscribe() {}
function dismiss() {}
</script>
