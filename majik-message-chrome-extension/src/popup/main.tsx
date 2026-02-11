import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import ThemeProviderWrapper from "../globals/ThemeProviderWrapper.tsx";
import ReduxProvider from "../redux/ReduxProvider.tsx";
import { MajikMessageWrapper } from "../components/majik-context-wrapper/MajikMessageWrapper.tsx";
import { MajikahProvider } from "../components/majikah-session-wrapper/MajikahSessionWrapper.tsx";

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
