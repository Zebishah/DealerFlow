import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import MonthlyIndividualAnalytics from "./MonthlyIndividualAnalytics";
import MonthlyWholeSaleAnalytics from "./MonthlyWholeSaleAnalytics";
import { db } from "../../../config/firebaseConfig";

const SalesAnalyticsMain = () => {
  const [activeTab, setActiveTab] = useState("individual");
  const [allSales, setAllSales] = useState();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSales = async () => {
      try {
        setLoading(true);
        const salesCollection = collection(db, "sales");
        const querySnapshot = await getDocs(salesCollection);

        const sales = [];

        querySnapshot.forEach((doc) => {
          const docData = doc.data();
          const nestedSales = docData.sales;

          if (nestedSales && typeof nestedSales === "object") {
            Object.keys(nestedSales).forEach((key) => {
              const saleData = nestedSales[key];

              const isMatchingType =
                saleData?.saleType === activeTab ||
                (activeTab === "individual" &&
                  saleData?.saleType === undefined);

              if (isMatchingType) {
                sales.push({
                  userId: doc.id, // Add salesperson's document ID
                  ...saleData,
                });
              }
            });
          }
        });

        setAllSales(sales);
      } catch (err) {
        console.error("Error fetching sales data:", err);
        setError("Failed to load sales data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchSales();
  }, [activeTab]);

  return (
    <div className="flex flex-col h-full w-full bg-white px-5 py-5">
      <h1 className="text-2xl font-bold mb-6">Sales Analytics Dashboard</h1>

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
            />
          ) : (
            <MonthlyWholeSaleAnalytics
              allSales={allSales}
              setAllSales={setAllSales}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default SalesAnalyticsMain;
