import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  collection,
  doc,
  getDocs,
  updateDoc,
  query,
  where,
  deleteField,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../config/firebaseConfig";

import ViewDetails from "../EmployeeComponents/ViewDetails";
import {
  FaArrowLeft,
  FaArrowRight,
  FaBan,
  FaChevronDown,
} from "react-icons/fa6";
import { FaCalendarAlt } from "react-icons/fa";
import { toast } from "react-toastify";
import SalesTable from "./SalesTable";
import SalesHeader from "./SalesHeader";
import SaleDetailsModal from "../VirtualAssistantComponents/components/AddSaleDetailsModal";
import SaleTabs from "../../Utils/SaleTypeTabs";
const SalesPage = ({ setShowModal }) => {
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
  const [SalesPerson, setSalesPerson] = useState([""]);
  const [selectedSalesPerson, setSelectedSalesPerson] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [sale, setSale] = useState(null);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [selectedSaleType, setSelectedSaleType] = useState("all"); // State for selected sale type (All, Individual, Wholesale)

  console.log("setSelectedSaleType", selectedSaleType);
  const [uId, setUid] = useState([]);

  const fetchSalesData = () => {
    try {
      const salesCollection = collection(db, "sales");
      const unsubscribe = onSnapshot(salesCollection, (querySnapshot) => {
        const salesData = [];
        const uIds = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const id = doc.id;
          uIds.push(id);
          const dataWithId = data.sales.map((el) => ({
            documentId: doc.id,
            ...el,
          }));
          const dataObject = {
            sales: dataWithId,
            id: id,
          };

          salesData.push(dataObject);
          setUid(uIds);
        });

        setSales(salesData);

        const allSales = salesData.flatMap((item) => item.sales);
        setAllSales(allSales);
        setFilteredClients(allSales);

        // Fetch sales persons whenever sales data updates
        fetchSalesPerson();
      });

      // Return the unsubscribe function to clean up when component unmounts
      return unsubscribe;
    } catch (error) {
      console.error("Error setting up sales data listener: ", error);
    }
  };

  console.log("selectedLeadSource", selectedLeadSource);

  const fetchLeads = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "leads"));
      const fetchedLeads = querySnapshot.docs.map((doc) => doc.data().leadName);
      setLeadSources(fetchedLeads);
    } catch (error) {
      console.error("Error fetching leads: ", error);
      toast.error("Failed to fetch leads: " + error.message);
    }
  };

  const fetchSalesPerson = async () => {
    try {
      if (uId) {
        const SalePersonsRef = collection(db, "employees");
        const queryPromises = uId?.map((source) => {
          const q = query(SalePersonsRef, where("uid", "==", source));
          return getDocs(q);
        });
        const querySnapshots = await Promise.all(queryPromises);
        const results = [];
        querySnapshots.forEach((snapshot) => {
          snapshot.forEach((doc) => {
            const { name, uid } = doc.data();
            results.push({ name, uid });
          });
        });

        setSalesPerson(results);
      }
    } catch (error) {
      console.error("Error fetching Sale Persons: ", error);
      toast.error("Failed to fetch Sales Person : " + error.message);
    }
  };

  // Usage in your component
  useEffect(() => {
    const unsubscribe = fetchSalesData();
    fetchLeads();

    // Clean up the listener when component unmounts
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };
  const handleOpenViewModal = (sale) => {
    setSale(sale);
    setIsViewModalOpen(true);
  };
  const handleCloseViewModal = () => {
    setIsViewModalOpen(false);
  };

  useEffect(() => {
    fetchLeads();
    fetchSalesData();
  }, []);

  useEffect(() => {
    fetchSalesPerson();
  }, [uId]);

  //FILTER BY SALES ,on frontend
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

  const handleDeleteSale = async (saleId, documentId) => {
    try {
      const docRef = doc(db, "sales", documentId);

      const salesItem = sales.find((item) => item.id === documentId);

      if (salesItem) {
        const arrayItem = salesItem.sales;

        const updatedArrayItems = arrayItem.filter(
          (item) => item.saleId !== saleId
        );

        if (updatedArrayItems.length === 0) {
          // Delete the document if the updated array is empty
          await deleteDoc(docRef);
          toast.success("Document deleted successfully");
        } else {
          // Otherwise, update the document with the new array
          await updateDoc(docRef, { sales: updatedArrayItems });
          toast.success("Sale deleted successfully");
        }

        fetchSalesData();
      } else {
        toast.error("Something happened: try again");
      }
    } catch (error) {
      console.error("Error deleting object:", error);
      toast.error("Error deleting object: please try again");
    }
  };

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(Number(event.target.value));
    setCurrentPage(1);
  };
  // const handleFilter = () => {
  //   let filtered = allSales;
  //   if (selectedSaleType !== "all") {
  //     filtered = filtered.filter((sale) => {
  //       const saleType = sale?.saleType || "individual";
  //       return saleType === selectedSaleType;
  //     });
  //   }

  //   if (startDate && endDate) {
  //     const filteredSales = filtered.filter((sale) => {
  //       const saleDate = new Date(sale.saleDate);
  //       return saleDate >= startDate && saleDate <= endDate;
  //     });
  //     setFilteredClients(filteredSales);
  //     setCurrentPage(1);
  //   } else {
  //     setFilteredClients(filtered);
  //   }
  //   if (selectedLeadSource) {
  //     const filteredSales = filtered.filter(
  //       (sale) => sale.leadSource === selectedLeadSource
  //     );
  //     setFilteredClients(filteredSales);
  //   }
  //   if (selectedSalesPerson) {
  //     const filteredSales = filtered.filter(
  //       (sale) => sale.documentId === selectedSalesPerson
  //     );
  //     setFilteredClients(filteredSales);
  //   }
  // };

  // useEffect(() => {
  //   handleFilter();
  // }, [
  //   selectedSalesPerson,
  //   selectedLeadSource,
  //   startDate,
  //   endDate,
  //   selectedSaleType,
  // ]);

  const handleFilter = () => {
    let filtered = allSales;

    // First apply sale type filter
    if (selectedSaleType !== "all") {
      filtered = filtered.filter((sale) => {
        const saleType = sale?.saleType || "individual";
        return saleType === selectedSaleType;
      });
    }

    // Then apply other filters
    if (startDate && endDate) {
      filtered = filtered.filter((sale) => {
        const saleDate = new Date(sale.saleDate);
        return saleDate >= startDate && saleDate <= endDate;
      });
    }

    if (selectedLeadSource) {
      filtered = filtered.filter(
        (sale) => sale.leadSource === selectedLeadSource
      );
    }

    if (selectedSalesPerson) {
      filtered = filtered.filter(
        (sale) => sale.documentId === selectedSalesPerson
      );
    }

    setFilteredClients(filtered);
    setCurrentPage(1);
  };

  // Update the useEffect for sale type filtering
  useEffect(() => {
    handleFilter();
  }, [
    selectedSaleType,
    allSales,
    selectedSalesPerson,
    selectedLeadSource,
    startDate,
    endDate,
  ]);

  const handleClearFilter = () => {
    setStartDate(null);
    setEndDate(null);
    setFilteredClients(allSales);
    setCurrentPage(1);
    setSelectedLeadSource("");
    setSelectedSalesPerson("");
    setShowDateFilter(false);
  };
  const handleFilterToggle = () => {
    setShowFilters(!showFilters);
  };

  const sortedFilteredClients = filteredClients.sort((a, b) => {
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
  const totalPages = Math.ceil(filteredClients.length / rowsPerPage);

  const handleSelect = (event, setValue) => {
    if (event.target.value === "") setFilteredClients(allSales);

    setValue(event.target.value);
  };

  return (
    <>
      <div className="flex items-start justify-start w-full h-full px-12 py-8 overflow-y-auto">
        <div className="flex flex-col w-full h-full   ">
          <SalesHeader />
          {/*tabs attached to the top of the table*/}

          <SaleTabs
            selectedSaleType={selectedSaleType}
            onSaleTypeChange={setSelectedSaleType}
          />
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
                <div className="relative w-52 mx-4">
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
                </div>
                {selectedSaleType !== "wholesale" && (
                  <div className="relative w-52 mx-4">
                    <select
                      name="leads Sources"
                      id=""
                      value={selectedLeadSource}
                      onChange={(event) => {
                        handleSelect(event, setSelectedLeadSource);
                      }}
                      className="w-full appearance-none px-8 py-2 pr-4 border border-gray-300 rounded-md focus:outline-1  focus:outline-[#003160] bg-white text-gray-500 cursor-pointer"
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
                )}

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
            <SalesTable
              currentClients={currentClients}
              handleDeleteSale={handleDeleteSale}
              handleOpenViewModal={handleOpenViewModal}
              onAddData={handleAddData}
              admin={true}
            />
            {/* {isAddDetailsModalOpen && ( */}
            <SaleDetailsModal
              open={isAddDetailsModalOpen}
              onClose={() => setIsAddDetailsModalOpen(false)}
              onSuccess={handleDetailsUpdate}
              sale={selectedSale}
            />
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

      {isViewModalOpen ? (
        <ViewDetails onClose={handleCloseViewModal} sale={sale} />
      ) : null}
    </>
  );
};

export default SalesPage;
