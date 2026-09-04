import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  FaArrowLeft,
  FaArrowRight,
  FaBan,
  FaChevronDown,
  FaCalendarAlt,
} from "react-icons/fa";
import { toast } from "react-toastify";

import {
  fetchSalesData,
  fetchLeads,
  fetchSalesPerson,
  applySalesFilters,
  getPaginationData,
} from "../../../Utils/salesUtils";

import InsuranceUpload from "../../EmployeeComponents/ViewDetails";
import SalesTable from "../../AdminComponents/SalesTable";
import SalesHeader from "../../AdminComponents/SalesHeader";
import SaleDetailsModal from "../components/AddSaleDetailsModal";
import SaleTabs from "../../../Utils/SaleTypeTabs";

const SalesVAPage = ({ setShowModal }) => {
  // State management
  const [allSales, setAllSales] = useState([]);
  const [sales, setSales] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(7);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [leadSources, setLeadSources] = useState([]);
  const [selectedLeadSource, setSelectedLeadSource] = useState("");
  const [SalesPerson, setSalesPerson] = useState([]);
  const [selectedSalesPerson, setSelectedSalesPerson] = useState("");
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [sale, setSale] = useState(null);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [uId, setUid] = useState([]);
  const [selectedSaleType, setSelectedSaleType] = useState("all"); // State for selected sale type (All, Individual, Wholesale)

  // Fetch data on component mount
  useEffect(() => {
    const unsubscribe = fetchSalesData(
      setSales,
      setAllSales,
      setFilteredClients,
      setUid
    );
    fetchLeads(setLeadSources);

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Fetch sales persons when uId changes
  useEffect(() => {
    if (uId.length > 0) {
      fetchSalesPerson(uId, setSalesPerson);
    }
  }, [uId]);

  // Apply filters when filter criteria change
  useEffect(() => {
    applySalesFilters(
      allSales,
      startDate,
      endDate,
      selectedLeadSource,
      selectedSalesPerson,
      setFilteredClients
    );
    setCurrentPage(1);
  }, [allSales, startDate, endDate, selectedLeadSource, selectedSalesPerson]);
  useEffect(() => {
    if (selectedSaleType === "all") {
      setFilteredClients(allSales); // Show all sales
    } else {
      // Default "individual" if saleType is not "wholesale"
      const filtered = allSales?.filter((sale) => {
        const saleType = sale?.saleType || "individual"; // Default to 'individual' if no saleType
        return saleType === selectedSaleType;
      });
      setFilteredClients(filtered);
    }
  }, [selectedSaleType, allSales]);

  // Modal handlers
  const handleOpenViewModal = (sale) => {
    setSale(sale);
    setIsViewModalOpen(true);
  };
  const handleCloseViewModal = () => setIsViewModalOpen(false);

  // Pagination handlers
  const handlePageChange = (pageNumber) => setCurrentPage(pageNumber);
  const handleRowsPerPageChange = (e) => {
    setRowsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };
  const [isAddDetailsModalOpen, setIsAddDetailsModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const handleAddData = (sale) => {
    setSelectedSale(sale);
    setIsAddDetailsModalOpen(true);
  };
  const handleDetailsUpdate = () => {
    // Refresh data after update
    fetchSalesData();
  };
  // Filter handlers
  const handleSelect = (event, setValue) => {
    setValue(event.target.value);
  };

  const handleClearFilter = () => {
    setStartDate(null);
    setEndDate(null);
    setSelectedLeadSource("");
    setSelectedSalesPerson("");
    setShowDateFilter(false);
  };

  const handleFilterToggle = () => setShowFilters(!showFilters);

  // Sort and paginate data
  const sortedFilteredClients = [...filteredClients].sort((a, b) => {
    return new Date(b.saleDate) - new Date(a.saleDate);
  });

  const { totalPages, currentClients } = getPaginationData(
    sortedFilteredClients,
    rowsPerPage,
    currentPage
  );

  return (
    <>
      <div className="flex items-start justify-start w-full h-full px-12 py-8 overflow-y-auto">
        <div className="flex flex-col w-full h-full ">
          <SalesHeader VA={true} />
          {/*tabs attached to the top of the table*/}
          <SaleTabs
            selectedSaleType={selectedSaleType}
            onSaleTypeChange={setSelectedSaleType}
          />
          <div className="relative p-2  bg-white shadow-lg sm:rounded-lg">
            {/* Filter Controls */}
            <div className="w-full text-end flex justify-end">
              <button
                type="button"
                onClick={handleFilterToggle}
                className="flex items-center px-4 py-3 mb-4 text-white bg-[#003160] rounded-lg"
              >
                <FaCalendarAlt className="mr-2" />
                {showFilters ? "Hide Filters" : "Show Filters"}
              </button>
            </div>

            {/* Filters Section */}
            <div
              className={`${
                showFilters ? "max-h-screen" : "max-h-0"
              } overflow-hidden transition-all duration-500 ease-in-out`}
            >
              <div className="flex justify-end items-center mb-4">
                {/* Sales Person Filter */}
                <div className="relative w-52 mx-4">
                  <select
                    name="Sales Person"
                    value={selectedSalesPerson}
                    onChange={(e) => handleSelect(e, setSelectedSalesPerson)}
                    className="w-full appearance-none px-8 py-2 pr-4 border border-gray-300 rounded-md focus:outline-1 focus:outline-[#003160] bg-white text-gray-500 cursor-pointer"
                  >
                    <option value="">Sales Person</option>
                    {SalesPerson.map((salePerson) => (
                      <option key={salePerson.uid} value={salePerson.uid}>
                        {salePerson.name}
                      </option>
                    ))}
                  </select>
                  <FaChevronDown className="absolute top-1/2 right-7 transform -translate-y-1/2 pointer-events-none text-gray-400 text-sm" />
                </div>

                {/* Lead Source Filter */}
                <div className="relative w-52 mx-4">
                  <select
                    name="leads Sources"
                    value={selectedLeadSource}
                    onChange={(e) => handleSelect(e, setSelectedLeadSource)}
                    className="w-full appearance-none px-8 py-2 pr-4 border border-gray-300 rounded-md focus:outline-1 focus:outline-[#003160] bg-white text-gray-500 cursor-pointer"
                  >
                    <option value="">Lead Source</option>
                    {leadSources.map((lead) => (
                      <option key={lead} value={lead}>
                        {lead}
                      </option>
                    ))}
                  </select>
                  <FaChevronDown className="absolute top-1/2 right-7 transform -translate-y-1/2 pointer-events-none text-gray-400 text-sm" />
                </div>

                {/* Date Filter */}
                {!showDateFilter ? (
                  <div
                    onClick={() => setShowDateFilter(true)}
                    className="px-8 py-2 border w-52 border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 bg-white text-gray-500 mx-4 cursor-pointer text-center"
                  >
                    Select Date
                  </div>
                ) : (
                  <div className="flex items-center">
                    <div className="flex items-center mr-4">
                      <label htmlFor="start-date" className="mr-2 font-radios">
                        From:
                      </label>
                      <DatePicker
                        id="start-date"
                        selected={startDate}
                        onChange={setStartDate}
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
                        onChange={setEndDate}
                        dateFormat="dd MMMM yyyy"
                        className="px-3 py-2 border-gray-300 rounded-lg border-1"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        applySalesFilters(
                          allSales,
                          startDate,
                          endDate,
                          selectedLeadSource,
                          selectedSalesPerson,
                          setFilteredClients
                        )
                      }
                      className="px-3 py-2 mx-4 text-white bg-[#003160] rounded-lg"
                    >
                      Apply Filter
                    </button>
                    <button
                      onClick={handleClearFilter}
                      className="px-3 py-2 text-white bg-red-500 rounded-lg"
                    >
                      Clear Filter
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Sales Table */}

            <SalesTable
              currentClients={currentClients}
              handleOpenViewModal={handleOpenViewModal}
              VA={true} // Pass whether delete is allowed based on user role
              onAddData={handleAddData}
            />

            {/* {isAddDetailsModalOpen && ( */}
            <SaleDetailsModal
              open={isAddDetailsModalOpen}
              onClose={() => setIsAddDetailsModalOpen(false)}
              onSuccess={handleDetailsUpdate}
              sale={selectedSale}
            />
            {/* )} */}

            {/* <AddSaleDetailsModal
              sale={selectedSale}
              open={isAddDetailsModalOpen}
              onClose={() => setIsAddDetailsModalOpen(false)}
              onSuccess={handleDetailsUpdate}
            /> */}
            {/* Pagination Controls */}
            <div className="flex items-center justify-between mt-4">
              <div>
                <label
                  htmlFor="rows-per-page"
                  className="p-3 mr-2 text-white bg-[#003160] rounded-lg font-radios"
                >
                  Rows per page:
                </label>
                <select
                  id="rows-per-page"
                  value={rowsPerPage}
                  onChange={handleRowsPerPageChange}
                  className="px-6 py-3 border-gray-300 rounded-md border-1"
                >
                  {[5, 7, 10, 15].map((option) => (
                    <option key={option} value={option} className="p-3">
                      {option} per page
                    </option>
                  ))}
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

      {/* View Details Modal */}
      {isViewModalOpen && (
        <InsuranceUpload onClose={handleCloseViewModal} sale={sale} />
      )}
    </>
  );
};

export default SalesVAPage;
