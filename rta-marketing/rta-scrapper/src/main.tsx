// ============================================
// FILE: src/main.tsx
// ============================================

import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MakesModelsProvider } from './contexts/MakesModelsContext';
import { App } from './App';
import './index.css';
import { Toaster } from "react-hot-toast"

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: 1,
        },
    },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <MakesModelsProvider>
                <App />
                <Toaster position="top-right" reverseOrder={false} />
            </MakesModelsProvider>
        </QueryClientProvider>
    </React.StrictMode>
);

