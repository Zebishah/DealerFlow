// ============================================
// FILE: src/hooks/useGlobalSavedCars.ts
// ============================================

import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { SavedCar } from "../types";
import toast from "react-hot-toast"; // <-- import toast

// Helper to remove undefined fields
function cleanData<T extends Record<string, any>>(data: T): T {
  const cleaned: Record<string, any> = {};
  for (const key in data) {
    const value = data[key];
    if (value !== undefined) {
      cleaned[key] = value;
    }
  }
  return cleaned as T;
}

export const useGlobalSavedCars = () => {
  const [savedCars, setSavedCars] = useState<SavedCar[]>([]);

  useEffect(() => {
    const q = query(collection(db, "saved_cars"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cars: SavedCar[] = [];
      snapshot.forEach((doc) => {
        cars.push({ ...doc.data(), firestoreId: doc.id } as SavedCar);
      });
      setSavedCars(cars.sort((a, b) => b.savedAt - a.savedAt));
    });
    return unsubscribe;
  }, []);

  // Save a car globally
  const saveCar = async (car: Record<string, any>) => {
    try {
      // Clean undefined fields before saving
      const cleanedCar = cleanData(car);

      await addDoc(collection(db, "saved_cars"), cleanedCar);

      toast.success("Car saved successfully!"); // <-- success toast
    } catch (error: any) {
      console.error("Error saving car:", error);
      toast.error(`Error saving car: ${error.message || error}`); // <-- error toast
    }
  };

  const removeCar = async (firestoreId: string) => {
    try {
      await deleteDoc(doc(db, "saved_cars", firestoreId));
      toast.success("Car removed successfully!"); // optional toast
    } catch (error: any) {
      console.error("Error removing car:", error);
      toast.error(`Error removing car: ${error.message || error}`); // optional toast
    }
  };

  const isSaved = (carId: string) => savedCars.some((c) => c.id === carId);

  return { savedCars, saveCar, removeCar, isSaved };
};
