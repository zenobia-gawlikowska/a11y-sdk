import { Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";

// Router shell — bad/good content lives in bad.component.ts / good.component.ts,
// selected by app.routes.ts. See bad.component.html for the intentional
// a11y violations and good.component.html for the corrected version.
@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet></router-outlet>`,
})
export class AppComponent {}
