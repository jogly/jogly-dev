import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Cotswolds } from "./pages/Cotswolds";

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<Cotswolds />
	</StrictMode>,
);
