import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "../auth/AuthContext";
import { NavigationProvider } from "../router/Navigation";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <NavigationProvider>
        <AuthProvider>{children}</AuthProvider>
        <Toaster position="top-right" toastOptions={{ duration: 4_000 }} />
      </NavigationProvider>
    </QueryClientProvider>
  );
}
