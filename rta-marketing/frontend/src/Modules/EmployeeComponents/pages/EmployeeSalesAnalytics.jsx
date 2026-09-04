import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../config/firebaseConfig";
import { useAuth } from "../../../AuthContext";
import MonthlyIndividualAnalytics from "../../AdminComponents/pages/MonthlyIndividualAnalytics";
import MonthlyWholeSaleAnalytics from "../../AdminComponents/pages/MonthlyWholeSaleAnalytics";

const EmployeeSalesAnalytics = () => {
  const [activeTab, setActiveTab] = useState("individual");
  const [allSales, setAllSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { currentUser } = useAuth();

  useEffect(() => {
    const fetchEmployeeSales = async () => {
      if (!currentUser?.uid) return;

      try {
        setLoading(true);
        const docRef = doc(db, "sales", currentUser?.uid);

        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const salesData = docSnap.data().sales;
          // Filter sales based on activeTab
          const filteredSales = salesData.filter((sale) =>
            activeTab === "individual"
              ? !sale.saleType || sale.saleType === "individual"
              : sale.saleType === "wholesale"
          );

          setAllSales(filteredSales);
        } else {
          setAllSales([]);
        }
      } catch (err) {
        console.error("Error fetching sales data:", err);
        setError("Failed to load sales data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchEmployeeSales();
  }, [currentUser?.uid, activeTab]);

  return (
    <div className="flex flex-col h-full w-full bg-white px-5 py-5">
      <h1 className="text-2xl font-bold mb-6">My Sales Analytics</h1>

      {/* Tabs */}
      <div className="flex border-b mb-6">
        <button
          className={`px-4 py-2 mr-2 ${
            activeTab === "individual"
              ? "font-bold border-b-2 border-blue-500"
              : "text-gray-500"
          }`}
          onClick={() => setActiveTab("individual")}
        >
          Individual Sales
        </button>
        <button
          className={`px-4 py-2 ${
            activeTab === "wholesale"
              ? "font-bold border-b-2 border-blue-500"
              : "text-gray-500"
          }`}
          onClick={() => setActiveTab("wholesale")}
        >
          Wholesale Sales
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      ) : (
        <div>
          {activeTab === "individual" ? (
            <MonthlyIndividualAnalytics
              allSales={allSales}
              setAllSales={setAllSales}
              isEmployee={true}
            />
          ) : (
            <MonthlyWholeSaleAnalytics
              allSales={allSales}
              setAllSales={setAllSales}
              isEmployee={true}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default EmployeeSalesAnalytics;
