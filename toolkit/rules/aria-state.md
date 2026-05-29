# ARIA State

## When this applies

Use ARIA state attributes whenever a custom interactive widget has a condition
that changes in response to user interaction and must be communicated to
assistive technology. Common cases:

- Disclosure buttons that show/hide content (`aria-expanded`)
- Toggle buttons — bold, mute, favorite (`aria-pressed`)
- Checkboxes and tree items (`aria-checked`)
- Tabs, option lists, listboxes (`aria-selected`)
- Combobox / autocomplete inputs (`aria-activedescendant`)
- Any element that can be disabled beyond native form fields (`aria-disabled`)

## Required behavior

1. **Initial state must be set.** An element with `aria-expanded` must have
   the attribute present at page load — either `"true"` or `"false"`. A
   missing attribute is different from `"false"` in some screen readers.

2. **State must update synchronously.** Update the ARIA attribute in the same
   event handler that triggers the visual change — never delay with
   `setTimeout`. Screen readers read the attribute value at the moment of the
   event, not after a tick.

3. **`aria-hidden` removes from accessibility tree entirely.** Set
   `aria-hidden="true"` on decorative elements, icon fonts, or visually
   duplicated content. Never set it on a container that holds focusable
   elements — those elements become unreachable from the keyboard but still
   receive Tab focus, which is a keyboard trap.

4. **`aria-disabled` vs `disabled`.** The native `disabled` attribute removes
   an element from the Tab order. `aria-disabled="true"` keeps the element
   focusable but announces it as disabled — use this when you want keyboard
   users to discover the disabled state without hunting for what the button
   does. Pair `aria-disabled` with a visual style and prevent the click action.

5. **`aria-live` regions must exist before content changes.** The container
   with `aria-live` must be present in the DOM when the page loads. Injecting
   `aria-live` and content simultaneously may not announce in some screen
   readers. See `rules/live-region.md`.

6. **`aria-describedby` for supplementary information.** The accessible name
   describes what something is. `aria-describedby` adds longer supplementary
   context (error messages, hints, help text). Both can coexist on the same
   element.

## Common mistakes

**Mistake 1: Toggling `aria-expanded` only on the button, not reflecting panel state**
Some implementations toggle `aria-expanded` on the trigger but forget to hide
the panel from the accessibility tree when closed (`hidden` attribute or
`display: none`). Screen readers will still read collapsed content.
[WCAG 4.1.2 Name, Role, Value]

**Mistake 2: Using `role="button"` without keyboard support**
Adding `role="button"` to a `<div>` declares it as a button to screen readers
but does NOT add keyboard behavior. You must also add `tabindex="0"` and
handle `Enter` and `Space` keydown events. Prefer native `<button>` instead.
[WCAG 2.1.1 Keyboard]

**Mistake 3: Setting `aria-hidden` on a focused element**
Never call `element.setAttribute('aria-hidden', 'true')` on an element that
currently has focus, or on a container of the currently focused element. This
creates an inconsistency — keyboard focus is inside an "invisible" region.
Move focus first, then hide. [WCAG 1.3.1 Info and Relationships]

## Code shape

Correct disclosure button implementation:

```jsx
function Disclosure({ title, children }) {
  const [open, setOpen] = React.useState(false);
  const panelId = React.useId();

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((prev) => !prev)}
      >
        {title}
      </button>

      <div id={panelId} hidden={!open}>
        {children}
      </div>
    </>
  );
}
```

Key points:
- `aria-expanded` starts as `false` (the initial state)
- `aria-controls` links the button to its panel
- `hidden` attribute (not CSS `display:none`) removes the panel from both the
  visual and accessibility tree when closed
