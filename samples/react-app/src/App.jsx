// A11Y ERRORS INTENTIONAL — used to validate a11y-sdk detection
// Errors present:
//   [1] <html> has no lang attribute (in index.html)
//   [2] <img> missing alt
//   [3] <button> with no accessible name (icon-only, no aria-label)
//   [4] <input> with no associated <label> — also caught by behave:form-navigation
//   [5] <div> used as interactive button (no role, no keyboard handler)
//   [6] <a> with generic "click here" text
//   [7] Heading hierarchy skips h1 → h3 — also caught by behave:regions-headings (no <h1>, no <main>)
//   [8] <nav> link to the current page missing aria-current="page" — behave:nav-current
//   [9] role="button" element with no tabindex — not Tab-reachable — behave:tab-order
//   [10] Large/bold <div> styled to look like a heading — behave:visual-headings
//   [11] Radio group with no <fieldset>/<legend> — behave:form-navigation
//   [12] aria-invalid="true" with no aria-describedby — behave:form-navigation
//
// See ../good.html for the corrected version of this same page.

export default function App() {
  return (
    <div>
      {/* [7] jumps straight to h3 — no h1 or h2 on page */}
      <h3>Welcome to the shop</h3>

      {/* [2] image with no alt text */}
      <img src="https://placehold.co/200x150" />

      {/* [6] generic link text */}
      <p>
        See our offers — <a href="/offers">click here</a>
      </p>

      {/* [8] nav link to this page with no aria-current */}
      <nav aria-label="Primary">
        <a href="/">Home</a> <a href="/catalog">Catalog</a>
      </nav>

      {/* [10] fake heading — big and bold, but not a real heading element */}
      <div style={{ fontSize: "26px", fontWeight: 700 }}>Featured Deals</div>

      {/* [4] input with no label */}
      <div>
        <input type="text" placeholder="Search products…" />
      </div>

      {/* [3] icon button with no accessible name */}
      <button onClick={() => console.log("search")}>
        🔍
      </button>

      {/* [5] div acting as button — no role, no keyboard event */}
      <div
        style={{ cursor: "pointer", padding: "8px", background: "#eee" }}
        onClick={() => console.log("add to cart")}
      >
        Add to cart
      </div>

      {/* [9] role="button" with no tabindex — visually a button, not keyboard-reachable */}
      <div role="button" onClick={() => console.log("buy now")}>
        Buy now
      </div>

      {/* [11] radio group with no fieldset/legend */}
      <div>
        <input type="radio" name="shipping" value="standard" /> Standard
        <input type="radio" name="shipping" value="express" /> Express
      </div>

      {/* [12] aria-invalid with no aria-describedby (label present, so this
          isolates the missing-error-association mistake) */}
      <label>
        Email
        <input type="email" aria-invalid="true" />
      </label>

      <ul>
        <li>Product A — $10</li>
        <li>Product B — $20</li>
      </ul>
    </div>
  );
}
