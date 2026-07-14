import { Component } from "@angular/core";

@Component({
  selector: "app-good",
  standalone: true,
  templateUrl: "./good.component.html",
  styles: [
    `
      /* Meets WCAG 2.5.8 Target Size (Minimum): every button, text-like
         input, and nav/skip link is at least 24x24px, so behave:target-size
         and axe's target-size rule both pass cleanly. Component-scoped so
         it never leaks into BadComponent, which shares this app's shell. */
      button,
      input[type="text"],
      input[type="email"],
      nav a,
      .skip-link {
        display: inline-block;
        min-height: 24px;
        padding: 4px 8px;
        box-sizing: border-box;
      }
    `,
  ],
})
export class GoodComponent {
  onAction() {}
}
