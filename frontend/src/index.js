import React from "react";
import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css"; // Impor di paling atas agar CSS siap sebelum render
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")).render(<App />);