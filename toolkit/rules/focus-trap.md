# Focus Trap

## When this applies

Focus trapping is required for any component that overlays the rest of the
page and must capture keyboard focus until explicitly dismissed:

- Modal dialogs (`role="dialog"`)
- Drawers / side panels that block interaction with the page
- Lightboxes
- Confirmation dialogs
- Cookie consent overlays

Focus trapping is **NOT appropriate** for:

- Dropdown menus (use the popup/listbox pattern instead)
- Inline expansion panels
- Tooltips
- Any component that does not cover the rest of the page

## Required behavior

1. When the component opens, focus MUST move inside it immediately — to the
   first focusable element, or to the dialog container itself (`tabIndex={-1}`)
   if no focusable descendant exists.

2. `Tab` must cycle forward through all focusable elements inside the trap.
   After the last focusable element, Tab moves focus back to the first.

3. `Shift+Tab` must cycle backward. After the first focusable element,
   Shift+Tab moves focus to the last.

4. Focus must NOT escape to elements behind the overlay. Any element outside
   the trap that receives Tab focus is a bug.

5. When the component closes, focus MUST return to the element that triggered
   it (the "trigger element"). Store a reference to `document.activeElement`
   before opening, and call `.focus()` on it when closing.

6. `Escape` must close the component and trigger the focus-return behavior.

## Common mistakes

**Mistake 1: Using `tabindex="0"` on the overlay backdrop**
The backdrop is not interactive — giving it a tabindex makes it focusable and
breaks Tab cycling. Keep the backdrop non-focusable (`tabindex="-1"` or no
`tabindex`). [WCAG 2.1.2 No Keyboard Trap]

**Mistake 2: Forgetting to return focus on close**
When the user closes the dialog with Escape or a close button, focus falls to
`<body>` or jumps unpredictably. This loses the user's place in the document.
Always restore focus to the trigger element. [WCAG 2.4.3 Focus Order]

**Mistake 3: Querying focusable elements once at mount time**
If the dialog content changes (e.g. a multi-step wizard), the focusable elements
list changes. Re-query on every Tab keypress, not at mount time.

## Code shape

Minimal focus-trap loop in plain JavaScript (framework-agnostic):

```jsx
function trapFocus(dialogElement) {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  dialogElement.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;

    const focusable = Array.from(
      dialogElement.querySelectorAll(focusableSelectors)
    ).filter((el) => !el.closest('[hidden]'));

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey) {
      // Shift+Tab: wrap backward
      if (document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
    } else {
      // Tab: wrap forward
      if (document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  });
}

// Usage:
// const trigger = document.activeElement; // save before opening
// openDialog();
// trapFocus(dialogElement);
// dialogElement.querySelector('[autofocus], button, [tabindex]')?.focus();
//
// On close:
// trigger.focus(); // restore
```
