import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import { installMotion } from "./lib/motion";
import Root from "./Root";

installMotion();

// A "data router" (instead of <BrowserRouter>) so pages can ask before you leave with unsaved changes.
// All the actual routes are still declared in App.tsx.
const router = createBrowserRouter([{ path: "*", element: <Root /> }]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
