# Live Region

## When this applies

Live regions announce dynamic content updates to screen readers without
moving keyboard focus. Use them whenever content on the page changes in
response to user action or asynchronous events and that change is meaningful
to the user:

- Form submission success / error messages
- Cart update counts
- Search result count after filtering
- Progress and loading state updates
- Toast / snackbar notifications
- Real-time data feeds (scores, prices, availability)

Do NOT use live regions for:

- Content that is always visible and never changes
- Navigation — use focus management instead (e.g. move focus to page heading
  after a route change in an SPA)
- Changes that are visible from context and require no extra announcement

## Required behavior

1. **The live region container must exist in the DOM before content is
   injected.** Render an empty `<div role="status">` or `<div aria-live="polite">`
   at page load. Inject or update text inside it dynamically. Adding the
   element and content in the same tick will not announce reliably.

2. **Polite vs assertive:**
   - `aria-live="polite"` / `role="status"` — waits for the user to finish
     speaking before announcing. Use for non-critical updates.
   - `aria-live="assertive"` / `role="alert"` — interrupts the current
     announcement immediately. Use only for errors, warnings, and urgent
     failures. Overuse causes announcement fatigue.

3. **Do not nest live regions inside other live regions.** Each live region
   is independent; nesting produces unpredictable behavior.

4. **Clear the region before re-populating.** If you inject the same message
   twice, some screen readers do not re-announce identical content. Set the
   text to an empty string between updates:
   ```js
   region.textContent = '';
   // Allow a microtask for the DOM to settle
   requestAnimationFrame(() => { region.textContent = newMessage; });
   ```

5. **Keep the announcement text concise.** Screen readers read the full
   text of the live region on every change. Long paragraphs disrupt the
   user's current reading position.

6. **`aria-atomic="true"` on the container** causes the entire region to be
   re-read on any change (not just the changed portion). Use it when partial
   updates are confusing — e.g. a status message that replaces its entire
   content on each update.

## Common mistakes

**Mistake 1: Using `role="alert"` for success messages**
`role="alert"` implies `aria-live="assertive"`, which interrupts the screen
reader mid-sentence. Success messages ("Saved!") are not urgent — use
`role="status"` (polite). Reserve `role="alert"` for errors and warnings.
[WCAG 4.1.3 Status Messages]

**Mistake 2: Injecting a live region element dynamically**
Creating `<div role="alert">Error!</div>` and appending it to the DOM will
not reliably announce in all screen reader / browser combinations. The
container must be in the DOM before the text changes. [WCAG 4.1.3]

**Mistake 3: Multiple alerts firing within a second**
If multiple `role="alert"` regions update in rapid succession (e.g. form
validation runs on every keystroke), announcements cut each other off. Debounce
the updates or batch them into a single announcement. [WCAG 4.1.3]

## Code shape

Minimal accessible live region (framework-agnostic HTML pattern):

```html
<!-- In your page template (always present in DOM): -->
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
  id="live-announcer"
  class="sr-only"
></div>
```

```js
// Utility to announce a message:
function announce(message, { assertive = false } = {}) {
  const region = document.getElementById('live-announcer');
  if (!region) return;

  region.setAttribute('aria-live', assertive ? 'assertive' : 'polite');
  // Clear first to re-trigger announcement for repeated messages
  region.textContent = '';
  requestAnimationFrame(() => {
    region.textContent = message;
  });
}

// Usage:
announce('Form saved successfully.');
announce('Error: email is required.', { assertive: true });
```

```css
/* Screen-reader-only utility class (visually hidden but accessible): */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```
