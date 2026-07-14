import { Routes } from "@angular/router";
import { BadComponent } from "./bad.component";
import { GoodComponent } from "./good.component";

export const routes: Routes = [
  { path: "", component: BadComponent },
  { path: "good", component: GoodComponent },
];
