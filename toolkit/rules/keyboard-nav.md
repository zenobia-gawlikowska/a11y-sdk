# Keyboard Navigation

## When this applies

Keyboard navigation rules apply to every interactive element on a page, but
specific patterns govern custom widgets that go beyond simple Tab/Enter
interaction:

- **Tab model** (default): standalone interactive elements (buttons, links,
  inputs) — users Tab between them, activate with Enter/Space.
- **Arrow-key model (roving tabindex)**: composite widgets where internal
  navigation uses arrow keys — tab stops to the widget as a single unit,
  arrow keys move within it. Examples: menu bars, toolbars, radio groups,
  tab panels, tree views, grids, sliders.

## Required behavior

### For all interactive elements

1. Every interactive element must be reachable via Tab. This includes buttons,
   links, form fields, custom controls with `role` attributes, and any element
   with `onclick`/`onkeydown` that performs an action.

2. `tabindex="0"` adds a native element to the Tab order. `tabindex="-1"` removes
   it from Tab but keeps it programmatically focusable (for focus management).
   `tabindex > 0` creates a separate Tab order independent of DOM order — never
   use it; reorder the DOM instead.

3. `Enter` must activate links and buttons. `Space` must activate buttons and
   checkboxes. Custom elements with `role="button"` must handle both.

4. Visible focus indicator must be present on every focused element
   (see `context.md` 2.4.7 and 2.4.11).

### For composite widgets (roving tabindex pattern)

5. The widget container has `tabindex="0"` initially (or on the selected/active
   item). All other items have `tabindex="-1"`.

6. Arrow keys move focus within the widget by calling `.focus()` on the target
   item and updating `tabindex` values:
   - Set the previously focused item to `tabindex="-1"`
   - Set the new item to `tabindex="0"` and call `.focus()`

7. `Home` moves to the first item; `End` moves to the last item.

8. When focus leaves the widget (Tab / Shift+Tab), the last focused item retains
   `tabindex="0"` so the user can Tab back to the same position.

### Menu / listbox keyboard contracts

| Role | Open | Navigate | Select | Close |
|---|---|---|---|---|
| `menu` / `menuitem` | Enter/Space/↓ on trigger | ↑↓ (and →← for nested) | Enter | Escape, Tab |
| `listbox` / `option` | — | ↑↓ | Enter/Space | Escape |
| `tablist` / `tab` | — | ←→ (horizontal) ↑↓ (vertical) | (auto-activate or Enter) | — |
| `tree` / `treeitem` | — | ↑↓, →← to expand/collapse | Enter | — |
| `grid` / `gridcell` | — | ↑↓←→ | Enter | Escape |

**Important:** Only use `role="menu"` if you implement the full menu keyboard
contract above. `role="menu"` is for application menus, NOT for navigation
dropdowns. Navigation dropdowns should be a `<ul>` list with disclosure
buttons — see `rules/landmark-usage.md`.

## Common mistakes

**Mistake 1: Click-only interactions without keyboard equivalent**
`<div onClick={handleSelect}>` is mouse-only. Screen reader users and keyboard
users cannot activate it. Add `tabindex="0"` and handle `keydown` for Enter
and Space, OR replace with a `<button>`. [WCAG 2.1.1 Keyboard]

**Mistake 2: Using `role="menu"` for site navigation**
Navigation dropdowns are not application menus. Using `role="menu"` requires
implementing the full arrow-key navigation contract. Most navigation dropdowns
should use a `<ul>` + `<button aria-expanded>` disclosure pattern instead.
[WCAG 4.1.2 Name, Role, Value]

**Mistake 3: Not handling Escape on overlays**
Any component that opens in response to a trigger (dropdown, tooltip, dialog,
autocomplete) must close when Escape is pressed and return focus to the trigger.
[WCAG 2.1.2 No Keyboard Trap]

## Code shape

Roving tabindex for a horizontal tab list:

```jsx
function TabList({ tabs }) {
  const [activeIndex, setActiveIndex] = React.useState(0);

  function handleKeyDown(event, index) {
    const count = tabs.length;
    let next = index;

    if (event.key === 'ArrowRight') next = (index + 1) % count;
    else if (event.key === 'ArrowLeft') next = (index - 1 + count) % count;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = count - 1;
    else return;

    event.preventDefault();
    setActiveIndex(next);
    // Move DOM focus to the new tab
    tabRefs.current[next]?.focus();
  }

  const tabRefs = React.useRef([]);

  return (
    <div role="tablist" aria-label="Content sections">
      {tabs.map((tab, i) => (
        <button
          key={tab.id}
          role="tab"
          id={`tab-${tab.id}`}
          aria-selected={i === activeIndex}
          aria-controls={`panel-${tab.id}`}
          tabIndex={i === activeIndex ? 0 : -1}
          ref={(el) => { tabRefs.current[i] = el; }}
          onClick={() => setActiveIndex(i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
```
