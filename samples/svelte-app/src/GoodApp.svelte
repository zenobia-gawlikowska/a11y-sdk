<script>
  function onAction() {}
</script>

<!-- Corrected version of App.svelte — same page, every intentional
     violation fixed. Serve at /good.html to see the a11y-sdk audit/behave
     scripts pass cleanly. -->

<a href="#main-content" class="skip-link">Skip to main content</a>

<nav aria-label="Primary">
  <a href="/good.html" aria-current="page">Home</a>
  <a href="/archive">Archive</a>
</nav>

<main id="main-content">
  <h1>Latest updates</h1>

  <img src="https://placehold.co/200x150" alt="Newsroom desk with monitors showing live coverage" />

  <p>See the changelog — <a href="/changelog">read what's new in this release</a></p>

  <p>See our terms of service — <a href="/terms">read our terms of service</a></p>

  <h2>Top Stories</h2>

  <form>
    <div>
      <label for="search">Search</label>
      <input id="search" type="search" />
    </div>

    <fieldset>
      <legend>Digest frequency</legend>
      <input type="radio" name="frequency" id="freq-daily" value="daily" />
      <label for="freq-daily">Daily</label>
      <input type="radio" name="frequency" id="freq-weekly" value="weekly" />
      <label for="freq-weekly">Weekly</label>
    </fieldset>

    <div>
      <label for="email">Email</label>
      <input id="email" type="email" autocomplete="email" aria-invalid="true" aria-describedby="email-error" />
      <p id="email-error">Enter a valid email address</p>
    </div>

    <div>
      <label for="discount">Discount code</label>
      <input id="discount" type="text" />
    </div>
    <div>
      <label for="referral">Referral code</label>
      <input id="referral" type="text" />
    </div>
  </form>

  <button aria-label="Notifications" on:click={onAction}>🔔</button>

  <button on:click={onAction}>Dismiss</button>

  <button aria-label="Export subscriber list" on:click={onAction}>Export</button>
  <button aria-label="Export analytics report" on:click={onAction}>Export</button>

  <div style="width: 300px; font-size: 16px">
    Premium wireless headphones with active noise cancellation and thirty hour battery life.
  </div>

  <div style="display: flex; gap: 8px">
    <button style="width: 44px; height: 44px" aria-label="Edit" on:click={onAction}>
      ✏️
    </button>
    <button style="width: 44px; height: 44px" aria-label="Delete" on:click={onAction}>
      🗑️
    </button>
  </div>

  <ul>
    <li>Update A — released today</li>
    <li>Update B — released yesterday</li>
  </ul>
</main>
