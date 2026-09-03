// SalesContext.js
import { createContext, useContext, useEffect, useState } from "react";

import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { useAuth } from "./AuthContext";
import { db } from "./config/firebaseConfig";

const SalesContext = createContext();

export const SalesProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [salesCounts, setSalesCounts] = useState({
    withReportHistory: 0,
    statusCount: 0, // This will be either rejected or pending count based on user type
  });

  useEffect(() => {
    if (!currentUser) return;

    const fetchData = async () => {
      try {
        let unsubscribe;

        if (
          currentUser.userType === "Admin" ||
          currentUser.userType === "Virtual Assistant"
        ) {
          // Admin/VA logic - get all sales
          unsubscribe = onSnapshot(collection(db, "sales"), (querySnapshot) => {
            let withReportHistory = 0;
            let rejectedCount = 0;

            querySnapshot.forEach((doc) => {
              const sales = doc.data().sales || [];

              sales.forEach((sale) => {
                if (sale.reportHistory) {
                  withReportHistory++;

                  if (sale.reportStatus?.status === "rejected") {
                    rejectedCount++;
                  }
                }
              });
            });

            setSalesCounts({
              withReportHistory,
              statusCount: rejectedCount,
            });
          });
        } else {
          // Employee logic - get only their sales
          const docRef = doc(db, "sales", currentUser.uid);
          unsubscribe = onSnapshot(docRef, (docSnap) => {
            let withReportHistory = 0;
            let pendingCount = 0;

            if (docSnap.exists()) {
              const sales = docSnap.data().sales || [];

              sales.forEach((sale) => {
                if (sale.reportHistory) {
                  withReportHistory++;

                  if (sale.reportStatus?.status === "pending") {
                    pendingCount++;
                  }
                }
              });
            }

            setSalesCounts({
              withReportHistory,
              statusCount: pendingCount,
            });
          });
        }

        return () => unsubscribe && unsubscribe();
      } catch (error) {
        console.error("Error in sales context:", error);
      }
    };

    fetchData();
  }, [currentUser]);

  return (
    <SalesContext.Provider value={salesCounts}>
      {children}
    </SalesContext.Provider>
  );
};

export const useSalesCounts = () => useContext(SalesContext);
