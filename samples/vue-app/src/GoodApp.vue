<template>
  <!-- Corrected version of App.vue — same page, every intentional violation
       fixed. Serve at /good.html to see the a11y-sdk audit/behave scripts
       pass cleanly. -->
  <div>
    <a href="#main-content" class="skip-link">Przejdź do treści głównej</a>

    <nav aria-label="Primary">
      <a href="/good.html" aria-current="page">Strona główna</a>
      <a href="/katalog">Katalog</a>
    </nav>

    <main id="main-content">
      <h1>Nasze oferty</h1>

      <img src="https://placehold.co/200x150" alt="Słuchawki bezprzewodowe na białym tle" />

      <p>Sprawdź promocje — <a href="/promocje">zobacz oferty tego tygodnia</a></p>

      <p>Sprawdź regulamin zwrotów — <a href="/zwroty">przeczytaj regulamin zwrotów</a></p>

      <h2>Wyróżnione oferty</h2>

      <form>
        <div>
          <label for="email">
            Twój e-mail
            <input id="email" type="email" autocomplete="email" />
          </label>
        </div>

        <fieldset>
          <legend>Sposób dostawy</legend>
          <label for="dostawa-standard">
            <input type="radio" name="dostawa" id="dostawa-standard" value="standard" />
            Standardowa
          </label>
          <label for="dostawa-ekspres">
            <input type="radio" name="dostawa" id="dostawa-ekspres" value="ekspres" />
            Ekspresowa
          </label>
        </fieldset>

        <div>
          <label for="promo-code">
            Kod promocyjny
            <input
              id="promo-code"
              type="text"
              aria-invalid="true"
              aria-describedby="promo-code-error"
            />
          </label>
          <p id="promo-code-error">Ten kod wygasł</p>
        </div>

        <div>
          <label for="coupon">
            Kod rabatowy
            <input id="coupon" type="text" />
          </label>
        </div>
        <div>
          <label for="gift-card">
            Kod karty podarunkowej
            <input id="gift-card" type="text" />
          </label>
        </div>
      </form>

      <button aria-label="Subskrybuj" @click="subscribe">✉️</button>

      <button @click="dismiss">Zamknij powiadomienie</button>

      <button aria-label="Eksportuj historię zamówień" @click="dismiss">Eksportuj</button>
      <button aria-label="Eksportuj listę życzeń" @click="dismiss">Eksportuj</button>

      <ul>
        <li>Oferta A — 49 zł</li>
        <li>Oferta B — 99 zł</li>
      </ul>
    </main>
  </div>
</template>

<script setup>
function subscribe() {}
function dismiss() {}
</script>
