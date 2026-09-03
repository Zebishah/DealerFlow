import {
  Box,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Tooltip,
} from "@mui/material";
// import MonthlyFinanceProviderAnalytics from "../components/FinanceProviderAnalytics";
// import MonthlyLeadSourceAnalytics from "../components/MonthlyLeadSourceAnalytics";
// import SalePersonMonthlyAnalytics from "../components/MonthlySalePersonAnalytics";
import { FaCalendar, FaPencil, FaSatellite } from "react-icons/fa6";
import { useEffect, useState } from "react";
import SalesTrackingTable from "../components/SalesTrackingTable";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../../config/firebaseConfig";
import { FaSave } from "react-icons/fa";
import { toast } from "react-toastify";
import logo from "../../../images/logo.png";
import { useSalesData } from "../../../SalesDataContext";
import { useAuth } from "../../../AuthContext";
import MonthlyPerformanceChart from "../components/MonthlyPerformanceChart";
const MonthlyWholeSaleAnalytics = ({ allSales, setAllSales, isEmployee }) => {
  const { currentUser } = useAuth();
  const {
    salesData,
    loading,
    selectedMonth: selectedMonthFromContext,
    setSelectedMonth: setSelectedMonthFromContext,
  } = useSalesData();
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
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedSalesperson, setSelectedSalesperson] = useState("All");
  const [salespeople, setSalespeople] = useState([]);
  const [filteredSales, setFilteredSales] = useState([]);
  const [monthlyTargets, setMonthlyTargets] = useState(0);
  const [editingField, setEditingField] = useState(null);
  const [tempUnits, setTempUnits] = useState("");
  const [tempGross, setTempGross] = useState("");
  const [targetAchieved, setTargetAchieved] = useState(0);
  const [grossAchieved, setGrossAchieved] = useState(0);
  const [monthlyUnitsTarget, setMonthlyUnitsTarget] = useState(0);
  const [monthlyGrossTarget, setMonthlyGrossTarget] = useState(0);
  const [salesStats, setSalesStats] = useState({
    totalSales: 0,
    totalSalesPrice: 0,
    totalTrueGross: 0,
  });
  const [isOutOfSync, setIsOutOfSync] = useState(false);
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [leadSources, setLeadSources] = useState(["All"]); // Start with "All" option
  const [selectedLeadSource, setSelectedLeadSource] = useState("All");
  const [timeFilter, setTimeFilter] = useState("monthly"); // 'monthly' or 'yearly'

  useEffect(() => {
    const fetchSalespeople = async () => {
      try {
        const employeesSnapshot = await getDocs(collection(db, "employees"));
        const salespeoplelist = [];

        employeesSnapshot.forEach((doc) => {
          const employeeData = doc.data();
          salespeoplelist.push({
            id: employeeData.uid,
            name: employeeData.name || `Employee ${doc.id}`,
          });
        });

        setSalespeople(salespeoplelist);
      } catch (error) {
        console.error("Error fetching salespeople:", error);
      }
    };
    if (!isEmployee) {
      fetchSalespeople();
    }
  }, []);

  useEffect(() => {
    const fetchLeadSources = async () => {
      try {
        const leadsSnapshot = await getDocs(collection(db, "leads"));
        const sources = new Set(["All"]); // Start with "All" option

        leadsSnapshot.forEach((doc) => {
          const leadData = doc.data();
          if (leadData.leadName) {
            sources.add(leadData.leadName);
          }
        });

        setLeadSources(Array.from(sources));
      } catch (error) {
        console.error("Error fetching lead sources:", error);
      }
    };

    fetchLeadSources();
  }, []);

  const formatDisplayDate = (date) => {
    return date.toLocaleDateString("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };
  // Prepare date range for display
  const startDate = new Date(selectedYear, selectedMonth, 1);
  const endDate = new Date(selectedYear, selectedMonth + 1, 0);
  const handleMonthChange = (e) => {
    // parse the zero-based month index
    const monthIndex = parseInt(e.target.value, 10);
    setSelectedMonth(monthIndex);

    // build YYYY-MM (monthIndex 3 → "04")
    const monthNumber = monthIndex + 1;
    const isoMonth = `${selectedYear}-${String(monthNumber).padStart(2, "0")}`;

    setSelectedMonthFromContext(isoMonth);
  };
  useEffect(() => {
    if (selectedSalesperson === "All") {
      const currentAchieved = salesStats.totalSales;
      const savedAchieved = targetAchieved ?? currentAchieved;
      setIsOutOfSync(currentAchieved !== savedAchieved);
    } else {
      setIsOutOfSync(false); // Only sync for "All" salesperson view
    }
  }, [salesStats.totalSales, targetAchieved, selectedSalesperson]);

  // Handle year change
  const handleYearChange = (e) => {
    const newYear = parseInt(e.target.value, 10);
    setSelectedYear(newYear);

    // Build YYYY-MM format for context
    const monthNumber = selectedMonth + 1;
    const isoMonth = `${newYear}-${String(monthNumber).padStart(2, "0")}`;

    setSelectedMonthFromContext(isoMonth);
  };

  const handleLeadSourceChange = (e) => {
    setSelectedLeadSource(e.target.value);
  };

  const handleTimeFilterChange = (e) => {
    setTimeFilter(e.target.value);
  };

  const updateAchievedTargets = async () => {
    const monthId = `${selectedYear}-${String(selectedMonth + 1).padStart(
      2,
      "0"
    )}`;
    const docRef = doc(db, "monthlyTargetAnalytics", monthId);

    try {
      await setDoc(
        docRef,
        {
          wholesale: {
            MonthlyTargetAchieved: salesStats.totalSales,
            MonthlyGrossAchieved: salesStats.totalSalesPrice,
          },
        },
        { merge: true }
      );

      setTargetAchieved(salesStats.totalSales);
      setGrossAchieved(salesStats.totalSalesPrice);
      toast.success(
        "updated the achieved Targets to make it synced with saved data...."
      );
      setIsOutOfSync(false);
    } catch (error) {
      console.error("Error updating achieved targets:", error);
    }
  };
  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const startYear = 1900;
    const endYear = currentYear; // Include 5 years into the future

    // Create array with all years from 1900 to current year + 5
    return Array.from(
      { length: endYear - startYear + 1 },
      (_, i) => startYear + i
    ).reverse(); // Show most recent years first
  };

  const handleSalespersonChange = (event) => {
    setSelectedSalesperson(event.target.value);
  };

  // useEffect(() => {
  //   const filterSalesByDate = (sales, month, year) => {
  //     return sales.filter((sale) => {
  //       const date = new Date(sale.saleDate);
  //       return date.getMonth() === month && date.getFullYear() === year;
  //     });
  //   };

  //   const filterSalesBySalesperson = (sales, selectedValue) => {
  //     if (selectedValue === "All") return sales;

  //     // Filter sales where the document ID matches the selected salesperson ID
  //     return sales.filter((sale) => {
  //       // Compare the sale's associated ID with the selected salesperson ID
  //       return sale.userId === selectedValue;
  //     });
  //   };

  //   const calculateSalesStats = (sales) => {
  //     const totalSales = sales.length;
  //     const totalSalesPrice = sales.reduce(
  //       (acc, curr) => acc + parseFloat(curr.salesGross || 0),
  //       0
  //     );
  //     const totalTrueGross = sales.reduce(
  //       (acc, curr) => acc + parseFloat(curr.trueGross || 0),
  //       0
  //     );
  //     return { totalSales, totalSalesPrice, totalTrueGross };
  //   };

  //   const applyFilters = () => {
  //     // First filter by date
  //     const dateFiltered = filterSalesByDate(
  //       allSales,
  //       selectedMonth,
  //       selectedYear
  //     );

  //     // Then filter by salesperson
  //     const finalFiltered = filterSalesBySalesperson(
  //       dateFiltered,
  //       selectedSalesperson
  //     );

  //     setFilteredSales(finalFiltered);

  //     // Calculate statistics for the filtered sales
  //     const stats = calculateSalesStats(finalFiltered);
  //     setSalesStats(stats);
  //   };

  //   applyFilters();
  // }, [allSales, selectedMonth, selectedYear, selectedSalesperson]);

  useEffect(() => {
    const filterSalesByDate = (sales, month, year, period) => {
      return sales.filter((sale) => {
        const date = new Date(sale.saleDate);
        if (period === "yearly") {
          return date.getFullYear() === year;
        } else {
          return date.getMonth() === month && date.getFullYear() === year;
        }
      });
    };

    const filterSalesBySalesperson = (sales, selectedValue) => {
      if (selectedValue === "All") return sales;
      return sales.filter((sale) => sale.userId === selectedValue);
    };

    const filterSalesByLeadSource = (sales, selectedSource) => {
      if (selectedSource === "All") return sales;
      return sales.filter((sale) => sale.leadSource === selectedSource);
    };

    const calculateSalesStats = (sales) => {
      const totalSales = sales.length;
      const totalSalesPrice = sales.reduce(
        (acc, curr) => acc + parseFloat(curr.salesGross || 0),
        0
      );
      const totalTrueGross = sales.reduce(
        (acc, curr) => acc + parseFloat(curr.trueGross || 0),
        0
      );
      return { totalSales, totalSalesPrice, totalTrueGross };
    };

    const applyFilters = () => {
      // Step 1: Date filter based on time period
      const dateFiltered = filterSalesByDate(
        allSales,
        selectedMonth,
        selectedYear,
        timeFilter
      );

      // Step 2: Salesperson filter
      const salespersonFiltered = filterSalesBySalesperson(
        dateFiltered,
        selectedSalesperson
      );

      // Step 3: Lead source filter
      const finalFiltered = filterSalesByLeadSource(
        salespersonFiltered,
        selectedLeadSource
      );

      // Update state
      setFilteredSales(finalFiltered);

      // Step 4: Update statistics
      const stats = calculateSalesStats(finalFiltered);
      setSalesStats(stats);
    };

    applyFilters();
  }, [
    allSales,
    selectedMonth,
    selectedYear,
    selectedSalesperson,
    selectedLeadSource,
    timeFilter,
  ]);

  const getMonthlyTargets = async (year, month, selectedUserId = null) => {
    const monthId = `${year}-${String(month + 1).padStart(2, "0")}`;
    const docRef = doc(db, "monthlyTargetAnalytics", monthId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return {
        totalTarget: 0,
        totalGrossTarget: 0,
        achievedTarget: undefined,
        achievedGross: undefined,
        userTarget: 0,
        userGrossTarget: 0,
      };
    }

    const data = docSnap.data();
    const allData = data.wholesale || {};

    // Use undefined if the fields are not present
    const totalTarget = allData.MonthlyTarget ?? 0;
    const totalGrossTarget = allData.MonthlyGrossTarget ?? 0;
    const achievedTarget = allData.MonthlyTargetAchieved;
    const achievedGross = allData.MonthlyGrossAchieved;

    const userData = data[selectedUserId] || {};
    const userTarget = userData.target ?? 0;
    const userGrossTarget = userData.grossTarget ?? 0;

    return {
      totalTarget,
      totalGrossTarget,
      achievedTarget,
      achievedGross,
      userTarget,
      userGrossTarget,
    };
  };

  useEffect(() => {
    const loadTargets = async () => {
      if (isEmployee && salesData) {
        // Find the current employee's data

        const employeeData = salesData?.find(
          (data) => data.userId === currentUser?.uid
        );

        if (employeeData) {
          // Set targets from salesData
          setMonthlyUnitsTarget(employeeData.target || 0);
          setMonthlyGrossTarget(employeeData.grossTarget || 0);

          // Calculate achieved values from filtered sales
          const achieved = {
            units: salesStats.totalSales,
            gross: salesStats.totalSalesPrice,
          };

          setTargetAchieved(achieved.units);
          setGrossAchieved(achieved.gross);
        } else {
          // Reset values if no data found
          setMonthlyUnitsTarget(0);
          setMonthlyGrossTarget(0);
          setTargetAchieved(0);
          setGrossAchieved(0);
        }
      } else {
        // Existing admin logic
        const userId =
          selectedSalesperson === "All" ? null : selectedSalesperson;
        const {
          totalTarget,
          totalGrossTarget,
          achievedTarget,
          achievedGross,
          userTarget,
          userGrossTarget,
        } = await getMonthlyTargets(selectedYear, selectedMonth, userId);

        if (userId) {
          setMonthlyUnitsTarget(userTarget);
          setMonthlyGrossTarget(userGrossTarget);
          setTargetAchieved(salesStats.totalSales);
          setGrossAchieved(salesStats.totalSalesPrice);
        } else {
          setMonthlyUnitsTarget(totalTarget);
          setMonthlyGrossTarget(totalGrossTarget);
          setTargetAchieved(achievedTarget ?? salesStats.totalSales);
          setGrossAchieved(achievedGross ?? salesStats.totalSalesPrice);
        }
      }
    };

    loadTargets();
  }, [
    selectedMonth,
    selectedYear,
    selectedSalesperson,
    salesStats,
    isEmployee,
    salesData,
    currentUser?.uid,
  ]);
  const handleSave = async () => {
    const monthId = `${selectedYear}-${String(selectedMonth + 1).padStart(
      2,
      "0"
    )}`;
    const docRef = doc(db, "monthlyTargetAnalytics", monthId);

    const baseUpdate = {
      wholesale: {
        MonthlyTarget: monthlyUnitsTarget,
        MonthlyGrossTarget: monthlyGrossTarget,
      },
    };

    // Only update achieved values if "All" is selected
    if (selectedSalesperson === "All") {
      baseUpdate.wholesale.MonthlyTargetAchieved = salesStats.totalSales;
      baseUpdate.wholesale.MonthlyGrossAchieved = salesStats.totalSalesPrice;
    }

    if (editingField === "units") {
      baseUpdate.wholesale.MonthlyTarget = Number(tempUnits);
    } else if (editingField === "gross") {
      baseUpdate.wholesale.MonthlyGrossTarget = Number(tempGross);
    }

    try {
      await setDoc(docRef, baseUpdate, { merge: true });

      setMonthlyUnitsTarget(baseUpdate.wholesale.MonthlyTarget);
      setMonthlyGrossTarget(baseUpdate.wholesale.MonthlyGrossTarget);

      // Update achieved state if "All"
      if (selectedSalesperson === "All") {
        setTargetAchieved(salesStats.totalSales);
        setGrossAchieved(salesStats.totalSalesPrice);
      }

      setEditingField(null);
    } catch (error) {
      console.error("Error saving monthly target:", error);
    }
  };
  // Add after your existing state declarations
  const prepareChartData = () => {
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const yearlyData = monthNames.map((month, index) => {
      const monthSales = allSales.filter((sale) => {
        const saleDate = new Date(sale.saleDate);
        return (
          saleDate.getMonth() === index &&
          saleDate.getFullYear() === selectedYear &&
          (selectedSalesperson === "All" || sale.userId === selectedSalesperson)
        );
      });

      const monthStats = {
        totalSales: monthSales.length,
        totalSalesPrice: monthSales.reduce(
          (acc, curr) => acc + parseFloat(curr.salesGross || 0),
          0
        ),
      };

      return {
        month,
        isCurrentMonth: index === selectedMonth,
        stats: monthStats,
      };
    });

    return {
      labels: monthNames,
      selectedMonthIndex: selectedMonth,
      series: [
        {
          name: "Units Sold",
          type: "column",
          data: yearlyData.map((data) => ({
            x: data.month,
            y: data.stats.totalSales,
          })),
        },
        {
          name: "Sales Gross",
          type: "line",
          data: yearlyData.map((data) => ({
            x: data.month,
            y: data.stats.totalSalesPrice,
          })),
        },
      ],
    };
  };

  const canEdit = !isEmployee && selectedSalesperson;
  return (
    <div className="flex flex-col items-center h-full w-full bg-white px-5">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start w-full  pt-5 pb-3">
        <div className="mb-4 md:mb-0">
          <img src={logo} alt="RightTurn Auto Credit" className="h-16" />
        </div>

        <div className="flex flex-col w-full md:w-auto gap-4 ">
          <div className="flex items-center gap-4 justify-end accent-[#011c64]">
            <h3 className="text-[#011c64] font-semibold">Select Period</h3>
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                className="form-radio text-[#011c64] focus:ring-[#011c64] cursor-pointer"
                name="timeFilter"
                value="monthly"
                checked={timeFilter === "monthly"}
                onChange={() => setTimeFilter("monthly")}
              />
              <span className="ml-2 text-[#011c64]">Monthly</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                className="form-radio text-[#011c64] focus:ring-[#011c64] cursor-pointer"
                name="timeFilter"
                value="yearly"
                checked={timeFilter === "yearly"}
                onChange={() => setTimeFilter("yearly")}
              />
              <span className="ml-2 text-[#011c64]">Yearly</span>
            </label>
          </div>
          <div className="flex flex-col md:flex-row gap-4 justify-end pt-8  ">
            {timeFilter === "monthly" && (
              <FormControl
                className="min-w-full md:w-52"
                size="small"
                variant="outlined"
              >
                <InputLabel id="month-label" className="text-gray-700 bg-white">
                  Select Month
                </InputLabel>
                <Select
                  labelId="month-label"
                  id="month"
                  value={selectedMonth}
                  onChange={handleMonthChange}
                  label="Month"
                  className="bg-white"
                >
                  {months.map((month, index) => (
                    <MenuItem key={index} value={index}>
                      {month}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <FormControl
              className="min-w-full md:w-52"
              size="small"
              variant="outlined"
            >
              <InputLabel id="year-label" className="text-gray-700 bg-white">
                Select Year
              </InputLabel>
              <Select
                labelId="year-label"
                id="year"
                value={selectedYear}
                onChange={handleYearChange}
                label="Year"
                className="bg-white"
              >
                {getYearOptions().map((year) => (
                  <MenuItem key={year} value={year}>
                    {year}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* <FormControl
              className="min-w-full md:w-52"
              size="small"
              variant="outlined"
            >
              <InputLabel id="lead-source-label">Lead Source</InputLabel>
              <Select
                labelId="lead-source-label"
                value={selectedLeadSource}
                onChange={handleLeadSourceChange}
                label="Lead Source"
                className="bg-white"
              >
                {leadSources.map((source) => (
                  <MenuItem key={source} value={source}>
                    {source}
                  </MenuItem>
                ))}
              </Select>
            </FormControl> */}
            {!isEmployee && (
              <div className="flex items-center">
                <span className="text-[#011c64] font-semibold mr-2">
                  Select Salesperson
                </span>
                <FormControl
                  size="small"
                  variant="outlined"
                  className="min-w-32"
                >
                  <Select
                    value={selectedSalesperson}
                    onChange={handleSalespersonChange}
                    className="bg-white"
                  >
                    <MenuItem value="All">All</MenuItem>
                    {salespeople.map((person) => (
                      <MenuItem key={person.id} value={person.id}>
                        {person.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </div>
            )}
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center gap-4 w-full">
            {timeFilter === "monthly" && startDate && endDate && (
              <div className="flex items-center">
                <div className="flex flex-col mr-6">
                  <span className="text-[#011c64] font-semibold">
                    Start Date
                  </span>
                  <span className="text-white-900 font-bold">
                    {formatDisplayDate(startDate)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[#011c64] font-semibold">End Date</span>
                  <span className="text-white-900 font-bold">
                    {formatDisplayDate(endDate)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col w-full max-w-full  my-6">
        {/* Header Row */}
        <div className="flex w-full min-w-full">
          <div className="flex-1 min-w-32 text-left font-bold text-[#011c64]"></div>
          <div className="w-36 md:w-48 lg:w-64 text-center font-bold text-[#011c64]">
            Units Sold
          </div>
          <div className="w-36 md:w-48 lg:w-64 text-center font-bold text-[#011c64]">
            Sales Gross
          </div>
          <div className="w-36 md:w-48 lg:w-64 text-center font-bold text-[#011c64]">
            Total True Gross
          </div>
        </div>

        {/* Target Row */}
        <div className="flex w-full min-w-full items-center my-1">
          <div className="flex-1 min-w-32 text-left font-bold text-[#011c64]">
            Target
          </div>

          {/* UNITS TARGET */}
          <div className="w-36 md:w-48 lg:w-64 bg-white text-[#011c64] font-bold text-center p-1 border border-gray-300">
            {editingField === "units" && canEdit ? (
              <input
                type="number"
                value={tempUnits}
                onChange={(e) => setTempUnits(e.target.value)}
                onBlur={handleSave}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                className="border-2 border-blue-500 px-2 w-full"
                autoFocus
              />
            ) : (
              <div className="flex items-center justify-center">
                {canEdit && (
                  <FaPencil
                    className="cursor-pointer mr-1"
                    onClick={() => {
                      setEditingField("units");
                      setTempUnits(monthlyUnitsTarget);
                    }}
                  />
                )}
                {Number(monthlyUnitsTarget).toFixed(2)}
              </div>
            )}
          </div>

          {/* GROSS TARGET */}
          <div className="w-36 md:w-48 lg:w-64 bg-white text-[#011c64] font-bold text-center p-1 border border-gray-300">
            {editingField === "gross" && canEdit ? (
              <input
                type="number"
                value={tempGross}
                onChange={(e) => setTempGross(e.target.value)}
                onBlur={handleSave}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                className="border-2 border-blue-500 px-2 w-full"
                autoFocus
              />
            ) : (
              <div className="flex items-center justify-center">
                {canEdit && (
                  <FaPencil
                    className="cursor-pointer mr-1"
                    onClick={() => {
                      setEditingField("gross");
                      setTempGross(monthlyGrossTarget);
                    }}
                  />
                )}
                ${Number(monthlyGrossTarget).toFixed(2)}
              </div>
            )}
          </div>
          <div className="w-36 md:w-48 lg:w-64 bg-white text-[#011c64] font-bold text-center p-1"></div>
        </div>
        {/* Month To Date Row */}
        {/* Month To Date Row */}
        <div className="flex w-full min-w-full items-center my-1">
          <div className="flex-1 min-w-32 text-left font-bold text-[#011c64] flex items-center">
            Month To Date
            {isOutOfSync && (
              <Tooltip title="Values out of sync with current sales data">
                <IconButton
                  onClick={updateAchievedTargets}
                  size="small"
                  color="warning"
                  sx={{ marginLeft: 2 }}
                  className="ml-4 flex gap-2 items-center"
                >
                  <FaSave className="text-[#011c64]" />{" "}
                  <p className="text-black text-xs">
                    (Values out of sync with current sales data)
                  </p>
                </IconButton>
              </Tooltip>
            )}
          </div>
          <div className="w-36 md:w-48 lg:w-64 text-white font-bold bg-[#011c64] text-center p-1 border border-gray-300">
            {selectedSalesperson === "All"
              ? salesStats.totalSales.toFixed(2)
              : salesStats.totalSales.toFixed(2)}
            {isOutOfSync && <span className="text-white-300 ml-1">*</span>}
          </div>
          <div className="w-36 md:w-48 lg:w-64 text-white font-bold bg-[#011c64] text-center p-1 border border-gray-300">
            $
            {selectedSalesperson === "All"
              ? salesStats.totalSalesPrice.toFixed(2)
              : salesStats.totalSalesPrice.toFixed(2)}
            {isOutOfSync && <span className="text-white-300 ml-1">*</span>}
          </div>
          <div className="w-36 md:w-48 lg:w-64 text-white font-bold bg-[#011c64] text-center p-1 border border-gray-300">
            $
            {selectedSalesperson === "All"
              ? salesStats.totalTrueGross.toFixed(2)
              : salesStats.totalTrueGross.toFixed(2)}
          </div>
        </div>

        {/* Gap to Target Row */}
        <div className="flex w-full min-w-full items-center my-1">
          <div className="flex-1 min-w-32 text-left font-bold text-[#011c64]">
            Gap to Target
          </div>
          <div className="w-36 md:w-48 lg:w-64 bg-green-100 text-center p-1 border border-gray-300 font-bold">
            {(selectedSalesperson === "All"
              ? salesStats.totalSales.toFixed(2)
              : salesStats.totalSales) > monthlyUnitsTarget
              ? "Target Met"
              : monthlyUnitsTarget -
                  (selectedSalesperson === "All"
                    ? salesStats.totalSales.toFixed(2)
                    : salesStats.totalSales.toFixed(2)) || "N/A"}
          </div>
          <div className="w-36 md:w-48 lg:w-64 bg-red-50 text-center p-1 border border-gray-300 font-bold">
            {monthlyGrossTarget -
              (selectedSalesperson === "All"
                ? salesStats.totalSalesPrice
                : salesStats.totalSalesPrice
              ).toFixed(2)}
          </div>
          <div className="w-36 md:w-48 lg:w-64 bg-white text-[#011c64] font-bold text-center p-1"></div>
        </div>

        {/* Average Row */}
        <div className="flex w-full min-w-full items-center my-1">
          <div className="flex-1 min-w-32 text-left font-bold text-[#011c64]">
            Average
          </div>
          <div className="w-36 md:w-48 lg:w-64"></div>
          {/* <div className="w-36 md:w-48 lg:w-64 bg-white-100 text-center p-1 border border-gray-300 text-[#011c64] font-bold">
            {(
              (selectedSalesperson === "All"
                ? salesStats.totalSales
                : salesStats.totalSales) /
              (selectedSalesperson === "All"
                ? salesStats.totalSalesPrice
                : salesStats.totalSalesPrice)
            ).toFixed(4)}
          </div> */}
          <div className="w-36 md:w-48 lg:w-64 bg-white-100 text-center p-1 border border-gray-300 text-[#011c64] font-bold">
            {(() => {
              const numerator =
                selectedSalesperson === "All"
                  ? salesStats.totalSales
                  : salesStats.totalSales;
              const denominator =
                selectedSalesperson === "All"
                  ? salesStats.totalSalesPrice
                  : salesStats.totalSalesPrice;

              if (!numerator || numerator === 0) {
                return "0.00";
              }

              return (denominator / numerator).toFixed(2);
            })()}
          </div>
          <div className="w-36 md:w-48 lg:w-64 bg-white text-[#011c64] font-bold text-center p-1"></div>
        </div>
      </div>

      {/* Table Section */}
      {allSales?.length > 0 && (
        <div className="w-full mt-2">
          <MonthlyPerformanceChart salesData={prepareChartData()} />
        </div>
      )}

      {/* Table Section */}
      <div className="w-full">
        {filteredSales.length > 0 ? (
          <SalesTrackingTable sales={filteredSales} />
        ) : (
          <div className="text-center py-8 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-gray-500">
              No sales data available for selected period
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MonthlyWholeSaleAnalytics;
