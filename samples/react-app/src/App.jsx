// A11Y ERRORS INTENTIONAL — used to validate a11y-sdk detection
// Errors present:
//   [1] <html> has no lang attribute (in index.html)
//   [2] <img> missing alt
//   [3] <button> with no accessible name (icon-only, no aria-label)
//   [4] <input> with no associated <label>
//   [5] <div> used as interactive button (no role, no keyboard handler)
//   [6] <a> with generic "click here" text
//   [7] Heading hierarchy skips h1 → h3

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

      <ul>
        <li>Product A — $10</li>
        <li>Product B — $20</li>
      </ul>
    </div>
  );
}
// trigger
