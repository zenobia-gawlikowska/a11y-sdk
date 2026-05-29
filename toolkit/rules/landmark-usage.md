# Landmark Usage

## When this applies

Landmark elements and roles define the high-level structure of a page and
allow screen reader users to jump directly to sections (via a landmarks menu
or a keyboard shortcut). Landmarks apply to every HTML page and SPA route.

Use landmarks whenever you define page-level structure:
- Primary page navigation
- Header / site branding area
- Main content area
- Secondary navigation (breadcrumbs, sidebar)
- Footer
- Search forms
- Complementary content (sidebars, related articles)

## Required behavior

1. **Every page must have exactly one `<main>` landmark.** `<main>` wraps the
   primary content — not the header, not the navigation, not the footer.
   All main content must be inside `<main>`. Do not add `role="main"` to a
   `<div>` if `<main>` exists; that creates duplicate landmarks.

2. **Navigation landmarks must have unique accessible names.** When a page has
   more than one `<nav>` element, each must be distinguished by `aria-label`
   or `aria-labelledby`:
   ```html
   <nav aria-label="Main navigation">…</nav>
   <nav aria-label="Breadcrumb">…</nav>
   <nav aria-label="In-page sections">…</nav>
   ```
   Two unlabeled `<nav>` elements are indistinguishable to screen reader users.

3. **`<header>` and `<footer>` are landmarks only at the top level.** Placed
   directly inside `<body>`, `<header>` maps to `role="banner"` and `<footer>`
   maps to `role="contentinfo"`. Placed inside `<article>`, `<section>`,
   `<aside>`, or `<main>`, they are generic and have no landmark role.

4. **`<aside>` maps to `role="complementary"`.** Use it for content that is
   related but separable from the main content (sidebars, related links, ads).
   Give it an accessible name if there are multiple `<aside>` elements.

5. **Skip link is the first focusable element.** Every page with repeated
   navigation must provide a skip link pointing to `<main>`:
   ```html
   <a href="#main-content" class="skip-link">Skip to main content</a>
   <!-- … header, navigation … -->
   <main id="main-content">…</main>
   ```

6. **`<section>` is a landmark only when named.** An unnamed `<section>` has
   no landmark role. Add `aria-label` or `aria-labelledby` to make it a named
   region. If you cannot name it, use `<div>` instead.

7. **No interactive elements inside `<header role="banner">` other than
   navigation links and search.** Avoid placing form controls, modals, or
   complex widgets inside the banner landmark — keep it to branding,
   navigation, and search.

## Common mistakes

**Mistake 1: Wrapping each `<section>` with its own `<nav>`**
A common mistake is adding `<nav>` inside every `<section>` for the section's
own sub-navigation. This floods the landmark list with unnamed `<nav>` elements.
Name each one with `aria-label`. [WCAG 1.3.6 Identify Purpose / 4.1.2]

**Mistake 2: Using `role="navigation"` on a `<div>` instead of `<nav>`**
Prefer semantic HTML. `<nav>` is equivalent to `<div role="navigation">` but
is more concise and better supported. [WCAG 4.1.1 Parsing]

**Mistake 3: Missing `id` on `<main>` when a skip link is present**
A skip link `<a href="#main-content">` that points to an element without
`id="main-content"` goes nowhere. Always pair the skip link target with a
matching ID. [WCAG 2.4.1 Bypass Blocks]

## Code shape

Correct landmark structure for a typical page:

```html
<!DOCTYPE html>
<html lang="en">
<head><title>Page title</title></head>
<body>

  <!-- Skip link (must be first focusable element) -->
  <a href="#main-content" class="skip-link">Skip to main content</a>

  <!-- Banner landmark (site-wide header) -->
  <header>
    <a href="/" aria-label="Home — Acme Corp">
      <img src="/logo.svg" alt="Acme Corp" />
    </a>

    <!-- Primary navigation -->
    <nav aria-label="Main navigation">
      <ul>
        <li><a href="/products" aria-current="page">Products</a></li>
        <li><a href="/about">About</a></li>
      </ul>
    </nav>

    <!-- Search (role="search" landmark) -->
    <form role="search" aria-label="Site search">
      <label for="search-input" class="sr-only">Search</label>
      <input id="search-input" type="search" name="q" />
      <button type="submit">Search</button>
    </form>
  </header>

  <!-- Breadcrumb (secondary nav) -->
  <nav aria-label="Breadcrumb">
    <ol>
      <li><a href="/">Home</a></li>
      <li><a href="/products">Products</a></li>
      <li><span aria-current="page">Widget Pro</span></li>
    </ol>
  </nav>

  <!-- Main content -->
  <main id="main-content">
    <h1>Widget Pro</h1>
    <!-- page content -->
  </main>

  <!-- Complementary content -->
  <aside aria-label="Related products">
    <!-- sidebar content -->
  </aside>

  <!-- Content info landmark (site-wide footer) -->
  <footer>
    <!-- footer links, copyright -->
  </footer>

</body>
</html>
```
