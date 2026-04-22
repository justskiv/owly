import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "@fontsource-variable/outfit";
import "@fontsource-variable/jetbrains-mono";
import App from "./App";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

queueMicrotask(() => {
  void getCurrentWindow().show();
});
window.setTimeout(() => {
  void getCurrentWindow().show();
}, 3000);
