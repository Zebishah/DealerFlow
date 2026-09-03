import React, { useEffect, useState } from "react";
import ReactApexChart from "react-apexcharts";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../../config/firebaseConfig";
import { IoChevronDown } from "react-icons/io5";
import {
  FaChartLine,
  FaDollarSign,
  FaExchangeAlt,
  FaUsers,
} from "react-icons/fa";
import { Menu } from "@headlessui/react";
import CustomDateRangePicker from "./MuiDatePicker";

const SalesAnalysisChart = () => {
  // Helper to get label from value for time range
  const getTimeRangeLabel = (value) => {
    const option = timeRangeOptions.find((opt) => opt.value === value);
    return option ? option.label : "";
  };
  const [chartData, setChartData] = useState({
    series: [],
    options: {
      chart: {
        height: 500,
        type: "bar",
        zoom: { enabled: true, type: "x" },
        toolbar: {
          show: true,
          tools: {
            download: true,
            selection: true,
            zoom: true,
            zoomout: true,
            pan: true,
            reset: true,
          },
        },
        scrollbar: {
          enabled: true,
        },
        background: "#ffffff",
        fontFamily: "'Inter', 'Helvetica', sans-serif",
      },
      colors: ["#00c22a", "#0a99ff", "#FFC107", "#ff0008"],
      xaxis: {
        categories: [],
        title: {
          text: "Date",
          style: {
            color: "#64748b",
            fontWeight: 600,
            fontSize: "12px",
          },
        },
        labels: {
          rotate: -45,
          rotateAlways: true,
          style: {
            colors: "#4b5563",
            fontSize: "10px",
            fontWeight: 500,
          },
        },
        tickPlacement: "on",
        axisBorder: {
          show: true,
          color: "#e2e8f0",
        },
        axisTicks: {
          show: true,
          color: "#e2e8f0",
        },
      },
      yaxis: [
        {
          title: {
            text: "Total Leads",
            style: {
              color: "#00c22a",
              fontWeight: 600,
              fontSize: "12px",
            },
          },
          labels: {
            style: {
              colors: "#00c22a",
              fontWeight: 500,
            },
            formatter: (value) => Math.round(value),
          },
          seriesName: "Total Leads",
          axisBorder: {
            show: true,
            color: "#00c22a",
          },
          axisTicks: {
            show: true,
            color: "#00c22a",
          },
        },
        {
          opposite: true,
          title: {
            text: "Total Sales",
            style: {
              color: "#0a99ff",
              fontWeight: 600,
              fontSize: "12px",
            },
          },
          labels: {
            style: {
              colors: "#0a99ff",
              fontWeight: 500,
            },
            formatter: (value) => Math.round(value),
          },
          seriesName: "Total Sales",
          axisBorder: {
            show: true,
            color: "#0a99ff",
          },
          axisTicks: {
            show: true,
            color: "#0a99ff",
          },
        },
        {
          opposite: true,
          title: {
            text: "Conversion Rate (%)",
            style: {
              color: "#FFC107",
              fontWeight: 600,
              fontSize: "12px",
            },
          },
          min: 0,
          max: 100,
          labels: {
            formatter: (value) => `${value.toFixed(1)}%`,
            style: {
              colors: "#FFC107",
              fontWeight: 500,
            },
          },
          seriesName: "Conversion Rate",
          axisBorder: {
            show: true,
            color: "#FFC107",
          },
          axisTicks: {
            show: true,
            color: "#FFC107",
          },
        },
        {
          opposite: true,
          title: {
            text: "Cost Per Sale ($)",
            style: {
              color: "#ff0008",
              fontWeight: 600,
              fontSize: "12px",
            },
          },
          labels: {
            formatter: (value) => `$${value.toFixed(0)}`,
            style: {
              colors: "#ff0008",
              fontWeight: 500,
            },
          },
          seriesName: "Cost Per Sale",
          axisBorder: {
            show: true,
            color: "#ff0008",
          },
          axisTicks: {
            show: true,
            color: "#ff0008",
          },
        },
      ],
      plotOptions: {
        bar: {
          columnWidth: "65%",
          borderRadius: 2,
          dataLabels: {
            position: "top",
          },
        },
      },
      dataLabels: {
        enabled: false,
      },
      stroke: {
        width: [0, 0, 3, 3],
        curve: "smooth",
        colors: ["#00c22a", "#0a99ff", "#FFC107", "#ff0008"],
      },
      grid: {
        show: true,
        borderColor: "#e5e7eb",
        strokeDashArray: 5,
        position: "back",
        xaxis: {
          lines: {
            show: true,
          },
        },
        yaxis: {
          lines: {
            show: true,
          },
        },
        // Adding specific grid lines for each y-axis
        row: {
          colors: undefined,
          opacity: 0.5,
        },
        column: {
          colors: undefined,
          opacity: 0.5,
        },
        padding: {
          right: 10,
          left: 10,
        },
      },
      legend: {
        show: true,
        position: "bottom",
        horizontalAlign: "center",
        fontSize: "12px",
        fontWeight: 500,
        markers: {
          width: 12,
          height: 12,
          radius: 6,
        },
        itemMargin: {
          horizontal: 15,
          vertical: 5,
        },
      },
      tooltip: {
        theme: "light",
        shared: true,
        intersect: false,
        style: {
          fontSize: "12px",
        },
        y: {
          formatter: function (value, { seriesIndex, dataPointIndex, w }) {
            const seriesName = w.config.series[seriesIndex].name;
            if (seriesName === "Total Leads" || seriesName === "Total Sales") {
              return Math.round(value);
            }
            if (seriesName === "Conversion Rate") {
              return `${value.toFixed(1)}%`;
            }
            if (seriesName === "Cost Per Sale") {
              return `$${value.toFixed(0)}`;
            }
            return value;
          },
        },
        marker: {
          show: true,
        },
      },
      responsive: [
        {
          breakpoint: 1024,
          options: {
            chart: {
              height: 400,
            },
            xaxis: {
              labels: {
                rotate: -90,
                style: {
                  fontSize: "8px",
                },
              },
            },
          },
        },
        {
          breakpoint: 600,
          options: {
            chart: {
              height: 300,
            },
            xaxis: {
              labels: {
                rotate: -90,
                style: {
                  fontSize: "6px",
                },
              },
            },
          },
        },
      ],
    },
  });
  const [summaryStats, setSummaryStats] = useState({
    totalLeads: 0,
    totalSales: 0,
    conversionRate: 0,
    costPerSale: 0,
  });
  const [dateFrom, setDateFrom] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1)
  );
  const [dateTo, setDateTo] = useState(new Date());
  const [leadSources, setLeadSources] = useState([]);
  const [selectedLeadSource, setSelectedLeadSource] = useState("All");
  const [TotalConversionRate, setTotalConversionRate] = useState(0);
  const [TotalSalePerLead, setTotalSalePerLead] = useState(0);
  const [dateGrouping, setDateGrouping] = useState("day"); // 'day', 'month', 'year', or 'hour'
  const [timeRangeFilter, setTimeRangeFilter] = useState("custom"); // New time range filter

  // Time range options
  const timeRangeOptions = [
    { value: "today", label: "Today" },
    { value: "yesterday", label: "Yesterday" },
    { value: "thisMonth", label: "This Month" },
    { value: "lastWeek", label: "Last Week" },
    { value: "lastYear", label: "Last Year" },
    { value: "custom", label: "Custom Range" },
  ];
  // When setting custom dates, adjust time to cover full days
  const handleDateFromChange = (date) => {
    const adjustedDate = new Date(date);
    adjustedDate.setHours(0, 0, 0, 0);
    setDateFrom(adjustedDate);
    setTimeRangeFilter("custom");
  };

  const handleDateToChange = (date) => {
    const adjustedDate = new Date(date);
    adjustedDate.setHours(23, 59, 59, 999);
    setDateTo(adjustedDate);
    setTimeRangeFilter("custom");
  };
  // Apply time range filter
  useEffect(() => {
    if (timeRangeFilter === "custom") {
      // No change to dates, use the custom date picker values
      return;
    }

    const now = new Date();
    let newDateFrom, newDateTo;

    switch (timeRangeFilter) {
      case "today":
        newDateFrom = new Date(now.setHours(0, 0, 0, 0));
        newDateTo = new Date(now.setHours(23, 59, 59, 999));
        setDateGrouping("hour");
        break;
      case "yesterday":
        newDateFrom = new Date(now);
        newDateFrom.setDate(now.getDate() - 1);
        newDateFrom.setHours(0, 0, 0, 0);
        newDateTo = new Date(newDateFrom);
        newDateTo.setHours(23, 59, 59, 999);
        setDateGrouping("hour");
        break;
      case "thisMonth":
        newDateFrom = new Date(now.getFullYear(), now.getMonth(), 1); // Fixed to 1st day
        newDateTo = new Date(now);
        newDateTo.setHours(23, 59, 59, 999);
        break;
      case "lastWeek":
        // Correct last week calculation
        const lastMonday = new Date(now);
        lastMonday.setDate(now.getDate() - now.getDay() - 6); // Previous Monday
        lastMonday.setHours(0, 0, 0, 0);
        const lastSunday = new Date(lastMonday);
        lastSunday.setDate(lastMonday.getDate() + 6);
        lastSunday.setHours(23, 59, 59, 999);
        newDateFrom = lastMonday;
        newDateTo = lastSunday;
        break;
      case "lastYear":
        newDateFrom = new Date(now.getFullYear() - 1, 0, 1); // Jan 1 of last year
        newDateTo = new Date(now);
        break;
      default:
        return;
    }

    setDateFrom(newDateFrom);
    setDateTo(newDateTo);
  }, [timeRangeFilter]);

  useEffect(() => {
    const fetchLeadSources = async () => {
      const querySnapshot = await getDocs(collection(db, "leads"));
      const sources = querySnapshot.docs.map((doc) => doc.data().leadName);
      setLeadSources(["All", ...new Set(sources)]);
    };
    fetchLeadSources();
  }, []);

  // Updated: Determine appropriate date grouping based on date range
  useEffect(() => {
    // Only set date grouping if not already set by time range filter
    if (timeRangeFilter !== "today" && timeRangeFilter !== "yesterday") {
      const daysDifference = Math.ceil(
        (dateTo - dateFrom) / (1000 * 60 * 60 * 24)
      );

      let newGrouping = "day";

      if (daysDifference <= 2) {
        newGrouping = "hour"; // For 1-2 day differences, show hourly data
      } else if (daysDifference > 730) {
        // 2 years (365*2)
        newGrouping = "year"; // For more than 2 years, show yearly data
      } else if (daysDifference > 90) {
        newGrouping = "month"; // For more than 90 days, show monthly data
      }

      setDateGrouping(newGrouping);
    }
  }, [dateFrom, dateTo, timeRangeFilter]);

  // Helper function to format dates based on grouping
  // Update the formatDate function to account for timezone offset
  const formatDate = (date, grouping) => {
    const d = new Date(date);

    if (grouping === "hour") {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(d.getDate()).padStart(2, "0")} ${String(
        d.getHours()
      ).padStart(2, "0")}:00`;
    } else if (grouping === "day") {
      // Use local date components
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(d.getDate()).padStart(2, "0")}`;
    } else if (grouping === "month") {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    } else if (grouping === "year") {
      return `${d.getFullYear()}`;
    }
  };
  // Improved getDisplayFormat for better hour display with AM/PM
  const getDisplayFormat = (dateStr, grouping) => {
    if (grouping === "hour") {
      // Extract the hour part and format it as "12:00 PM" using Date object
      // to ensure proper timezone handling
      const [datePart, timePart] = dateStr.split(" ");
      const [year, month, day] = datePart.split("-");
      const [hourStr] = timePart.split(":");
      const hour = parseInt(hourStr, 10);

      // Create a date object using local components to avoid timezone issues
      const localDate = new Date(year, month - 1, day, hour);

      return localDate
        .toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
        .replace(":00", "");
    } else if (grouping === "day") {
      return new Date(dateStr).toLocaleDateString();
    } else if (grouping === "month") {
      const [year, month] = dateStr.split("-");
      return `${new Date(year, month - 1).toLocaleString("default", {
        month: "short",
      })} ${year}`;
    } else {
      return dateStr;
    }
  };

  // Generate date range based on grouping
  // Generate date range based on grouping
  const generateDateRange = (start, end, grouping) => {
    const dates = [];
    const startDate = new Date(start);
    const endDate = new Date(end);

    if (grouping === "year") {
      const startYear = startDate.getFullYear();
      const endYear = endDate.getFullYear();
      for (let year = startYear; year <= endYear; year++) {
        dates.push(year.toString());
      }
    } else if (grouping === "month") {
      const startYear = startDate.getFullYear();
      const startMonth = startDate.getMonth();
      const endYear = endDate.getFullYear();
      const endMonth = endDate.getMonth();

      let currentYear = startYear;
      let currentMonth = startMonth;

      while (
        currentYear < endYear ||
        (currentYear === endYear && currentMonth <= endMonth)
      ) {
        dates.push(
          `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`
        );
        if (currentMonth === 11) {
          currentYear++;
          currentMonth = 0;
        } else {
          currentMonth++;
        }
      }
    } else if (grouping === "hour") {
      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        dates.push(formatDate(currentDate, "hour"));
        currentDate.setHours(currentDate.getHours() + 1);
      }
    } else {
      // Default to day grouping
      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        dates.push(formatDate(currentDate, "day"));
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    return dates;
  };

  // useEffect(() => {
  //   const dateRange = generateDateRange(dateFrom, dateTo, dateGrouping);
  //   console.log("Generated Date Range:", dateRange);
  // }, [dateFrom, dateTo, dateGrouping]);
  useEffect(() => {
    if (chartData.series.length === 0) return;

    let newConversionRate = 0;
    let newSalePerLead = 0;

    const conversionSeries = chartData.series.find(
      (s) => s.name === "Conversion Rate"
    );
    const salePerLeadSeries = chartData.series.find(
      (s) => s.name === "Cost Per Sale"
    );

    if (conversionSeries) {
      newConversionRate = conversionSeries.data.reduce(
        (sum, val) => sum + parseFloat(val || 0),
        0
      );
    }

    if (salePerLeadSeries) {
      newSalePerLead = salePerLeadSeries.data.reduce(
        (sum, val) => sum + parseFloat(val || 0),
        0
      );
    }

    setSummaryStats((prev) => ({
      ...prev,
      conversionRate: newConversionRate.toFixed(2),
      costPerSale: newSalePerLead.toFixed(2),
    }));
  }, [chartData]); // Runs when chartData changes

  useEffect(() => {
    const fetchData = async () => {
      const leadsSnapshot = await getDocs(collection(db, "employees"));
      const salesSnapshot = await getDocs(collection(db, "sales"));

      let leadsData = {};
      let salesData = {};
      let leadAmountData = {};
      let leadCostData = {};
      let leadsBySource = {};
      let salesBySource = {};
      const start = dateFrom.getTime();
      const end = dateTo.getTime();
      let totalLeads = 0;
      let totalSales = 0;
      let totalLeadAmount = 0;
      let totalLeadCost = 0;
      // Generate all dates between start and end based on grouping
      const dateRange = generateDateRange(dateFrom, dateTo, dateGrouping);
      // Collect leads, lead amounts, and lead costs
      leadsSnapshot.forEach((doc) => {
        const employeeLeads = doc.data().leads || [];
        employeeLeads.forEach((lead) => {
          const leadTime = lead.timestamp.seconds * 1000;
          if (leadTime >= start && leadTime <= end) {
            const leadSource = lead.leadSource || "Unknown";

            // Track total leads by source
            leadsBySource[leadSource] = (leadsBySource[leadSource] || 0) + 1;

            if (
              selectedLeadSource === "All" ||
              leadSource === selectedLeadSource
            ) {
              // Create a Date object with the exact timestamp
              const leadTime = lead.timestamp.seconds * 1000; // Convert to milliseconds
              const exactDate = new Date(leadTime);
              const dateStr = formatDate(exactDate, dateGrouping);

              // Now dateStr will contain the exact hour information
              leadsData[dateStr] = (leadsData[dateStr] || 0) + 1;
              totalLeads++;

              // Add lead amount to total
              totalLeadAmount += lead.leadAmount;

              // Sum lead amounts for each date
              leadAmountData[dateStr] =
                (leadAmountData[dateStr] || 0) + lead.leadAmount;

              // Calculate total lead cost (lead amount * lead cost)
              const leadCost = lead.leadAmount * lead.leadCost;
              totalLeadCost += leadCost;
              leadCostData[dateStr] = (leadCostData[dateStr] || 0) + leadCost;
            }
          }
        });
      });

      // Collect sales
      // Collect sales - updated to handle "HH:MM:SS" format
      salesSnapshot.forEach((doc) => {
        const salesArray = doc.data().sales || [];
        salesArray.forEach((sale) => {
          // Handle the case where saleTime comes as a time string
          let saleTime;

          if (sale.saleDate && sale.saleTime) {
            const [day, monthStr, year] = sale.saleDate.split(" "); // "06 March 2025"
            const months = {
              January: 0,
              February: 1,
              March: 2,
              April: 3,
              May: 4,
              June: 5,
              July: 6,
              August: 7,
              September: 8,
              October: 9,
              November: 10,
              December: 11,
            };

            const [hours, minutes, seconds] = sale.saleTime
              .split(":")
              .map(Number);
            const saleDateObj = new Date(
              year,
              months[monthStr],
              Number(day),
              hours,
              minutes,
              seconds
            );

            saleTime = saleDateObj.getTime(); // Correct timestamp
          } else if (
            typeof sale.saleTime === "string" &&
            sale.saleTime.match(/\d{1,2}:\d{2}:\d{2}/)
          ) {
            // Handle time string format like "17:20:02"
            const [hours, minutes, seconds] = sale.saleTime
              .split(":")
              .map(Number);

            // Create date with today's date and the specific time
            const today = new Date();
            const saleDate = new Date(
              today.getFullYear(),
              today.getMonth(),
              today.getDate(),
              hours,
              minutes,
              seconds
            );

            saleTime = saleDate.getTime();
          } else {
            // Fallback in case the time format is unexpected
            console.warn("Unexpected sale time format:", sale.saleTime);
            return; // Skip this sale record
          }

          if (saleTime >= start && saleTime <= end) {
            const leadSource = sale.leadSource?.trim() || "Unknown";

            // Track total sales by source
            salesBySource[leadSource] = (salesBySource[leadSource] || 0) + 1;

            if (
              selectedLeadSource === "All" ||
              leadSource === selectedLeadSource
            ) {
              // Create a Date object with the exact timestamp
              const exactDate = new Date(saleTime);
              const dateStr = formatDate(exactDate, dateGrouping);

              // Now dateStr will contain the exact hour information
              salesData[dateStr] = (salesData[dateStr] || 0) + 1;
              totalSales++;
            }
          }
        });
      });
      setSummaryStats({
        totalLeads,
        totalSales,
        conversionRate: TotalConversionRate,
        costPerSale: TotalSalePerLead,
      });
      // Prepare series data for full date range
      const seriesDataLeads = dateRange.map((date) => leadsData[date] || 0);
      const seriesDataSales = dateRange.map((date) => salesData[date] || 0);
      const seriesDataConversionRate = dateRange.map((date) => {
        const leadAmount = leadAmountData[date] || 0;
        const sales = salesData[date] || 0;
        return leadAmount > 0 ? ((sales / leadAmount) * 100).toFixed(2) : 0;
      });
      const seriesDataCostPerSale = dateRange.map((date) => {
        const leadCost = leadCostData[date] || 0;
        const sales = salesData[date] || 0;
        return sales > 0 ? (leadCost / sales).toFixed(2) : 0;
      });

      // Find the maximum lead count for any individual date
      const maxLeadsPerDay = Math.max(
        ...Object.values(leadsData).map(Number),
        1
      );

      // Find the maximum sale count for any individual date
      const maxSalesPerDay = Math.max(
        ...Object.values(salesData).map(Number),
        1
      );

      // Find highest lead source count (which lead source has the most leads)
      const maxLeadsBySource = Math.max(
        ...Object.values(leadsBySource).map(Number),
        1
      );

      // Find highest sales source count
      const maxSalesBySource = Math.max(
        ...Object.values(salesBySource).map(Number),
        1
      );

      // Dynamic Y-axis for Total Leads
      const leadsMin = 0;
      const leadsMax = Math.max(maxLeadsPerDay, maxLeadsBySource) * 1.2; // Add 20% padding
      const leadsTickAmount = Math.min(
        10,
        Math.max(5, Math.ceil(leadsMax / 5))
      );

      // Dynamic Y-axis for Total Sales
      const salesMin = 0;
      const salesMax = Math.max(maxSalesPerDay, maxSalesBySource) * 1.2; // Add 20% padding
      const salesTickAmount = Math.min(
        10,
        Math.max(5, Math.ceil(salesMax / 5))
      );

      // Dynamic Y-axis for Cost Per Sale
      const costPerSaleValues = seriesDataCostPerSale
        .map(Number)
        .filter((val) => val > 0);
      const minCostPerSale = costPerSaleValues.length
        ? Math.min(...costPerSaleValues) * 0.8 // 20% lower padding
        : 0;
      const maxCostPerSale = costPerSaleValues.length
        ? Math.max(...costPerSaleValues) * 1.2 // 20% upper padding
        : 100;
      const costPerSaleTickAmount = Math.min(
        10,
        Math.max(5, Math.ceil((maxCostPerSale - minCostPerSale) / 5))
      );

      // Create display labels for x-axis
      const displayDates = dateRange.map((date) =>
        getDisplayFormat(date, dateGrouping)
      );

      // Get time range text for chart title
      let timeRangeText;
      if (timeRangeFilter !== "custom") {
        const option = timeRangeOptions.find(
          (opt) => opt.value === timeRangeFilter
        );
        timeRangeText = option ? option.label : "Custom Range";
      } else {
        timeRangeText = `${dateFrom.toLocaleDateString()} - ${dateTo.toLocaleDateString()}`;
      }

      setChartData((prevState) => ({
        ...prevState,
        series: [
          {
            name: "Total Leads",
            type: "column",
            data: seriesDataLeads,
          },
          {
            name: "Total Sales",
            type: "column",
            data: seriesDataSales,
          },
          {
            name: "Conversion Rate",
            type: "column",
            data: seriesDataConversionRate,
          },
          {
            name: "Cost Per Sale",
            type: "column",
            data: seriesDataCostPerSale,
          },
        ],
        options: {
          ...prevState.options,
          chart: {
            ...prevState.options.chart,
            toolbar: {
              show: true,
              tools: {
                download: true,
                selection: true,
                zoom: true,
                zoomout: true,
                pan: true,
                reset: true,
              },
              export: {
                csv: {
                  filename: `Sales_Analysis_${timeRangeText.replace(
                    / /g,
                    "_"
                  )}`,
                  columnDelimiter: ",",
                },
                svg: {
                  filename: `Sales_Analysis_${timeRangeText.replace(
                    / /g,
                    "_"
                  )}`,
                },
                png: {
                  filename: `Sales_Analysis_${timeRangeText.replace(
                    / /g,
                    "_"
                  )}`,
                },
              },
            },
          },
          title: {
            text: `Sales Leads Analysis - ${timeRangeText}`,
            align: "center",
            margin: 10,
            offsetY: 10,
            style: {
              fontSize: "18px",
              fontWeight: "bold",
              color: "#1f2937",
            },
          },
          subtitle: {
            text:
              selectedLeadSource !== "All"
                ? `Lead Source: ${selectedLeadSource}`
                : "All Lead Sources",
            align: "center",
            margin: 5,
            offsetY: 35,
            style: {
              fontSize: "14px",
              color: "#4b5563",
            },
          },
          xaxis: {
            ...prevState.options.xaxis,
            categories: displayDates,
            title: {
              ...prevState.options.xaxis.title,
              text: `Date (${
                dateGrouping === "hour" ? "hourly" : dateGrouping
              } view)`,
            },
          },
          yaxis: [
            {
              ...prevState.options.yaxis[0],
              min: leadsMin,
              max: leadsMax,
              tickAmount: leadsTickAmount,
              title: {
                ...prevState.options.yaxis[0].title,
                text: `Total Leads`,
              },
              labels: {
                ...prevState.options.yaxis[0].labels,
                formatter: (value) => Math.round(value),
              },
              // Adding specific grid styling for first y-axis
              axisBorder: {
                show: true,
                color: "#00c22a",
                width: 2,
              },
              axisTicks: {
                show: true,
                color: "#00c22a",
              },
            },
            {
              ...prevState.options.yaxis[1],
              min: salesMin,
              max: salesMax,
              tickAmount: salesTickAmount,
              title: {
                ...prevState.options.yaxis[1].title,
                text: `Total Sales`,
              },
              labels: {
                ...prevState.options.yaxis[1].labels,
                formatter: (value) => Math.round(value),
              },
              // Adding specific grid styling for second y-axis
              axisBorder: {
                show: true,
                color: "#0a99ff",
                width: 2,
              },
              axisTicks: {
                show: true,
                color: "#0a99ff",
              },
            },
            {
              ...prevState.options.yaxis[2],
              // Adding specific grid styling for third y-axis
              axisBorder: {
                show: true,
                color: "#FFC107",
                width: 2,
              },
              axisTicks: {
                show: true,
                color: "#FFC107",
              },
            },
            {
              ...prevState.options.yaxis[3],
              min: minCostPerSale,
              max: maxCostPerSale,
              tickAmount: costPerSaleTickAmount,
              // Adding specific grid styling for fourth y-axis
              axisBorder: {
                show: true,
                color: "#ff0008",
                width: 2,
              },
              axisTicks: {
                show: true,
                color: "#ff0008",
              },
            },
          ],
          grid: {
            show: true,
            borderColor: "#e5e7eb",
            strokeDashArray: 5,
            position: "back",
            xaxis: {
              lines: {
                show: true,
              },
            },
            yaxis: {
              lines: {
                show: true,
              },
            },
            padding: {
              right: 10,
              left: 10,
            },
          },
        },
      }));
    };
    fetchData();
  }, [dateFrom, dateTo, selectedLeadSource, dateGrouping]);

  // Handler for custom date inputs to reset time range filter
  const handleCustomDateChange = (date, isFrom) => {
    if (timeRangeFilter !== "custom") {
      setTimeRangeFilter("custom");
    }

    if (isFrom) {
      setDateFrom(date); // Use the full date object with time set to 00:00:00
    } else {
      setDateTo(date); // Use the full date object with time set to 23:59:59
    }
  };
  const getStatsTitle = () => {
    if (timeRangeFilter !== "custom") {
      const option = timeRangeOptions.find(
        (opt) => opt.value === timeRangeFilter
      );
      return `${option?.label || "Custom"} Stats`;
    } else {
      return "Custom Range Stats";
    }
  };
  return (
    <div className="w-full rounded-lg px-4 py-6">
      <div className="flex flex-wrap gap-10 mb-4">
        {/* Time Range Preset Filter */}

        <div className="flex flex-col gap-2">
          <label className="block text-gray-700 text-sm font-medium mb-1">
            Time Range:
          </label>
          <div className="min-w-[200px]">
            <Menu as="div" className="relative inline-block text-left w-full">
              <Menu.Button className="w-full flex items-center justify-between bg-white border border-gray-300 rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm">
                {getTimeRangeLabel(timeRangeFilter)}
                <IoChevronDown className="ml-2 h-4 w-4" />
              </Menu.Button>
              <Menu.Items className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                {timeRangeOptions.map((option) => (
                  <Menu.Item key={option.value}>
                    {({ active }) => (
                      <button
                        className={`${
                          active ? "bg-blue-100 text-blue-900" : "text-gray-900"
                        } group flex w-full items-center px-4 py-2 text-sm ${
                          timeRangeFilter === option.value
                            ? "bg-gray-100 font-medium"
                            : ""
                        }`}
                        onClick={() => {
                          setTimeRangeFilter(option.value);
                        }}
                      >
                        {option.label}
                      </button>
                    )}
                  </Menu.Item>
                ))}
              </Menu.Items>
            </Menu>
          </div>
        </div>
        {/* Custom Date Inputs (only shown when custom filter is selected) */}
        {/* {timeRangeFilter !== "custom" ? (
          ""
        ) : (
          <div
            className={`flex gap-6 ${
              timeRangeFilter !== "custom" ? "opacity-50" : ""
            }`}
          >
            <div className="flex flex-col gap-2">
              <label className="block text-gray-700 text-sm font-medium mb-1">
                Date From:
              </label>
              <input
                type="date"
                value={dateFrom.toISOString().split("T")[0]}
                onChange={(e) => handleCustomDateChange(e.target.value, true)}
                className="border p-2 rounded text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                disabled={timeRangeFilter !== "custom"}
              />{" "}
            </div>
            <div className="flex flex-col gap-2">
              <label className="block text-gray-700 text-sm font-medium mb-1">
                Date To:
              </label>
              <input
                type="date"
                value={dateTo.toISOString().split("T")[0]}
                onChange={(e) => handleCustomDateChange(e.target.value, false)}
                className="border p-2 rounded text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                disabled={timeRangeFilter !== "custom"}
              />{" "}
            </div>
          </div>
        )} */}
        <CustomDateRangePicker
          timeRangeFilter={timeRangeFilter}
          dateFrom={dateFrom}
          dateTo={dateTo}
          handleCustomDateChange={handleCustomDateChange}
        />
        {/* Lead Source Filter */}
        <div className="flex flex-col gap-2">
          <label className="block text-gray-700 text-sm font-medium mb-1">
            Lead Source:
          </label>
          <Menu
            as="div"
            className="relative inline-block text-left min-w-[200px]"
          >
            <Menu.Button className="w-full flex items-center justify-between bg-white border border-gray-300 rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm">
              {selectedLeadSource}
              <IoChevronDown className="ml-2 h-4 w-4" />
            </Menu.Button>
            <Menu.Items className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
              {leadSources.map((source) => (
                <Menu.Item key={source}>
                  {({ active }) => (
                    <button
                      className={`${
                        active ? "bg-blue-100 text-blue-900" : "text-gray-900"
                      } group flex w-full items-center px-4 py-2 text-sm ${
                        selectedLeadSource === source
                          ? "bg-gray-100 font-medium"
                          : ""
                      }`}
                      onClick={() => setSelectedLeadSource(source)}
                    >
                      {source}
                    </button>
                  )}
                </Menu.Item>
              ))}
            </Menu.Items>
          </Menu>
        </div>
        {/* Current View Indicator */}
      </div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          {getStatsTitle()}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-100 hover:shadow-lg transition-shadow">
            <div className="p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold text-gray-500">
                  Total Leads
                </h3>
                <div className="p-2 bg-green-100 rounded-full">
                  <FaUsers className="text-green-600 text-lg" />
                </div>
              </div>
              <div className="flex items-end">
                <span className="text-2xl font-bold text-gray-800">
                  {summaryStats.totalLeads.toLocaleString()}
                </span>
                <span className="text-xs text-gray-500 ml-2 mb-1">leads</span>
              </div>
            </div>
            <div className="h-1 w-full bg-green-500"></div>
          </div>

          <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-100 hover:shadow-lg transition-shadow">
            <div className="p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold text-gray-500">
                  Total Sales
                </h3>
                <div className="p-2 bg-blue-100 rounded-full">
                  <FaChartLine className="text-blue-600 text-lg" />
                </div>
              </div>
              <div className="flex items-end">
                <span className="text-2xl font-bold text-gray-800">
                  {summaryStats.totalSales.toLocaleString()}
                </span>
                <span className="text-xs text-gray-500 ml-2 mb-1">sales</span>
              </div>
            </div>
            <div className="h-1 w-full bg-blue-500"></div>
          </div>

          <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-100 hover:shadow-lg transition-shadow">
            <div className="p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold text-gray-500">
                  Conversion Rate
                </h3>
                <div className="p-2 bg-yellow-100 rounded-full">
                  <FaExchangeAlt className="text-yellow-600 text-lg" />
                </div>
              </div>
              <div className="flex items-end">
                <span className="text-2xl font-bold text-gray-800">
                  {summaryStats.conversionRate}%
                </span>
                <span className="text-xs text-gray-500 ml-2 mb-1">
                  conversion
                </span>
              </div>
            </div>
            <div className="h-1 w-full bg-yellow-500"></div>
          </div>

          <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-100 hover:shadow-lg transition-shadow">
            <div className="p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold text-gray-500">
                  Cost Per Sale
                </h3>
                <div className="p-2 bg-red-100 rounded-full">
                  <FaDollarSign className="text-red-600 text-lg" />
                </div>
              </div>
              <div className="flex items-end">
                <span className="text-2xl font-bold text-gray-800">
                  ${parseFloat(summaryStats.costPerSale).toLocaleString()}
                </span>
                <span className="text-xs text-gray-500 ml-2 mb-1">
                  per sale
                </span>
              </div>
            </div>
            <div className="h-1 w-full bg-red-500"></div>
          </div>
        </div>
      </div>
      <div id="chart">
        <ReactApexChart
          options={chartData.options}
          series={chartData.series}
          type="line"
          height={500}
          className="w-full bg-white"
        />
      </div>
    </div>
  );
};

export default SalesAnalysisChart;
