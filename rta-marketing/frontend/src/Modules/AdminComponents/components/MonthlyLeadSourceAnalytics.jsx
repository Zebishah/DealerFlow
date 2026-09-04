import { collection, getDocs } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../../../config/firebaseConfig";

const MonthlyLeadSourceAnalytics = ({
  selectedMonth,
  selectedYear,
  startDate,
  endDate,
}) => {
  const [leadSourceData, setLeadSourceData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [allSalesData, setAllSalesData] = useState([]);
  const [leadSources, setLeadSources] = useState([]);
  const [selectedLeadSource, setSelectedLeadSource] = useState("all");

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
        const uniqueLeadSources = new Set();

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

              // Get lead source
              let leadSource = sale.leadSource || "Unknown";
              if (leadSource !== "Unknown") {
                leadSource = leadSource.trim().toLowerCase(); // normalize
                uniqueLeadSources.add(leadSource);
              }

              // Add all sales with date information - including those without lead sources
              allSales.push({
                sale,
                saleDate,
                salespersonId: salesDocId,
                leadSource,
              });
            });
          }
        });

        setAllSalesData(allSales);
        setLeadSources(Array.from(uniqueLeadSources).sort());

        // Initial processing with default filters
        processSalesData(allSales, selectedLeadSource);
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
      processSalesData(allSalesData, selectedLeadSource);
    }
  }, [selectedMonth, selectedYear, selectedLeadSource, allSalesData]);

  const processSalesData = (salesData, leadSourceFilter) => {
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

      // Apply lead source filter if not "all", but track unknown sources separately
      let unknownSourceSales = [];
      let selectedSourceSales = [];

      if (leadSourceFilter !== "all") {
        // If specific source is selected, get only those sales
        selectedSourceSales = filteredSales.filter(
          (item) => item.leadSource === leadSourceFilter
        );
        // Always keep track of unknown source sales
        unknownSourceSales = filteredSales.filter(
          (item) => item.leadSource === "Unknown"
        );
        // Use selected source sales for main processing
        filteredSales = selectedSourceSales;
      } else {
        // When "all" is selected, separate the unknown sales
        unknownSourceSales = filteredSales.filter(
          (item) => item.leadSource === "Unknown"
        );
        selectedSourceSales = filteredSales.filter(
          (item) => item.leadSource !== "Unknown"
        );
        // Process known sources for the main table
        filteredSales = selectedSourceSales;
      }

      const leadSourceMap = new Map();

      // Process filtered sales
      filteredSales.forEach(({ sale, leadSource }) => {
        if (!leadSourceMap.has(leadSource)) {
          leadSourceMap.set(leadSource, {
            name: leadSource,
            leadsReceived: 0,
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

        const source = leadSourceMap.get(leadSource);

        source.dealsBooked += 1;
        source.leadsReceived += 1; // Increment for each sale with this lead source
        if (sale.referralCost) {
          source.leadCost += parseFloat(sale.referralCost) || 0;
        }

        if (sale.daysToDelivery) {
          source.daysToDelivery.push(parseInt(sale.daysToDelivery) || 0);
        }

        if (sale.daysToFunding) {
          source.daysToFunding.push(parseInt(sale.daysToFunding) || 0);
        }

        source.amountFunded += parseFloat(sale.amountFunded || 0);
        source.gross += parseFloat(sale.gross || 0);
        source.salesGross += parseFloat(sale.salesGross || 0);
        source.commission += parseFloat(sale.commission || 0);
        source.trueGross += parseFloat(sale.trueGross || 0);
      });

      // Create a data structure for unknown lead source sales
      const unknownSourceData = {
        name: "No LeadSource",
        leadCost: 0,
        leadsReceived: 0, // Add this line
        dealsBooked: 0,
        daysToDelivery: [],
        daysToFunding: [],
        amountFunded: 0,
        gross: 0,
        salesGross: 0,
        commission: 0,
        trueGross: 0,
      };

      // Process the unknown lead source sales
      unknownSourceSales.forEach(({ sale }) => {
        unknownSourceData.dealsBooked += 1;
        unknownSourceData.leadsReceived += 1;
        if (sale.referralCost) {
          unknownSourceData.leadCost += parseFloat(sale.referralCost) || 0;
        }

        if (sale.daysToDelivery) {
          unknownSourceData.daysToDelivery.push(
            parseInt(sale.daysToDelivery) || 0
          );
        }

        if (sale.daysToFunding) {
          unknownSourceData.daysToFunding.push(
            parseInt(sale.daysToFunding) || 0
          );
        }

        unknownSourceData.amountFunded += parseFloat(sale.amountFunded || 0);
        unknownSourceData.gross += parseFloat(sale.gross || 0);
        unknownSourceData.salesGross += parseFloat(sale.salesGross || 0);
        unknownSourceData.commission += parseFloat(sale.commission || 0);
        unknownSourceData.trueGross += parseFloat(sale.trueGross || 0);
      });

      const leadSourceArray = Array.from(leadSourceMap.values()).map(
        (source) => {
          const avgDaysToDelivery =
            source.daysToDelivery.length > 0
              ? source.daysToDelivery.reduce((a, b) => a + b, 0) /
                source.daysToDelivery.length
              : 0;

          const avgDaysToFunding =
            source.daysToFunding.length > 0
              ? source.daysToFunding.reduce((a, b) => a + b, 0) /
                source.daysToFunding.length
              : 0;

          const avgAmountFunded =
            source.dealsBooked > 0
              ? source.amountFunded / source.dealsBooked
              : 0;

          const avgGross =
            source.dealsBooked > 0 ? source.gross / source.dealsBooked : 0;

          const avgSalesGross =
            source.dealsBooked > 0 ? source.salesGross / source.dealsBooked : 0;

          const avgCommission =
            source.dealsBooked > 0 ? source.commission / source.dealsBooked : 0;

          const avgTrueGross =
            source.dealsBooked > 0 ? source.trueGross / source.dealsBooked : 0;

          return {
            name: source.name,
            leadsReceived: source.leadsReceived, // Add this line
            leadCost: source.leadCost,
            dealsBooked: source.dealsBooked,
            avgDaysToDelivery: parseFloat(avgDaysToDelivery.toFixed(2)),
            avgDaysToFunding: parseFloat(avgDaysToFunding.toFixed(2)),
            totalAmountFunded: source.amountFunded,
            avgAmountFunded: parseFloat(avgAmountFunded.toFixed(2)),
            totalGross: source.gross,
            avgGross: parseFloat(avgGross.toFixed(2)),
            totalSalesGross: source.salesGross,
            avgSalesGross: parseFloat(avgSalesGross.toFixed(2)),
            totalCommission: source.commission,
            avgCommission: parseFloat(avgCommission.toFixed(2)),
            totalTrueGross: source.trueGross,
            avgTrueGross: parseFloat(avgTrueGross.toFixed(2)),
          };
        }
      );

      // Process the unknown source data and add it as a final row if there are any sales without lead sources
      if (unknownSourceData.dealsBooked > 0) {
        const avgDaysToDelivery =
          unknownSourceData.daysToDelivery.length > 0
            ? unknownSourceData.daysToDelivery.reduce((a, b) => a + b, 0) /
              unknownSourceData.daysToDelivery.length
            : 0;

        const avgDaysToFunding =
          unknownSourceData.daysToFunding.length > 0
            ? unknownSourceData.daysToFunding.reduce((a, b) => a + b, 0) /
              unknownSourceData.daysToFunding.length
            : 0;

        const avgAmountFunded =
          unknownSourceData.dealsBooked > 0
            ? unknownSourceData.amountFunded / unknownSourceData.dealsBooked
            : 0;

        const avgGross =
          unknownSourceData.dealsBooked > 0
            ? unknownSourceData.gross / unknownSourceData.dealsBooked
            : 0;

        const avgSalesGross =
          unknownSourceData.dealsBooked > 0
            ? unknownSourceData.salesGross / unknownSourceData.dealsBooked
            : 0;

        const avgCommission =
          unknownSourceData.dealsBooked > 0
            ? unknownSourceData.commission / unknownSourceData.dealsBooked
            : 0;

        const avgTrueGross =
          unknownSourceData.dealsBooked > 0
            ? unknownSourceData.trueGross / unknownSourceData.dealsBooked
            : 0;

        leadSourceArray.push({
          name: unknownSourceData.name,
          leadsReceived: unknownSourceData.leadsReceived, // Add this line
          leadCost: unknownSourceData.leadCost,
          dealsBooked: unknownSourceData.dealsBooked,
          avgDaysToDelivery: parseFloat(avgDaysToDelivery.toFixed(2)),
          avgDaysToFunding: parseFloat(avgDaysToFunding.toFixed(2)),
          totalAmountFunded: unknownSourceData.amountFunded,
          avgAmountFunded: parseFloat(avgAmountFunded.toFixed(2)),
          totalGross: unknownSourceData.gross,
          avgGross: parseFloat(avgGross.toFixed(2)),
          totalSalesGross: unknownSourceData.salesGross,
          avgSalesGross: parseFloat(avgSalesGross.toFixed(2)),
          totalCommission: unknownSourceData.commission,
          avgCommission: parseFloat(avgCommission.toFixed(2)),
          totalTrueGross: unknownSourceData.trueGross,
          avgTrueGross: parseFloat(avgTrueGross.toFixed(2)),
        });
      }

      setLeadSourceData(leadSourceArray);
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

  if (isLoading && leadSourceData.length === 0) {
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
    <div className="">
      {/* Date and Lead Source filters */}
      <div className="flex justify-between mb-4">
        <h1 className="text-2xl font-bold ">Lead Sources Summary</h1>
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
                  Lead Source
                </th>
                <th scope="col" className="px-2 py-3 sm:px-4 sm:py-4">
                  Leads Received
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
              {leadSourceData.length > 0 ? (
                leadSourceData.map((source, index) => (
                  <tr
                    key={index}
                    className="bg-white border-b dark:bg-white dark:border-gray-300"
                  >
                    <td
                      className="px-2 py-3 sm:px-3 sm:py-4 font-medium text-gray-900 whitespace-nowrap dark:text-black"
                      title={source.name}
                    >
                      {source.name.length > 10
                        ? `${source.name.substring(0, 10)}...`
                        : source.name}
                    </td>
                    <td className="px-2 py-3 sm:px-4 sm:py-4">
                      {source.leadsReceived}
                    </td>
                    <td className="px-2 py-3 sm:px-4 sm:py-4">
                      {formatCurrency(source.leadCost)}
                    </td>
                    <td className="px-2 py-3 sm:px-4 sm:py-4">
                      {source.dealsBooked}
                    </td>
                    <td className="px-2 py-3 sm:px-4 sm:py-4">
                      {source.avgDaysToDelivery}
                    </td>
                    <td className="px-2 py-3 sm:px-4 sm:py-4">
                      {source.avgDaysToFunding}
                    </td>
                    <td className="px-2 py-3 sm:px-4 sm:py-4 border-l text-center border-r border-gray-300">
                      {formatCurrency(source.totalAmountFunded)}
                    </td>
                    <td className="px-2 py-3 sm:px-4 sm:py-4 text-center border-r border-gray-300">
                      {formatCurrency(source.avgAmountFunded)}
                    </td>
                    <td className="px-2 py-3 sm:px-4 sm:py-4 text-center border-r border-gray-300">
                      {formatCurrency(source.totalGross)}
                    </td>
                    <td className="px-2 py-3 sm:px-4 sm:py-4 text-center border-r border-gray-300">
                      {formatCurrency(source.avgGross)}
                    </td>
                    <td className="px-2 py-3 sm:px-4 sm:py-4 text-center border-r border-gray-300">
                      {formatCurrency(source.totalSalesGross)}
                    </td>
                    <td className="px-2 py-3 sm:px-4 sm:py-4 text-center border-r border-gray-300">
                      {formatCurrency(source.avgSalesGross)}
                    </td>
                    <td className="px-2 py-3 sm:px-4 sm:py-4 text-center border-r border-gray-300">
                      {formatCurrency(source.totalCommission)}
                    </td>
                    <td className="px-2 py-3 sm:px-4 sm:py-4 text-center border-r border-gray-300">
                      {formatCurrency(source.avgCommission)}
                    </td>
                    <td className="px-2 py-3 sm:px-4 sm:py-4 text-center border-r border-gray-300">
                      {formatCurrency(source.totalTrueGross)}
                    </td>
                    <td className="px-2 py-3 sm:px-4 sm:py-4 text-center border-r border-gray-300">
                      {formatCurrency(source.avgTrueGross)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="15" className="w-full p-4 text-center">
                    No sales data available for {formatDisplayDate(startDate)} -{" "}
                    {formatDisplayDate(endDate)}
                    {selectedLeadSource !== "all" &&
                      ` for lead source: ${selectedLeadSource}`}
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

export default MonthlyLeadSourceAnalytics;
