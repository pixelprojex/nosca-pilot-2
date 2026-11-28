import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { startNative } from "./lib/native";

/* inside the App Store / Google Play shell only: the launch screen, the bars,
   Android's back and a tapped notification (lib/native.js); a no-op anywhere else */
startNative();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
