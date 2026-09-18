import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./App";
import "./styles.css";

const rootElement = /* safe */ document.getElementById("root");
if (!rootElement) throw new Error("Missing #root element");

ReactDOM.createRoot(/* safe */ rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
