import { createContext, useContext, useState, useEffect } from "react";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "./config/firebaseConfig";

const SalesDataContext = createContext();

export const SalesDataProvider = ({ children }) => {
  const [salesData, setSalesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return today.toISOString().slice(0, 7); // Format: YYYY-MM
  });

  // console.log("context sales data", salesData);
  const fetchMonthlySalesData = async (month) => {
    setLoading(true);
    try {
      const selectedDate = new Date(`${month}-01`);
      const midMonth = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        15
      );

      // Fetch Monthly Targets
      const targetDocRef = collection(db, "monthlyTargets");
      const monthDocSnapshot = await getDocs(targetDocRef);
      const monthDoc = monthDocSnapshot.docs.find((doc) => doc.id === month);

      if (!monthDoc) {
        console.warn(`No monthly targets found for ${month}`);
        setSalesData([]);
        setLoading(false);
        return;
      }

      const targetData = monthDoc.data();
      const salesDataArray = [];

      // Fetch Sales Data for Each Employee
      for (const [userId, target] of Object.entries(targetData)) {
        const salesDocRef = doc(db, "sales", userId);
        const salesDocSnap = await getDoc(salesDocRef);

        if (!salesDocSnap.exists()) {
          salesDataArray.push({
            userId,
            target: target?.target || 0,
            grossTarget: target?.grossTarget || 0,
            name: target?.name,
            salesCompleted: 0,
            pending: target?.target || 0,
            midMonth: 0,
          });
          continue;
        }

        const salesData = salesDocSnap.data().sales || [];
        const salesThisMonth = salesData.filter((sale) => {
          if (!sale.intermediateDate) return false;
          const saleDate = new Date(Date.parse(sale.intermediateDate));
          return (
            saleDate.getFullYear() === selectedDate.getFullYear() &&
            saleDate.getMonth() === selectedDate.getMonth()
          );
        });

        const totalSalesCount = salesThisMonth.length || 0;
        const midMonthSalesCount = salesThisMonth.filter(
          (sale) => new Date(Date.parse(sale.intermediateDate)) <= midMonth
        ).length;

        salesDataArray.push({
          userId,
          target: target.target || 0,
          grossTarget: target?.grossTarget || 0,

          name: target.name,
          salesCompleted: totalSalesCount,
          pending: (target.target || 0) - totalSalesCount,
          midMonth: midMonthSalesCount,
        });
      }

      setSalesData(salesDataArray);
    } catch (error) {
      console.error("Error fetching sales data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthlySalesData(selectedMonth);
  }, [selectedMonth, refetching]);

  const fetchData = () => {
    // console.log("called");
    setRefetching(!refetching);
  };
  return (
    <SalesDataContext.Provider
      value={{ salesData, loading, selectedMonth, setSelectedMonth, fetchData }}
    >
      {children}
    </SalesDataContext.Provider>
  );
};

export const useSalesData = () => useContext(SalesDataContext);
