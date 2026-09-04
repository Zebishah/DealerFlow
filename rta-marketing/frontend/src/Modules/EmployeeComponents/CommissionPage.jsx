import React, { useEffect, useState } from "react";
import { FaCalendarAlt } from "react-icons/fa";
import {
  FaArrowLeft,
  FaArrowRight,
  FaBan,
  FaChevronDown,
} from "react-icons/fa6";

import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { toast } from "react-toastify";
import { auth, db } from "../../config/firebaseConfig";
import TabsSelector from "../AdminComponents/components/TabsSelector";
import { useAuth } from "../../AuthContext";
import CommissionTable from "./EmployeeCommissionTable";

const EmployeeCommissionPage = () => {
  const [allSales, setAllSales] = useState([]);
  const [sales, setSales] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const { currentUser } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(7);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSalesPerson, setSelectedSalesPerson] = useState("");
  const [showDateFilter, setShowDateFilter] = useState(true);
  const [tab, setTab] = useState("all");
  const [SalesPerson, setSalesPerson] = useState([]);
  const [uId, setUid] = useState([]);
  const [salesWithReportHistory, setSalesWithReportHistory] = useState([]);
  const [filteredReportHistorySales, setFilteredReportHistorySales] = useState(
    []
  );
  const options = [
    { label: "All", value: "all" },
    { label: "Pending", value: "pending" },
    { label: "Approved", value: "accepted" },
    { label: "Rejected", value: "rejected" },
  ];

  const handleFilterToggle = () => {
    setShowFilters(!showFilters);
  };
  const handleSelect = (event, setValue) => {
    if (event.target.value === "") setFilteredClients(allSales);

    setValue(event.target.value);
  };

  const handleFilter = () => {};
  const handleClearFilter = () => {
    setStartDate(null);
    setEndDate(null);
    setCurrentPage(1);
    setSelectedSalesPerson("");
    // setShowDateFilter(false);
  };
  const sortedFilteredClients = filteredReportHistorySales.sort((a, b) => {
    const dateA = new Date(a.saleDate);
    const dateB = new Date(b.saleDate);
    return dateB - dateA;
  });
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const currentClients = sortedFilteredClients.slice(
    startIndex,
    startIndex + rowsPerPage
  );
  const totalPages = Math.ceil(sortedFilteredClients.length / rowsPerPage);
  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(Number(event.target.value));
    setCurrentPage(1);
  };
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  useEffect(() => {
    const fetchSalesData = async () => {
      try {
        const user = auth.currentUser; // Get the currently logged-in user
        if (user) {
          const docRef = doc(db, "sales", user.uid); // Use the user's uid as the document ID
          onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
              const salesData = docSnap.data().sales || [];
              const saleDataWithDocID = salesData.map((sale) => ({
                ...sale,
                documentId: docSnap.id,
              }));

              setAllSales(saleDataWithDocID);
              setFilteredClients(saleDataWithDocID); // Initially set filteredClients to all clients
            } else {
              toast.info("No sales data found for this user.");
            }
          });
        } else {
          toast.error("User not authenticated");
        }
      } catch (err) {
        toast.error(`Error fetching sales data: ${err.message}`);
      }
    };

    fetchSalesData();
  }, [currentUser]);

  useEffect(() => {
    if (allSales.length > 0) {
      const filtered = allSales.filter((sale) =>
        Array.isArray(sale.reportHistory)
      );
      setSalesWithReportHistory(filtered);
    }
  }, [allSales]);

  const applyFilters = () => {
    let filtered = [...salesWithReportHistory];

    // if (tab !== "all") {
    //   filtered = filtered.filter(
    //     (sale) => sale?.reportStatus?.status?.toLowerCase() === tab
    //   );
    // }

    if (tab !== "all") {
      filtered = filtered.filter((sale) => {
        if (tab === "pending") {
          return (
            !sale?.reportStatus?.status ||
            sale.reportStatus.status.toLowerCase() === tab
          );
        } else {
          return sale?.reportStatus?.status?.toLowerCase() === tab;
        }
      });
    }
    // Apply salesperson filter
    if (selectedSalesPerson) {
      filtered = filtered.filter(
        (sale) => sale.documentId === selectedSalesPerson
      );
    }

    // Apply date filter
    if (startDate && endDate) {
      filtered = filtered.filter((sale) => {
        const saleDate = new Date(sale.saleDate);

        const sheetDate =
          new Date(sale?.reportStatus?.generatedAt) ||
          new Date(sale?.reportHistory[0]?.generatedAt);
        // console.log("sheet Date", sheetDate);

        return saleDate >= startDate && saleDate <= endDate;
      });
    }

    setFilteredReportHistorySales(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  };

  // Call applyFilters whenever filter criteria change
  useEffect(() => {
    applyFilters();
  }, [selectedSalesPerson, startDate, endDate, tab, salesWithReportHistory]);

  return (
    <div className="flex items-start justify-start w-full h-full px-12 py-8 overflow-y-auto">
      <div className="flex flex-col w-full h-full   ">
        <div className="flex items-center justify-between w-full mb-12">
          <div className="text-2xl pt-4 font-bold">Commission Sheets</div>
        </div>
        <TabsSelector tab={tab} setTab={setTab} options={options} />
        <div className="relative p-2  bg-white shadow-lg sm:rounded-lg  ">
          <div className="w-full text-end flex justify-end">
            <button
              onClick={handleFilterToggle}
              className="flex items-center px-4 py-3 mb-4 text-white bg-[#003160] rounded-lg "
            >
              <FaCalendarAlt className="mr-2" />
              {showFilters ? "Hide Filters" : "Show Filters"}
            </button>
          </div>

          <div
            className={`${
              showFilters ? "max-h-screen" : "max-h-0"
            } overflow-hidden transition-all duration-500 ease-in-out `}
          >
            <div className="flex justify-end items-center mb-4">
              {/* <div className="relative w-52 mx-4">
                <select
                  key={selectedSalesPerson}
                  name="Sales Person"
                  id="demo-simple-select-helper-label"
                  value={selectedSalesPerson}
                  onChange={(event) => {
                    handleSelect(event, setSelectedSalesPerson);
                  }}
                  className="w-full appearance-none px-8 py-2 pr-4 border border-gray-300 rounded-md focus:outline-1  focus:outline-[#003160] bg-white text-gray-500 cursor-pointer"
                >
                  <option value="">Sales Person</option>
                  {SalesPerson.map((salePerson) => {
                    return (
                      <option key={salePerson.uid} value={salePerson.uid}>
                        {salePerson.name}
                      </option>
                    );
                  })}
                </select>

                <FaChevronDown className="absolute top-1/2 right-7 transform -translate-y-1/2 pointer-events-none text-gray-400 text-sm" />
              </div> */}

              {!showDateFilter ? (
                <div
                  onClick={() => {
                    setShowDateFilter(true);
                  }}
                  className="px-8 py-2 border w-52 border-gray-300  rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 bg-white text-gray-500 mx-4 cursor-pointer text-center"
                >
                  Select Date
                </div>
              ) : (
                <div className=" flex items-center  ">
                  <div className="flex items-center mr-4 ">
                    <label htmlFor="start-date" className="mr-2 font-radios">
                      From:
                    </label>
                    <DatePicker
                      id="start-date"
                      selected={startDate}
                      onChange={(date) => setStartDate(date)}
                      dateFormat="dd MMMM yyyy"
                      className="px-3 py-2 border-gray-300 rounded-lg border-1"
                    />
                  </div>
                  <div className="flex items-center">
                    <label htmlFor="end-date" className="mr-2 font-radios">
                      To:
                    </label>
                    <DatePicker
                      id="end-date"
                      selected={endDate}
                      onChange={(date) => setEndDate(date)}
                      dateFormat="dd MMMM yyyy"
                      className="px-3 py-2 border-gray-300 rounded-lg border-1"
                    />
                  </div>
                  <button
                    onClick={() => handleFilter(startDate, endDate)}
                    className="px-3 py-2 mx-4 text-white bg-[#003160] rounded-lg"
                  >
                    Apply Filter
                  </button>
                  <button
                    onClick={handleClearFilter}
                    className="px-3 py-2     text-white bg-red-500 rounded-lg"
                  >
                    Clear Filter
                  </button>
                </div>
              )}
            </div>
          </div>
          {/* tables here */}
          <CommissionTable sales={currentClients} />
          <div className="flex items-center justify-between mt-4">
            <div>
              <label
                htmlFor="rows-per-page"
                className="p-3 mr-2 text-white bg-[#003160] rounded-lg font-radios"
              >
                Rows per page :
              </label>
              <select
                id="rows-per-page"
                value={rowsPerPage}
                onChange={handleRowsPerPageChange}
                className="px-6 py-3 border-gray-300 rounded-md border-1"
              >
                <option value={5} className="p-3">
                  5 per page
                </option>
                <option value={7} className="p-3">
                  7 per page
                </option>
                <option value={10} className="p-3">
                  10 per page
                </option>
                <option value={15} className="p-3">
                  15 per page
                </option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <div className="relative">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`px-4 py-2 border rounded-l-lg flex items-center space-x-1 ${
                    currentPage === 1
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-800"
                  }`}
                >
                  <FaArrowLeft />
                </button>
                {currentPage === 1 && (
                  <div className="absolute inset-0 flex items-center justify-center text-red-500 opacity-0 hover:opacity-100">
                    <FaBan size={20} />
                  </div>
                )}
              </div>

              <span className="px-4 py-2">
                Page {currentPage} of {totalPages}
              </span>

              <div className="relative">
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={`px-4 py-2 border rounded-r-lg flex items-center space-x-1 ${
                    currentPage === totalPages
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-800"
                  }`}
                >
                  <FaArrowRight />
                </button>
                {currentPage === totalPages && (
                  <div className="absolute inset-0 flex items-center justify-center text-red-500 opacity-0 hover:opacity-100">
                    <FaBan size={20} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeCommissionPage;
