// ============================================
// FILE: src/types/index.ts
// ============================================

export interface NormalizedCar {
  id: string;
  source: string;
  title: string;
  price: string;
  image: string;
  link: string;
  year?: string;
  odometer?: string;
  location?: string;
  dealer?: string;
  isUsed: boolean;
}

export interface SavedCar extends NormalizedCar {
  firestoreId?: string;
  savedAt: number;
}

export interface FilterConfig {
  key: string;
  label: string;
  type: "select" | "text" | "number";
  options?: any;
  placeholder?: string;
  dependsOn?: string;
  required?: boolean;
  default?: any;
  min?: number;
  max?: number;
}

export interface ApiResponse {
  success: boolean;
  results: {
    [source: string]: {
      cars: any[];
      total: number;
      serverError?: string | null;
    };
  };
  urls?: Record<string, string>;
  filters?: {
    radius?: number;
    make?: string;
    model?: string;
    postal?: string;
  };
  duration?: string | number;
  totalCars?: number;
  summary?: {
    site: string;
    cars: number;
    error: string | null;
  }[];
}

export type MakesModelsData = Record<string, string[]>;
