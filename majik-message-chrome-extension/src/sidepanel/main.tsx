import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import App from "./App";
import ThemeProviderWrapper from "../globals/ThemeProviderWrapper";
import ReduxProvider from "../redux/ReduxProvider";
import { MajikahProvider } from "../components/majikah-session-wrapper/MajikahSessionWrapper";
import { MajikMessageWrapper } from "../components/majik-context-wrapper/MajikMessageWrapper";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ReduxProvider>
      <ThemeProviderWrapper>
        <MajikahProvider>
          <MajikMessageWrapper>
            <App />
          </MajikMessageWrapper>
        </MajikahProvider>
      </ThemeProviderWrapper>
    </ReduxProvider>
  </StrictMode>,
);
