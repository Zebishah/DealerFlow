import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { App } from "./App";
import { AuthProvider } from "./auth/AuthContext";
import "./styles.css";
import "./workflow.css";
import { NavigationProvider } from "./router/Navigation";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <NavigationProvider>
        <AuthProvider><App /></AuthProvider>
        <Toaster position="top-right" toastOptions={{ duration: 4_000 }} />
      </NavigationProvider>
    </QueryClientProvider>
  </StrictMode>,
);
