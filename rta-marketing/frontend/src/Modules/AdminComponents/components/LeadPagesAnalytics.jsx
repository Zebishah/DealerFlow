import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import Filters from "../../../shared/VirtualAssistantComponents/TableFilters";
import SalesTableVA from "../../../shared/VirtualAssistantComponents/TableComponent";
import PaginationVA from "../../../shared/VirtualAssistantComponents/Pagination";
import { db } from "../../../config/firebaseConfig";
import DateRangeMonthFilter from "./DateRangeMonthFilter";

const LeadPagesAnalytics = () => {
  const [data, setData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(7);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [selectedLeadSource, setSelectedLeadSource] = useState("");
  const [selectedSalesPerson, setSelectedSalesPerson] = useState("");
  const [leadSources, setLeadSources] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

  useEffect(() => {
    fetchLeadSources();
  }, []);

  useEffect(() => {
    if (leadSources.length > 0) {
      fetchData();
    }
  }, [startDate, endDate, leadSources, selectedMonth]);

  const fetchLeadSources = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "leads"));
      const sources = querySnapshot.docs.map((doc) => doc.data().leadName);
      setLeadSources(sources);
    } catch (error) {
      console.error("Error fetching leads:", error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    let start, end;

    if (selectedMonth !== "") {
      const year = new Date().getFullYear();
      start = new Date(year, selectedMonth, 1);
      end = new Date(year, selectedMonth + 1, 0, 23, 59, 59, 999);
    }

    if (startDate && endDate) {
      start = startDate;
      end = endDate;
    }

    if (!start || !end) {
      const year = new Date().getFullYear();
      const month = new Date().getMonth();
      start = new Date(year, month, 1);
      end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    }

    // Fetch leads data
    const employeesRef = collection(db, "employees");
    const employeeSnapshot = await getDocs(employeesRef);
    const leadCounts = {};
    const leadCosts = {};

    employeeSnapshot.forEach((doc) => {
      const employee = doc.data();
      if (employee.leads && Array.isArray(employee.leads)) {
        employee.leads.forEach((lead) => {
          const leadTime = lead.timestamp?.toDate();
          if (
            leadTime >= start &&
            leadTime <= end &&
            leadSources.includes(lead.leadSource)
          ) {
            leadCounts[lead.leadSource] =
              (leadCounts[lead.leadSource] || 0) + (lead.leadAmount || 1);

            const leadCost = lead.leadCost || 0;
            const leadAmount = lead.leadAmount || 0;
            leadCosts[lead.leadSource] =
              (leadCosts[lead.leadSource] || 0) + leadCost * leadAmount;
          }
        });
      }
    });

    // Fetch sales data
    const salesSnapshot = await getDocs(collection(db, "sales"));
    const salesCounts = {};

    salesSnapshot.forEach((doc) => {
      const sale = doc.data();
      if (sale.sales && Array.isArray(sale.sales)) {
        sale.sales.forEach((s) => {
          let saleTime;
          if (s.saleDate && typeof s.saleDate.toDate === "function") {
            saleTime = s.saleDate.toDate();
          } else if (typeof s.saleDate === "string") {
            saleTime = new Date(s.saleDate);
          } else if (s.saleDate instanceof Date) {
            saleTime = s.saleDate;
          }

          if (saleTime && saleTime >= start && saleTime <= end) {
            salesCounts[s.leadSource] = (salesCounts[s.leadSource] || 0) + 1;
          }
        });
      }
    });

    // Prepare table data
    const tableData = Object.keys(leadCounts).map((leadSource) => {
      const totalLeads = leadCounts[leadSource] || 0;
      const totalSales = salesCounts[leadSource] || 0;
      const totalLeadCost = leadCosts[leadSource] || 0;
      const conversionRate = totalLeads
        ? ((totalSales / totalLeads) * 100).toFixed(2)
        : "0.00";

      const costPerLead = totalLeads
        ? (totalLeadCost / totalLeads).toFixed(2)
        : "0.00";

      const costPerSale = totalSales
        ? (totalLeadCost / totalSales).toFixed(2)
        : "0.00";

      return {
        leadSource,
        totalLeads,
        totalSales,
        conversionRate: `${conversionRate}%`,
        totalLeadCost: `$${costPerSale}`,
        costPerLead: `$${costPerLead}`,
        costPerSale: `$${costPerSale}`,
      };
    });

    setData(tableData);

    setLoading(false);
  };

  const salesColumns = [
    { key: "leadSource", label: "Lead Source" },
    { key: "totalLeads", label: "Total Leads" },
    { key: "totalSales", label: "Sales Leads" },
    { key: "conversionRate", label: "Conversion Rate" },
    { key: "totalLeadCost", label: "Leads Cost per Sale" },
  ];

  const getMonthName = (monthIndex) => {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    return months[monthIndex] || "Invalid Month";
  };

  return (
    <div className="flex flex-col w-full h-full gap-y-8 overflow-y-auto">
      <DateRangeMonthFilter
        onFilterChange={() => fetchData()}
        showFilters={showFilters}
        handleFilterToggle={() => setShowFilters(!showFilters)}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
      />
      <div>
        <h2 className="text-lg font-bold">
          {startDate && endDate
            ? `Showing results from (${startDate.toLocaleDateString(
                "en-GB"
              )}) to (${endDate.toLocaleDateString("en-GB")})`
            : `Showing leads for month: ${getMonthName(selectedMonth)}`}
        </h2>
      </div>
      <SalesTableVA columns={salesColumns} data={data} loading={loading} />
      <PaginationVA
        currentPage={currentPage}
        totalPages={Math.max(1, Math.ceil(data.length / rowsPerPage))}
        onPageChange={setCurrentPage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={setRowsPerPage}
      />
    </div>
  );
};

export default LeadPagesAnalytics;
