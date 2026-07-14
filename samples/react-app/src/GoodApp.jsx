// Corrected version of App.jsx — same page, every intentional violation fixed.
// Serve at /good.html to see the a11y-sdk audit/behave scripts pass cleanly.

export default function GoodApp() {
  return (
    <div>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <nav aria-label="Primary">
        <a href="/good.html" aria-current="page">
          Home
        </a>{" "}
        <a href="/catalog">Catalog</a>
      </nav>

      <main id="main-content">
        <h1>Welcome to the shop</h1>

        <img src="https://placehold.co/200x150" alt="Wireless headphones on a white background" />

        <p>
          See our offers — <a href="/offers">view this week's offers</a>
        </p>

        <p>
          See our returns policy — <a href="/returns">read our returns policy</a>
        </p>

        <h2>Featured Deals</h2>

        <form>
          <div>
            <label htmlFor="search">Search products</label>
            <input id="search" type="text" />
          </div>

          <fieldset>
            <legend>Shipping method</legend>
            <input type="radio" name="shipping" id="ship-standard" value="standard" />
            <label htmlFor="ship-standard">Standard</label>
            <input type="radio" name="shipping" id="ship-express" value="express" />
            <label htmlFor="ship-express">Express</label>
          </fieldset>

          <div>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid="true"
              aria-describedby="email-error"
            />
            <p id="email-error">Enter a valid email address</p>
          </div>

          <div>
            <label htmlFor="coupon">Coupon code</label>
            <input id="coupon" type="text" />
          </div>
          <div>
            <label htmlFor="gift-card">Gift card code</label>
            <input id="gift-card" type="text" />
          </div>
        </form>

        <button aria-label="Search" onClick={() => console.log("search")}>
          🔍
        </button>

        <button onClick={() => console.log("add to cart")}>Add to cart</button>

        <button aria-label="Export order history" onClick={() => console.log("export")}>
          Export
        </button>
        <button aria-label="Export wishlist" onClick={() => console.log("export")}>
          Export
        </button>

        <div style={{ width: "300px", fontSize: "16px" }}>
          Premium wireless headphones with active noise cancellation and thirty hour battery life.
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            style={{ width: "44px", height: "44px" }}
            aria-label="Edit"
            onClick={() => console.log("edit")}
          >
            ✏️
          </button>
          <button
            style={{ width: "44px", height: "44px" }}
            aria-label="Delete"
            onClick={() => console.log("delete")}
          >
            🗑️
          </button>
        </div>

        <ul>
          <li>Product A — $10</li>
          <li>Product B — $20</li>
        </ul>
      </main>
    </div>
  );
}
