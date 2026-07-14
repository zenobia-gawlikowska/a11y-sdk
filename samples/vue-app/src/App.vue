<template>
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
    [13] Two links named "kliknij tutaj" pointing to different destinations — behave:unique-labels
    [14] Two distinct "Kod rabatowy" fields — behave:unique-labels
    [15] Two "Eksportuj" buttons — behave:unique-labels (warn-only)

    See ../good.html for the corrected version of this same page.
  -->
  <div>
    <!-- [7] no h1 or h2 on page -->
    <h3>Nasze oferty</h3>

    <!-- [2] missing alt -->
    <img src="https://placehold.co/200x150" />

    <!-- [6] generic link text -->
    <p>Sprawdź promocje — <a href="/promocje">kliknij tutaj</a></p>

    <!-- [13] same generic text, different destination -->
    <p>Sprawdź regulamin zwrotów — <a href="/zwroty">kliknij tutaj</a></p>

    <!-- [8] nav link to this page with no aria-current -->
    <nav aria-label="Primary">
      <a href="/">Strona główna</a> <a href="/katalog">Katalog</a>
    </nav>

    <!-- [10] fake heading — big and bold, but not a real heading element -->
    <div style="font-size: 26px; font-weight: 700">Wyróżnione oferty</div>

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

    <!-- [9] role="button" with no tabindex — visually a button, not keyboard-reachable -->
    <div role="button" @click="dismiss">Kup teraz</div>

    <!-- [11] radio group with no fieldset/legend -->
    <div>
      <input type="radio" name="dostawa" value="standard" /> Standardowa
      <input type="radio" name="dostawa" value="ekspres" /> Ekspresowa
    </div>

    <!-- [12] aria-invalid with no aria-describedby (label present, so this
        isolates the missing-error-association mistake) -->
    <label>
      E-mail
      <input type="email" aria-invalid="true" />
    </label>

    <!-- [14] two distinct fields, same accessible name -->
    <label>Kod rabatowy <input type="text" /></label>
    <label>Kod rabatowy <input type="text" /></label>

    <!-- [15] two buttons, same accessible name (warn-only) -->
    <button @click="dismiss">Eksportuj</button>
    <button @click="dismiss">Eksportuj</button>

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
