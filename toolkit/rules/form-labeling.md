# Form Labeling

## When this applies

Labeling rules apply to every form control: `<input>`, `<select>`,
`<textarea>`, and custom controls with `role="combobox"`, `role="spinbutton"`,
`role="slider"`, `role="switch"`, etc.

Special attention is required for:

- Inputs without visible labels (search bars, filter chips, inline edit)
- Multi-input groups (date pickers, address blocks, phone number split fields)
- Radio groups and checkbox groups
- Error messages and validation feedback
- Required fields

## Required behavior

1. **Every input must have an accessible name.** The accessible name computation
   order (screen readers use the first one found):
   - `aria-labelledby` (references another element's text by ID)
   - `aria-label` (inline string)
   - Associated `<label>` element (via `for`/`id` or wrapping)
   - `title` attribute (last resort; shows a tooltip on hover but is less
     reliable across screen readers)
   - Placeholder (NOT a valid label — placeholder disappears on input)

2. **Prefer explicit `<label>` elements.** Programmatic association via
   `for`/`id` is the most widely supported pattern:
   ```html
   <label for="email">Email address</label>
   <input id="email" type="email" name="email" autocomplete="email" />
   ```

3. **Group related fields with `<fieldset>` + `<legend>`.** Radio groups,
   checkbox groups, and multi-field blocks (date: day/month/year) require a
   group label in addition to individual field labels:
   ```html
   <fieldset>
     <legend>Delivery address</legend>
     <label for="street">Street</label>
     <input id="street" type="text" name="street" autocomplete="street-address" />
     <!-- … more fields -->
   </fieldset>
   ```

4. **Required fields:** use the `required` attribute. Optionally add
   `aria-required="true"` for maximum compatibility. Mark required fields
   visually (e.g. asterisk) AND provide a legend explaining the marker
   ("* required fields") at the top of the form.

5. **Error handling:**
   - Set `aria-invalid="true"` on the field when it fails validation
   - Add an error message element and associate it with the field via
     `aria-describedby`
   - Place the error message inline, near the field (not only in a summary
     at the top)
   - Remove `aria-invalid` and disconnect `aria-describedby` when the
     error is resolved

6. **Placeholder is supplementary only.** It disappears when the user
   types, which removes any context for short-term memory challenges.
   Never rely on placeholder alone as the label.

7. **Avoid `aria-label` for visible-label inputs.** When a visible label
   text exists, the accessible name must contain (or match) the visible label
   (WCAG 2.5.3 Label in Name). Using `aria-label` that contradicts the
   visible text confuses screen reader users.

## Common mistakes

**Mistake 1: Placeholder-only inputs**
`<input placeholder="Email address">` with no `<label>` fails WCAG 3.3.2
(Labels or Instructions). Add a visible `<label>` above the input.

**Mistake 2: Unlabeled icon buttons**
`<button><svg>...</svg></button>` has no accessible name. Add `aria-label`:
`<button aria-label="Close dialog"><svg aria-hidden="true">...</svg></button>`.
[WCAG 4.1.2 Name, Role, Value]

**Mistake 3: Error message without `aria-describedby`**
Adding a visible error message below an input but not connecting it with
`aria-describedby` means screen readers announce the error only if the user
navigates to it explicitly — not automatically on validation failure.
[WCAG 3.3.1 Error Identification]

## Code shape

Accessible input with error state:

```jsx
function EmailField({ error }) {
  const inputId = React.useId();
  const errorId = React.useId();

  return (
    <div>
      <label htmlFor={inputId}>
        Email address <span aria-hidden="true">*</span>
      </label>

      <input
        id={inputId}
        type="email"
        name="email"
        autoComplete="email"
        required
        aria-required="true"
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : undefined}
      />

      {error && (
        <p id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
```

Key points:
- `aria-invalid` is absent (not `"false"`) when there is no error
- `aria-describedby` is only set when an error message exists
- `role="alert"` on the error paragraph ensures it is announced immediately
  when it appears (no need for a separate live region here)
- `aria-hidden="true"` on the asterisk prevents the asterisk character
  from being read aloud
