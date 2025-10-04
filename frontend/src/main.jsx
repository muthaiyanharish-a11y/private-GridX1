import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/theme.css"; /* ensure theme variables load first */
import "./index.css";
import "./styles/global.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);