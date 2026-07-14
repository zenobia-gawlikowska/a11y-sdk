import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import GoodApp from "./GoodApp";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <GoodApp />
  </StrictMode>
);
