import { useMutation } from "@tanstack/react-query";
import type { ApiResponse } from "@/types";

type Filters = Record<string, any>;

// Utility to clean empty values
const cleanObject = (obj: Filters): Filters => {
  return Object.fromEntries(
    Object.entries(obj).filter(
      ([, value]) =>
        value !== "" &&
        value !== null &&
        value !== undefined &&
        !(Array.isArray(value) && value.length === 0)
    )
  );
};

// Read backend URL from env
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const fetchScrape = async (filters: Filters): Promise<ApiResponse> => {
  if (!BACKEND_URL) throw new Error("VITE_BACKEND_URL is not defined");

  const res = await fetch(`${BACKEND_URL}/api/scrape/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(filters),
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(`Scrape failed: ${message || res.statusText}`);
  }

  return res.json();
};

export const useScrape = () => {
  const mutation = useMutation({
    mutationFn: (filters: Filters) => fetchScrape(cleanObject(filters)),
    retry: false, // Don't auto-retry on errors
  });

  return {
    mutate: mutation.mutate,
    data: mutation.data,
    isPending: mutation.isPending,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset, // Clear data/error state if needed
  };
};
