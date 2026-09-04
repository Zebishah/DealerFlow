import React, { useState, useEffect, useMemo } from "react";
import { Listbox } from "@headlessui/react";
import {
  CheckIcon,
  ChevronUpDownIcon,
  XMarkIcon,
  XCircleIcon,
} from "@heroicons/react/20/solid";
import ReactApexChart from "react-apexcharts";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "../../../config/firebaseConfig";

const LeadsDashboard = () => {
  // Get current date details
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  // State for filters and data
  const [leadsData, setLeadsData] = useState({
    originalLeads: [],
    filteredLeads: [],
    leadSources: [],
    SalesPerson: [],
    totalLeadCount: 0,
    monthlyLeadCounts: {},
    dailyLeadCounts: {},
    leadCountBySource: {},
  });

  // Filter states - now with default current month and year
  const [filters, setFilters] = useState({
    leadSource: "All",
    SalesPerson: "All",
    month: currentMonth,
    year: currentYear,
    timeRange: "current-month",
  });

  // Fetch leads data
  useEffect(() => {
    const fetchLeadsData = async () => {
      try {
        const q = query(collection(db, "employees"));
        const querySnapshot = await getDocs(q);

        const leads = [];
        const leadSources = new Set(["All"]);

        querySnapshot.forEach((doc) => {
          const docLeads = doc.data().leads || [];
          docLeads.forEach((lead) => {
            leads.push({
              ...lead,
              date: lead.timestamp.toDate(),
            });
            leadSources.add(lead.leadSource);
          });
        });

        // Process initial data
        const processedLeads = processLeadsData(leads);

        setLeadsData({
          originalLeads: leads,
          filteredLeads: leads,
          leadSources: Array.from(leadSources),
          ...processedLeads,
        });
      } catch (error) {
        console.error("Error fetching leads data:", error);
      }
    };

    fetchLeadsData();
  }, []);

  // Process leads data
  const processLeadsData = (leads) => {
    const monthlyLeadCounts = {};
    const dailyLeadCounts = {};
    const leadCountBySource = {};
    let totalLeadCount = 0;

    leads.forEach((lead) => {
      // Monthly counts for current year
      if (lead.date.getFullYear() === currentYear) {
        const monthKey = lead.date.toLocaleString("default", {
          month: "short",
          year: "numeric",
        });
        monthlyLeadCounts[monthKey] = (monthlyLeadCounts[monthKey] || 0) + 1;
      }

      // Daily counts for current month
      if (
        lead.date.getMonth() === currentMonth &&
        lead.date.getFullYear() === currentYear
      ) {
        const dayKey = lead.date.toLocaleString("default", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
        dailyLeadCounts[dayKey] = (dailyLeadCounts[dayKey] || 0) + 1;
      }

      // Source counts
      leadCountBySource[lead.leadSource] =
        (leadCountBySource[lead.leadSource] || 0) + 1;

      totalLeadCount++;
    });

    return {
      totalLeadCount,
      monthlyLeadCounts,
      dailyLeadCounts,
      leadCountBySource,
    };
  };

  // Filter leads based on selected filters
  const filterLeads = useMemo(() => {
    let filteredLeads = leadsData.originalLeads;

    // Filter by lead source
    if (filters.leadSource !== "All") {
      filteredLeads = filteredLeads.filter(
        (lead) => lead.leadSource === filters.leadSource
      );
    }

    // Filter by month and year
    if (filters.month !== null && filters.year !== null) {
      filteredLeads = filteredLeads.filter((lead) => {
        const leadMonth = lead.date.getMonth();
        const leadYear = lead.date.getFullYear();
        return leadMonth === filters.month && leadYear === filters.year;
      });
    }

    // Filter by time range
    const now = new Date();
    switch (filters.timeRange) {
      case "current-month":
        filteredLeads = filteredLeads.filter((lead) => {
          return (
            lead.date.getMonth() === currentMonth &&
            lead.date.getFullYear() === currentYear
          );
        });
        break;
      case "today":
        filteredLeads = filteredLeads.filter(
          (lead) => lead.date.toDateString() === now.toDateString()
        );
        break;
      case "yesterday":
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        filteredLeads = filteredLeads.filter(
          (lead) => lead.date.toDateString() === yesterday.toDateString()
        );
        break;
      case "last-week":
        const lastWeek = new Date(now);
        lastWeek.setDate(now.getDate() - 7);
        filteredLeads = filteredLeads.filter((lead) => lead.date >= lastWeek);
        break;
      case "last-month":
        const lastMonth = new Date(now);
        lastMonth.setMonth(now.getMonth() - 1);
        filteredLeads = filteredLeads.filter((lead) => lead.date >= lastMonth);
        break;
      case "last-year":
        const lastYear = new Date(now);
        lastYear.setFullYear(now.getFullYear() - 1);
        filteredLeads = filteredLeads.filter((lead) => lead.date >= lastYear);
        break;
    }

    return processLeadsData(filteredLeads);
  }, [leadsData.originalLeads, filters]);

  // Chart configurations for Area Charts
  const monthlyLeadCountsSeries = [
    {
      name: "Monthly Lead Count",
      data: Object.entries(filterLeads.monthlyLeadCounts).map(
        ([month, count]) => ({ x: month, y: count })
      ),
    },
  ];

  const dailyLeadCountsSeries = [
    {
      name: "Daily Lead Count",
      data: Object.entries(filterLeads.dailyLeadCounts).map(([day, count]) => ({
        x: day,
        y: count,
      })),
    },
  ];

  const leadCountBySourceSeries = Object.values(filterLeads.leadCountBySource);

  const monthlyLeadCountsOptions = {
    chart: {
      type: "area",
      height: 350,
      toolbar: { show: false },
    },
    dataLabels: { enabled: false },
    stroke: { curve: "smooth" },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.7,
        opacityTo: 0.9,
        stops: [0, 90, 100],
      },
    },
    title: {
      text: "Monthly Lead Count",
      style: { fontSize: "16px", fontWeight: "bold" },
    },
    xaxis: {
      title: { text: "Month" },
      type: "category",
    },
    yaxis: { title: { text: "Number of Leads" } },
    colors: ["#3498db"],
  };

  const dailyLeadCountsOptions = {
    ...monthlyLeadCountsOptions,
    title: {
      text: "Daily Lead Count",
      style: { fontSize: "16px", fontWeight: "bold" },
    },
    xaxis: {
      title: { text: "Day" },
      type: "category",
    },
  };

  const leadSourceOptions = {
    chart: { type: "pie", height: 350 },
    labels: Object.keys(filterLeads.leadCountBySource),
    title: {
      text: "Leads by Source",
      style: { fontSize: "16px", fontWeight: "bold" },
    },
  };

  // Generate years and months for dropdowns
  const years = [
    ...new Set(leadsData.originalLeads.map((lead) => lead.date.getFullYear())),
  ];
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

  // Clear specific filter
  const clearFilter = (filterName) => {
    setFilters((prev) => {
      const newFilters = { ...prev };
      switch (filterName) {
        case "leadSource":
          newFilters.leadSource = "All";
          break;
        case "month":
          newFilters.month = null;
          break;
        case "year":
          newFilters.year = null;
          break;
        case "timeRange":
          newFilters.timeRange = "all";
          break;
      }
      return newFilters;
    });
  };

  // Clear all filters
  const clearAllFilters = () => {
    setFilters({
      leadSource: "All",
      month: currentMonth,
      year: currentYear,
      timeRange: "current-month",
    });
  };

  // Custom Dropdown Component
  const CustomDropdown = ({
    options,
    value,
    onChange,
    placeholder,
    onClear,
  }) => {
    return (
      <div className="relative">
        <Listbox value={value} onChange={onChange}>
          <div className="relative mt-1">
            <Listbox.Button className="relative w-full cursor-default rounded-lg bg-white py-2 pl-3 pr-10 text-left shadow-md focus:outline-none focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-orange-300 sm:text-sm">
              <span className="block truncate">{value || placeholder}</span>
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                <ChevronUpDownIcon
                  className="h-5 w-5 text-gray-400"
                  aria-hidden="true"
                />
              </span>
            </Listbox.Button>
            <Listbox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm z-50">
              {options.map((option, optionIdx) => (
                <Listbox.Option
                  key={optionIdx}
                  className={({ active }) =>
                    `relative cursor-default select-none py-2 pl-10 pr-4 ${
                      active ? "bg-blue-100 text-blue-700" : "text-gray-900"
                    }`
                  }
                  value={option}
                >
                  {({ selected }) => (
                    <>
                      <span
                        className={`block truncate ${
                          selected ? "font-medium" : "font-normal"
                        }`}
                      >
                        {option}
                      </span>
                      {selected ? (
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                          <CheckIcon className="h-5 w-5" aria-hidden="true" />
                        </span>
                      ) : null}
                    </>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </div>
        </Listbox>
        {onClear && value && (
          <button
            onClick={onClear}
            className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 w-full bg-gray-100">
      {/* Filters */}
      <div className="grid grid-cols-5 gap-4 mb-4 items-center">
        {/* Lead Source Filter */}
        <CustomDropdown
          options={leadsData.leadSources}
          value={filters.leadSource}
          onChange={(value) =>
            setFilters((prev) => ({ ...prev, leadSource: value }))
          }
          placeholder="Select Lead Source"
          onClear={() => clearFilter("leadSource")}
        />
        <CustomDropdown
          options={leadsData.leadSources}
          value={filters.leadSource}
          onChange={(value) =>
            setFilters((prev) => ({ ...prev, SalesPerson: value }))
          }
          placeholder="Select Sales Person"
          onClear={() => clearFilter("SalesPerson")}
        />
        {/* Month Filter */}
        <CustomDropdown
          options={months}
          value={months[filters.month]}
          onChange={(value) =>
            setFilters((prev) => ({
              ...prev,
              month: months.indexOf(value),
            }))
          }
          placeholder="Select Month"
          onClear={() => clearFilter("month")}
        />

        {/* Year Filter */}
        <CustomDropdown
          options={years.map(String)}
          value={filters.year?.toString()}
          onChange={(value) =>
            setFilters((prev) => ({
              ...prev,
              year: parseInt(value),
            }))
          }
          placeholder="Select Year"
          onClear={() => clearFilter("year")}
        />

        {/* Time Range Filter */}
        <CustomDropdown
          options={[
            "current-month",
            "today",
            "yesterday",
            "last-week",
            "last-month",
            "last-year",
            "all",
          ]}
          value={filters.timeRange}
          onChange={(value) =>
            setFilters((prev) => ({ ...prev, timeRange: value }))
          }
          placeholder="Select Time Range"
          onClear={() => clearFilter("timeRange")}
        />

        {/* Clear All Filters Button */}
        <button
          onClick={clearAllFilters}
          className="flex items-center justify-center bg-red-500 text-white rounded-lg py-2 px-4 hover:bg-red-600 transition-colors"
        >
          <XCircleIcon className="h-5 w-5 mr-2" />
          Clear All Filters
        </button>
      </div>

      {/* Dashboard Content (rest of the code remains the same as before) */}
      <div className="grid grid-row-2 w-full md:grid-row-2 gap-4">
        {/* Overview Card */}
        <div className="bg-white flex flex-col gap-4 w-full rounded-lg shadow-md p-4">
          <h2 className="text-xl font-bold mb-4">Lead Count Overview</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-100 p-3 rounded">
              <p className="text-sm text-gray-600">Total Lead Count</p>
              <p className="text-2xl font-bold text-blue-600">
                {filterLeads.totalLeadCount}
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded">
              <p className="text-sm text-gray-600">Total Lead Sources</p>
              <p className="text-2xl font-bold text-blue-600">{9}</p>
            </div>
          </div>
          <div className="bg-green-100 p-3 rounded">
            <ReactApexChart
              options={leadSourceOptions}
              series={leadCountBySourceSeries}
              type="pie"
              height={240}
              width={800}
            />
          </div>
        </div>

        {/* Monthly and Daily Leads Charts */}
        <div className="flex w-full gap-6">
          <div className="bg-white w-1/2 rounded-lg shadow-md p-4">
            <h2 className="text-xl font-bold mb-4">Monthly Leads</h2>
            <ReactApexChart
              options={monthlyLeadCountsOptions}
              series={monthlyLeadCountsSeries}
              type="area"
              height={350}
            />
          </div>

          <div className="col-span-full w-1/2 bg-white rounded-lg shadow-md p-4">
            <h2 className="text-xl font-bold mb-4">Daily Leads</h2>
            <ReactApexChart
              options={dailyLeadCountsOptions}
              series={dailyLeadCountsSeries}
              type="area"
              height={350}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadsDashboard;
