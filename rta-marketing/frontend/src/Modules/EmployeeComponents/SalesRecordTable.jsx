import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../../config/firebaseConfig";

import InsuranceUpload from "./UploadInsurance";
import ViewDetails from "./ViewDetails";
import { toast } from "react-toastify";
import { useAuth } from "../../AuthContext";
import { FaArrowLeft, FaArrowRight, FaBan } from "react-icons/fa6";
import { FaCalendarAlt } from "react-icons/fa";
import { Link } from "react-router-dom";
import SaleTabs from "../../Utils/SaleTypeTabs";
const SaleRecordTable = ({ setShowModal }) => {
  const [clients, setClients] = useState([]); // Initialize as an empty array
  const [filteredClients, setFilteredClients] = useState([]); // Initialize as an empty array
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(7);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sale, setSale] = useState(null);

  //sale type filter
  const [selectedSaleType, setSelectedSaleType] = useState("all");
  // Calculate total pages based on filtered clients

  const { currentUser } = useAuth();
  // Calculate records to display

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const handleOpenModal = (sale) => {
    setSale(sale);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };
  const handleOpenViewModal = (sale) => {
    // console.log(sale);
    setSale(sale);
    setIsViewModalOpen(true);
  };
  const handleCloseViewModal = () => {
    setIsViewModalOpen(false);
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
              // console.log(salesData);
              setClients(salesData);
              setFilteredClients(salesData); // Initially set filteredClients to all clients
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

  const handleFundStatus = async (clientId, index, saleId) => {
    // console.log("car funded");
    try {
      const docRef = doc(db, "sales", clientId); // Use clientId here
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        // Get the sales array
        const salesArray = docSnap.data().sales;
        // console.log("sales", salesArray);

        // Update the FundStatus field within the specific array element
        const updatedSales = salesArray.map((sale, idx) => {
          // console.log(sale, idx, index, saleId);
          return saleId === sale.saleId ? { ...sale, FundStatus: true } : sale;
        });

        // Update Firestore document
        await updateDoc(docRef, { sales: updatedSales });

        // console.log("updated sales", updatedSales);
        // Update local state
        setClients((prevClients) =>
          prevClients.map((client) =>
            client.id === clientId ? { ...client, sales: updatedSales } : client
          )
        );
        setFilteredClients((prevFilteredClients) =>
          prevFilteredClients.map((client) =>
            client.id === clientId ? { ...client, sales: updatedSales } : client
          )
        );

        toast.success("Car Funded Successfully");
      } else {
        toast.error("Document does not exist");
      }
    } catch (error) {
      toast.error("Error funding car: " + error.message);
    }
  };

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  useEffect(() => {
    if (selectedSaleType === "all") {
      setFilteredClients(clients); // Show all sales
    } else {
      // Default "individual" if saleType is not "wholesale"
      const filtered = clients?.filter((sale) => {
        const saleType = sale?.saleType || "individual"; // Default to 'individual' if no saleType
        return saleType === selectedSaleType;
      });
      setFilteredClients(filtered);
    }
  }, [selectedSaleType, clients]);

  // Handle rows per page change
  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(Number(event.target.value));
    setCurrentPage(1); // Reset to first page when rows per page changes
  };

  // Handle filter by date
  const handleFilter = () => {
    if (startDate && endDate) {
      const filteredClients = clients.filter((client) => {
        const clientDate = new Date(client.saleDate);
        return clientDate >= startDate && clientDate <= endDate;
      });
      setFilteredClients(filteredClients); // Update filtered state
      setCurrentPage(1); // Reset to first page when filter is applied
    } else {
      setFilteredClients(clients); // Reset filter
    }
  };

  // Clear filter
  const handleClearFilter = () => {
    setStartDate(null);
    setEndDate(null);
    setFilteredClients(clients); // Reset to original data
    setCurrentPage(1);
  };
  // Format date to "dd MMMM, yyyy" (matches your example data)
  const handleFilterToggle = () => {
    setShowFilters(!showFilters);
  };

  const sortedFilteredClients = filteredClients.sort((a, b) => {
    const dateA = new Date(a.saleDate);
    const dateB = new Date(b.saleDate);
    return dateB - dateA; // Sort in descending order (newest to oldest)
  });

  // Calculate the current clients for pagination
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;

  const currentClients = sortedFilteredClients.slice(
    startIndex,
    startIndex + rowsPerPage
  );

  // Calculate total pages based on filtered clients
  const totalPages = Math.ceil(filteredClients.length / rowsPerPage);

  return (
    <>
      <div className="relative bg-white rounded-lg shadow-md">
        {/* Sale Type Tabs - Enhanced */}
        <SaleTabs
          selectedSaleType={selectedSaleType}
          onSaleTypeChange={setSelectedSaleType}
        />
      </div>
      <div className="relative p-4  overflow-x-auto bg-white shadow-lg sm:rounded-lg ">
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
          } overflow-hidden transition-all duration-500 ease-in-out`}
        >
          <div className="flex justify-end mb-4">
            <div className="flex items-center mr-4">
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
              className="px-4 py-2 ml-4 text-white bg-[#003160] rounded-lg"
            >
              Apply Filter
            </button>
            <button
              onClick={handleClearFilter}
              className="px-4 py-2 ml-4 text-white bg-red-500 rounded-lg"
            >
              Clear Filter
            </button>
          </div>
        </div>

        <table className="w-full text-sm text-left text-black rtl:text-right dark:text-black font-radios">
          <thead className="w-full p-4 text-sm text-gray-700 uppercase bg-gray-50 dark:bg-[#003160] dark:text-white rounded-t-md">
            <tr>
              <th scope="col" className="px-4 py-4 rounded-tl-md">
                Client/Dealership
              </th>
              <th scope="col" className="px-4 py-4">
                Car Name
              </th>
              <th scope="col" className="px-4 py-4">
                Sale Date
              </th>
              <th scope="col" className="px-4 py-4">
                Insurance Status
              </th>
              <th scope="col" className="px-4 py-4">
                Fund Status
              </th>
              <th scope="col" className="px-4 py-4 rounded-tr-md">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="border-t-0 border-gray-300 border-1">
            {currentClients && currentClients.length > 0 ? (
              currentClients.map((sale, saleIndex) => (
                <tr
                  key={saleIndex}
                  className="bg-white border-b dark:bg-white dark:border-gray-300"
                >
                  <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-black">
                    {sale?.customerName
                      ? sale?.customerName
                      : sale?.dealershipPurchase}
                  </td>
                  <td className="px-4 py-4 text-gray-900">
                    {sale.vehicleMake}
                  </td>
                  <td className="px-4 py-4 text-gray-900">{sale.saleDate}</td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-block w-3 h-3 rounded-full mr-2 ${
                        sale.InsuranceStatus ? "bg-green-500" : "bg-red-500"
                      }`}
                    ></span>
                    {sale.InsuranceStatus ? "Completed" : "Pending"}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-block w-3 h-3 rounded-full mr-2 ${
                        sale.FundStatus ? "bg-green-500" : "bg-red-500"
                      }`}
                    ></span>
                    {sale.FundStatus ? "Completed" : "Pending"}
                  </td>
                  <td className="flex px-4 py-4 space-x-7">
                    <button
                      className="px-6 py-2.5 text-white bg-blue-600 rounded-lg dark:bg-[#0E376C]"
                      onClick={() => handleOpenViewModal(sale)}
                    >
                      View Details
                    </button>

                    {sale.InsuranceStatus ? (
                      <button
                        className={`py-2.5 w-[40%] text-white rounded-lg ${
                          sale.FundStatus
                            ? "bg-[#10C900] px-4"
                            : "bg-[#2c81ff] px-6"
                        }`}
                        onClick={() =>
                          handleFundStatus(
                            currentUser.uid,
                            saleIndex,
                            sale.saleId
                          )
                        }
                        disabled={sale.FundStatus}
                      >
                        {sale.FundStatus ? "Car Funded" : "Fund Car"}
                      </button>
                    ) : (
                      <button
                        className="w-[40%] py-2.5 text-white bg-green-600 rounded-lg dark:bg-[#6636C0]"
                        onClick={() => handleOpenModal(sale)}
                      >
                        Upload Insurance
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="100%" className="w-full p-2 text-center">
                  No sales data available{" "}
                  <button
                    className="text-blue-600 font-radios font-semibold"
                    onClick={() => setShowModal(true)}
                  >
                    Add New Sale
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
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

      {/* Pagination controls */}

      {isModalOpen ? (
        <InsuranceUpload
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          sale={sale}
        />
      ) : null}
      {isViewModalOpen ? (
        <ViewDetails onClose={handleCloseViewModal} sale={sale} />
      ) : null}
    </>
  );
};

export default SaleRecordTable;
