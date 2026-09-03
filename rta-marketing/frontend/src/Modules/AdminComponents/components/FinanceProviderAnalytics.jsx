import { collection, getDocs } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../../../config/firebaseConfig";

const MonthlyFinanceProviderAnalytics = ({
  selectedMonth,
  selectedYear,
  startDate,
  endDate,
}) => {
  const [financeProviderData, setFinanceProviderData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [allSalesData, setAllSalesData] = useState([]);
  const [financeProviders, setFinanceProviders] = useState([]);
  const [selectedFinanceProvider, setSelectedFinanceProvider] = useState("all");

  // Format dates for display
  const formatDisplayDate = (date) => {
    return date.toLocaleDateString("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  useEffect(() => {
    const fetchSalesData = async () => {
      try {
        setIsLoading(true);

        // Fetch all sales documents
        const salesSnapshot = await getDocs(collection(db, "sales"));

        // Store all sales data with dates
        const allSales = [];
        const uniqueFinanceProviders = new Set();

        // Process all sales records
        salesSnapshot.forEach((salesDoc) => {
          const salesData = salesDoc.data();
          const salesDocId = salesDoc.id;

          if (salesData.sales && Array.isArray(salesData.sales)) {
            salesData.sales.forEach((sale) => {
              // Extract date from sale
              let saleDate = null;
              if (sale.saleDate) {
                const dateParts = sale.saleDate.split(" ");
                if (dateParts.length >= 3) {
                  const day = parseInt(dateParts[0]);
                  const month = [
                    "january",
                    "february",
                    "march",
                    "april",
                    "may",
                    "june",
                    "july",
                    "august",
                    "september",
                    "october",
                    "november",
                    "december",
                  ].indexOf(dateParts[1].toLowerCase());
                  const year = parseInt(dateParts[2]);
                  if (!isNaN(day) && month !== -1 && !isNaN(year)) {
                    saleDate = new Date(year, month, day);
                  }
                }
              }

              // Get finance provider
              const financeProvider = sale.financeProvider || "Unknown";
              if (financeProvider !== "Unknown") {
                uniqueFinanceProviders.add(financeProvider);
              }

              // Add all sales with date information - including those without finance providers
              allSales.push({
                sale,
                saleDate,
                salespersonId: salesDocId,
                financeProvider,
              });
            });
          }
        });

        setAllSalesData(allSales);
        setFinanceProviders(Array.from(uniqueFinanceProviders).sort());

        // Initial processing with default filters
        processSalesData(allSales, selectedFinanceProvider);
      } catch (err) {
        console.error("Error fetching sales data:", err);
        setError("Failed to load sales data");
        setIsLoading(false);
      }
    };

    fetchSalesData();
  }, []);

  // Process data when filters change
  useEffect(() => {
    if (allSalesData.length > 0) {
      processSalesData(allSalesData, selectedFinanceProvider);
    }
  }, [selectedMonth, selectedYear, selectedFinanceProvider, allSalesData]);

  const processSalesData = (salesData, financeProviderFilter) => {
    try {
      setIsLoading(true);

      // Filter sales data by selected month and year
      let filteredSales = salesData.filter((item) => {
        if (!item.saleDate) return false;

        return (
          item.saleDate.getMonth() === selectedMonth &&
          item.saleDate.getFullYear() === selectedYear
        );
      });

      // Apply finance provider filter if not "all", but track unknown providers separately
      let unknownProviderSales = [];
      let selectedProviderSales = [];

      if (financeProviderFilter !== "all") {
        // If specific provider is selected, get only those sales
        selectedProviderSales = filteredSales.filter(
          (item) => item.financeProvider === financeProviderFilter
        );
        // Always keep track of unknown provider sales
        unknownProviderSales = filteredSales.filter(
          (item) => item.financeProvider === "Unknown"
        );
        // Use selected provider sales for main processing
        filteredSales = selectedProviderSales;
      } else {
        // When "all" is selected, separate the unknown sales
        unknownProviderSales = filteredSales.filter(
          (item) => item.financeProvider === "Unknown"
        );
        selectedProviderSales = filteredSales.filter(
          (item) => item.financeProvider !== "Unknown"
        );
        // Process known providers for the main table
        filteredSales = selectedProviderSales;
      }

      const financeProviderMap = new Map();

      // Process filtered sales
      filteredSales.forEach(({ sale, financeProvider }) => {
        if (!financeProviderMap.has(financeProvider)) {
          financeProviderMap.set(financeProvider, {
            name: financeProvider,
            leadCost: 0,
            dealsBooked: 0,
            daysToDelivery: [],
            daysToFunding: [],
            amountFunded: 0,
            gross: 0,
            salesGross: 0,
            commission: 0,
            trueGross: 0,
          });
        }

        const provider = financeProviderMap.get(financeProvider);

        provider.dealsBooked += 1;

        if (sale.referralCost) {
          provider.leadCost += parseFloat(sale.referralCost) || 0;
        }

        if (sale.daysToDelivery) {
          provider.daysToDelivery.push(parseInt(sale.daysToDelivery) || 0);
        }

        if (sale.daysToFunding) {
          provider.daysToFunding.push(parseInt(sale.daysToFunding) || 0);
        }

        provider.amountFunded += parseFloat(sale.amountFunded || 0);
        provider.gross += parseFloat(sale.gross || 0);
        provider.salesGross += parseFloat(sale.salesGross || 0);
        provider.commission += parseFloat(sale.commission || 0);
        provider.trueGross += parseFloat(sale.trueGross || 0);
      });

      // Create a data structure for unknown finance provider sales
      const unknownProviderData = {
        name: "No Lender",
        leadCost: 0,
        dealsBooked: 0,
        daysToDelivery: [],
        daysToFunding: [],
        amountFunded: 0,
        gross: 0,
        salesGross: 0,
        commission: 0,
        trueGross: 0,
      };

      // Process the unknown finance provider sales
      unknownProviderSales.forEach(({ sale }) => {
        unknownProviderData.dealsBooked += 1;

        if (sale.referralCost) {
          unknownProviderData.leadCost += parseFloat(sale.referralCost) || 0;
        }

        if (sale.daysToDelivery) {
          unknownProviderData.daysToDelivery.push(
            parseInt(sale.daysToDelivery) || 0
          );
        }

        if (sale.daysToFunding) {
          unknownProviderData.daysToFunding.push(
            parseInt(sale.daysToFunding) || 0
          );
        }

        unknownProviderData.amountFunded += parseFloat(sale.amountFunded || 0);
        unknownProviderData.gross += parseFloat(sale.gross || 0);
        unknownProviderData.salesGross += parseFloat(sale.salesGross || 0);
        unknownProviderData.commission += parseFloat(sale.commission || 0);
        unknownProviderData.trueGross += parseFloat(sale.trueGross || 0);
      });

      const financeProviderArray = Array.from(financeProviderMap.values()).map(
        (provider) => {
          const avgDaysToDelivery =
            provider.daysToDelivery.length > 0
              ? provider.daysToDelivery.reduce((a, b) => a + b, 0) /
                provider.daysToDelivery.length
              : 0;

          const avgDaysToFunding =
            provider.daysToFunding.length > 0
              ? provider.daysToFunding.reduce((a, b) => a + b, 0) /
                provider.daysToFunding.length
              : 0;

          const avgAmountFunded =
            provider.dealsBooked > 0
              ? provider.amountFunded / provider.dealsBooked
              : 0;

          const avgGross =
            provider.dealsBooked > 0
              ? provider.gross / provider.dealsBooked
              : 0;

          const avgSalesGross =
            provider.dealsBooked > 0
              ? provider.salesGross / provider.dealsBooked
              : 0;

          const avgCommission =
            provider.dealsBooked > 0
              ? provider.commission / provider.dealsBooked
              : 0;

          const avgTrueGross =
            provider.dealsBooked > 0
              ? provider.trueGross / provider.dealsBooked
              : 0;

          return {
            name: provider.name,
            leadCost: provider.leadCost,
            dealsBooked: provider.dealsBooked,
            avgDaysToDelivery: parseFloat(avgDaysToDelivery.toFixed(2)),
            avgDaysToFunding: parseFloat(avgDaysToFunding.toFixed(2)),
            totalAmountFunded: provider.amountFunded,
            avgAmountFunded: parseFloat(avgAmountFunded.toFixed(2)),
            totalGross: provider.gross,
            avgGross: parseFloat(avgGross.toFixed(2)),
            totalSalesGross: provider.salesGross,
            avgSalesGross: parseFloat(avgSalesGross.toFixed(2)),
            totalCommission: provider.commission,
            avgCommission: parseFloat(avgCommission.toFixed(2)),
            totalTrueGross: provider.trueGross,
            avgTrueGross: parseFloat(avgTrueGross.toFixed(2)),
          };
        }
      );

      // Process the unknown provider data and add it as a final row if there are any sales without providers
      if (unknownProviderData.dealsBooked > 0) {
        const avgDaysToDelivery =
          unknownProviderData.daysToDelivery.length > 0
            ? unknownProviderData.daysToDelivery.reduce((a, b) => a + b, 0) /
              unknownProviderData.daysToDelivery.length
            : 0;

        const avgDaysToFunding =
          unknownProviderData.daysToFunding.length > 0
            ? unknownProviderData.daysToFunding.reduce((a, b) => a + b, 0) /
              unknownProviderData.daysToFunding.length
            : 0;

        const avgAmountFunded =
          unknownProviderData.dealsBooked > 0
            ? unknownProviderData.amountFunded / unknownProviderData.dealsBooked
            : 0;

        const avgGross =
          unknownProviderData.dealsBooked > 0
            ? unknownProviderData.gross / unknownProviderData.dealsBooked
            : 0;

        const avgSalesGross =
          unknownProviderData.dealsBooked > 0
            ? unknownProviderData.salesGross / unknownProviderData.dealsBooked
            : 0;

        const avgCommission =
          unknownProviderData.dealsBooked > 0
            ? unknownProviderData.commission / unknownProviderData.dealsBooked
            : 0;

        const avgTrueGross =
          unknownProviderData.dealsBooked > 0
            ? unknownProviderData.trueGross / unknownProviderData.dealsBooked
            : 0;

        financeProviderArray.push({
          name: unknownProviderData.name,
          leadCost: unknownProviderData.leadCost,
          dealsBooked: unknownProviderData.dealsBooked,
          avgDaysToDelivery: parseFloat(avgDaysToDelivery.toFixed(2)),
          avgDaysToFunding: parseFloat(avgDaysToFunding.toFixed(2)),
          totalAmountFunded: unknownProviderData.amountFunded,
          avgAmountFunded: parseFloat(avgAmountFunded.toFixed(2)),
          totalGross: unknownProviderData.gross,
          avgGross: parseFloat(avgGross.toFixed(2)),
          totalSalesGross: unknownProviderData.salesGross,
          avgSalesGross: parseFloat(avgSalesGross.toFixed(2)),
          totalCommission: unknownProviderData.commission,
          avgCommission: parseFloat(avgCommission.toFixed(2)),
          totalTrueGross: unknownProviderData.trueGross,
          avgTrueGross: parseFloat(avgTrueGross.toFixed(2)),
        });
      }

      setFinanceProviderData(financeProviderArray);
    } catch (err) {
      console.error("Error processing sales data:", err);
      setError("Failed to process sales data");
    } finally {
      setIsLoading(false);
    }
  };

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  if (isLoading && financeProviderData.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-[300px] w-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#003160]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-500 p-4">
        {error}. Please try again later.
      </div>
    );
  }
  return (
    <div>
      {/* Date and Finance Provider filters */}
      <div className="flex justify-between mb-4">
        <h1 className="text-2xl font-bold ">Lender Summary</h1>
      </div>
      {isLoading && (
        <div className="flex justify-center items-center min-h-[100px] mb-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#003160]"></div>
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="min-w-[1200px] md:min-w-0 min-h-[280px]">
          <table className="w-full table-fixed text-sm text-left text-black rtl:text-right dark:text-black font-radios">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-[#003160] dark:text-white">
              <tr>
                <th
                  scope="col"
                  className="px-2 py-3 sm:px-4 sm:py-4 rounded-tl-md"
                >
                  Finance Provider
                </th>
                <th scope="col" className="px-2 py-3 sm:px-4 sm:py-4">
                  Lead Cost
                </th>
                <th scope="col" className="px-2 py-3 sm:px-4 sm:py-4">
                  Deals Booked
                </th>
                <th scope="col" className="px-2 py-3 sm:px-4 sm:py-4">
                  Avg. Days to Delivery
                </th>
                <th scope="col" className="px-2 py-3 sm:px-4 sm:py-4">
                  Avg. Days to Funding
                </th>
                <th
                  scope="col"
                  className="px-2 py-3 sm:px-4 sm:py-4 text-center border-l border-r border-b border-gray-300"
                  colSpan="2"
                >
                  Amount Funded
                </th>
                <th
                  scope="col"
                  className="px-2 py-3 sm:px-4 sm:py-4 text-center border-r border-b border-gray-300"
                  colSpan="2"
                >
                  Gross
                </th>
                <th
                  scope="col"
                  className="px-2 py-3 sm:px-4 sm:py-4 text-center border-r border-b border-gray-300"
                  colSpan="2"
                >
                  Sales Gross
                </th>
                <th
                  scope="col"
                  className="px-2 py-3 sm:px-4 sm:py-4 text-center border-r border-b border-gray-300"
                  colSpan="2"
                >
                  Commission
                </th>
                <th
                  scope="col"
                  className="px-2 py-3 sm:px-4 sm:py-4 text-center rounded-tr-md border-b border-gray-300"
                  colSpan="2"
                >
                  True Gross
                </th>
              </tr>
              <tr className="dark:bg-[#003160] dark:text-white">
                <th scope="col" className="px-2 py-1 sm:px-4 sm:py-2"></th>
                <th scope="col" className="px-2 py-1 sm:px-4 sm:py-2"></th>
                <th scope="col" className="px-2 py-1 sm:px-4 sm:py-2"></th>
                <th scope="col" className="px-2 py-1 sm:px-4 sm:py-2"></th>
                <th scope="col" className="px-2 py-1 sm:px-4 sm:py-2"></th>
                <th
                  scope="col"
                  className="px-2 py-1 sm:px-4 sm:py-2 text-center border-l bg-blue-[#003160] border-r border-gray-300"
                >
                  Total
                </th>
                <th
                  scope="col"
                  className="px-2 py-1 sm:px-0 sm:py-2 text-center bg-blue-[#003160] border-r border-gray-300"
                >
                  Average
                </th>
                <th
                  scope="col"
                  className="px-2 py-1 sm:px-4 sm:py-2 text-center bg-blue-[#003160] border-r border-gray-300"
                >
                  Total
                </th>
                <th
                  scope="col"
                  className="px-2 py-1 sm:px-0 sm:py-2 text-center bg-blue-[#003160] border-r border-gray-300"
                >
                  Average
                </th>
                <th
                  scope="col"
                  className="px-2 py-1 sm:px-4 sm:py-2 text-center bg-blue-[#003160] border-r border-gray-300"
                >
                  Total
                </th>
                <th
                  scope="col"
                  className="px-2 py-1 sm:px-0 sm:py-2 text-center bg-blue-[#003160] border-r border-gray-300"
                >
                  Average
                </th>
                <th
                  scope="col"
                  className="px-2 py-1 sm:px-4 sm:py-2 text-center bg-blue-[#003160] border-r border-gray-300"
                >
                  Total
                </th>
                <th
                  scope="col"
                  className="px-2 py-1 sm:px-0 sm:py-2 text-center bg-blue-[#003160] border-r border-gray-300"
                >
                  Average
                </th>
                <th
                  scope="col"
                  className="px-2 py-1 sm:px-4 sm:py-2 text-center bg-blue-[#003160] border-r border-gray-300"
                >
                  Total
                </th>
                <th
                  scope="col"
                  className="px-2 py-1 sm:px-0 sm:py-2 text-center bg-blue-[#003160] border-r border-gray-300"
                >
                  Average
                </th>
              </tr>
            </thead>
            <tbody className="border-t-0 border-gray-300 border-1">
              {financeProviderData.length > 0 ? (
                financeProviderData.map((provider, index) => (
                  <tr
                    key={index}
                    className="bg-white border-b dark:bg-white dark:border-gray-300"
                  >
                    <td
                      className="px-2 py-3 sm:px-3 sm:py-4 font-medium text-gray-900 whitespace-nowrap dark:text-black"
                      title={provider.name}
                    >
                      {provider.name.length > 10
                        ? `${provider.name.substring(0, 10)}...`
                        : provider.name}
                    </td>
                    <td className="px-2 py-3 sm:px-4 sm:py-4">
                      {formatCurrency(provider.leadCost)}
                    </td>
                    <td className="px-2 py-3 sm:px-4 sm:py-4">
                      {provider.dealsBooked}
                    </td>
                    <td className="px-2 py-3 sm:px-4 sm:py-4">
                      {provider.avgDaysToDelivery}
                    </td>
                    <td className="px-2 py-3 sm:px-4 sm:py-4">
                      {provider.avgDaysToFunding}
                    </td>
                    <td className="px-2 py-3 sm:px-4 sm:py-4 border-l text-center border-r border-gray-300">
                      {formatCurrency(provider.totalAmountFunded)}
                    </td>
                    <td className="px-2 py-3 sm:px-4 sm:py-4 text-center border-r border-gray-300">
                      {formatCurrency(provider.avgAmountFunded)}
                    </td>
                    <td className="px-2 py-3 sm:px-4 sm:py-4 text-center border-r border-gray-300">
                      {formatCurrency(provider.totalGross)}
                    </td>
                    <td className="px-2 py-3 sm:px-4 sm:py-4 text-center border-r border-gray-300">
                      {formatCurrency(provider.avgGross)}
                    </td>
                    <td className="px-2 py-3 sm:px-4 sm:py-4 text-center border-r border-gray-300">
                      {formatCurrency(provider.totalSalesGross)}
                    </td>
                    <td className="px-2 py-3 sm:px-4 sm:py-4 text-center border-r border-gray-300">
                      {formatCurrency(provider.avgSalesGross)}
                    </td>
                    <td className="px-2 py-3 sm:px-4 sm:py-4 text-center border-r border-gray-300">
                      {formatCurrency(provider.totalCommission)}
                    </td>
                    <td className="px-2 py-3 sm:px-4 sm:py-4 text-center border-r border-gray-300">
                      {formatCurrency(provider.avgCommission)}
                    </td>
                    <td className="px-2 py-3 sm:px-4 sm:py-4 text-center border-r border-gray-300">
                      {formatCurrency(provider.totalTrueGross)}
                    </td>
                    <td className="px-2 py-3 sm:px-4 sm:py-4 text-center border-r border-gray-300">
                      {formatCurrency(provider.avgTrueGross)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="15" className="w-full p-4 text-center">
                    No sales data available for {formatDisplayDate(startDate)} -{" "}
                    {formatDisplayDate(endDate)}
                    {selectedFinanceProvider !== "all" &&
                      ` for provider: ${selectedFinanceProvider}`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MonthlyFinanceProviderAnalytics;
