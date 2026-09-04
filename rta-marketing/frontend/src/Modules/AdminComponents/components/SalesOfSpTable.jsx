import { useEffect, useState } from "react";
import "react-datepicker/dist/react-datepicker.css";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { useAuth } from "../../../AuthContext";
import { db } from "../../../config/firebaseConfig";
import { toast } from "react-toastify";
import ConfirmationModal from "../../VirtualAssistantComponents/components/DeleteConfirmation";
import Filters from "../../../shared/VirtualAssistantComponents/TableFilters";
import SalesTableVA from "../../../shared/VirtualAssistantComponents/TableComponent";
import PaginationVA from "../../../shared/VirtualAssistantComponents/Pagination";
import ViewDetails from "../../EmployeeComponents/ViewDetails";
import SaleTabs from "../../../Utils/SaleTypeTabs";
const SalesOfSPTable = ({ id }) => {
  const [allSales, setAllSales] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(7);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLeadSource, setSelectedLeadSource] = useState("");
  const [selectedSalesPerson, setSelectedSalesPerson] = useState("");
  const { currentUser } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [modalData, setModalData] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState(null);
  const [filteredSales, setFilteredSales] = useState([]);
  const [documentId, setDocumentId] = useState(null);
  //For sale type tabs
  const [selectedSaleType, setSelectedSaleType] = useState("all"); // State for selected sale type (All, Individual, Wholesale)

  // Single source of truth for real-time data
  // useEffect(() => {
  //   const unsubscribeEmployees = setupEmployeesListener();

  //   return () => {
  //     unsubscribeEmployees && unsubscribeEmployees();
  //   };
  // }, [currentUser?.uid]);
  useEffect(() => {
    if (!id) return;

    // Set up listener for the specific sales person's document
    const docRef = doc(db, "sales", id);

    const unsubscribe = onSnapshot(
      docRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          setDocumentId(docSnapshot.id);

          // Get the sales array from the document
          const salesArray = data.sales || [];

          // Transform the sales data
          const transformedSales = salesArray.map((sale, index) => ({
            ...sale,
            id: index, // Using index as identifier within the array
            insuranceStatus: sale.InsuranceStatus ? "Completed" : "Pending",
            fundStatus: sale.FundStatus ? "Car Funded" : "Pending",
          }));

          setAllSales(transformedSales);
          setFilteredSales(transformedSales);
        } else {
          console.log("No sales document found for this ID");
          setAllSales([]);
          setFilteredSales([]);
        }
      },
      (error) => {
        console.error("Error fetching sales:", error);
        toast.error("Error loading sales data");
      }
    );

    return () => unsubscribe();
  }, [id]);
  // const setupEmployeesListener = () => {
  //   try {
  //     const employeesCollection = collection(db, "employees");
  //     return onSnapshot(
  //       employeesCollection,
  //       (querySnapshot) => {
  //         const salesData = [];
  //         const salesPersonData = [];

  //         querySnapshot.forEach((doc) => {
  //           const employeeData = doc.data();
  //           const { leads, name, uid } = employeeData;

  //           // Store sales person data
  //           salesPersonData.push({ name, uid });

  //           if (leads && Array.isArray(leads)) {
  //             const vaLeads = leads.filter(
  //               (lead) => lead.VAUid === currentUser?.uid
  //             );

  //             if (vaLeads.length > 0) {
  //               const leadSources = vaLeads
  //                 .slice(0, 3)
  //                 .map((lead) => lead.leadSource.trim())
  //                 .join(", ");
  //               const totalAmount = vaLeads.reduce(
  //                 (sum, lead) => sum + lead.leadAmount,
  //                 0
  //               );

  //               salesData.push({
  //                 saleId: doc.id,
  //                 salesPerson: name,
  //                 leadSource: leadSources,
  //                 amount: `$${totalAmount}`,
  //                 allLeads: vaLeads,
  //                 salesPersonId: uid,
  //               });
  //             }
  //           }
  //         });
  //         console.log("saeles", salesData);
  //         setAllSales(salesData);
  //       },
  //       (error) => {
  //         console.error("Error in employees listener:", error);
  //         toast.error("Error loading employee data");
  //       }
  //     );
  //   } catch (error) {
  //     console.error("Error setting up employees listener:", error);
  //     return null;
  //   }
  // };

  // Filter logic
  useEffect(() => {
    handleFilter();
  }, [selectedSaleType, startDate, endDate, allSales]);

  const handleFilter = () => {
    let filteredSales = [...allSales];

    if (selectedSaleType !== "all") {
      filteredSales = filteredSales.filter((sale) => {
        const saleType = sale?.saleType || "individual";
        return saleType === selectedSaleType;
      });
    }

    // Check if both startDate and endDate are valid (not null or undefined)
    if (startDate && endDate) {
      filteredSales = filteredSales.filter((sale) => {
        // Parse the sale date from the format "DD Month YYYY"
        const saleDateParts = sale.saleDate.split(" ");
        const saleDate = new Date(
          `${saleDateParts[1]} ${saleDateParts[0]}, ${saleDateParts[2]}`
        );

        // Reset hours to midnight for accurate date comparison
        saleDate.setHours(0, 0, 0, 0);
        const filterStartDate = new Date(startDate);
        filterStartDate.setHours(0, 0, 0, 0);
        const filterEndDate = new Date(endDate);
        filterEndDate.setHours(23, 59, 59, 999);

        return saleDate >= filterStartDate && saleDate <= filterEndDate;
      });
    }

    // Update the filtered sales and clients regardless of the date check

    setFilteredSales(filteredSales);
    setFilteredClients(filteredSales);
    setCurrentPage(1);
  };

  const handleFilterChange = (filters) => {
    const { selectedLeadSource, selectedSalesPerson, startDate, endDate } =
      filters;
    setSelectedLeadSource(selectedLeadSource);
    setSelectedSalesPerson(selectedSalesPerson);
    setStartDate(startDate);
    setEndDate(endDate);
  };

  const handleFilterToggle = () => setShowFilters(!showFilters);

  const handleOpenViewModal = (row) => {
    setModalMode("view");
    setModalData(row);
    setIsModalOpen(true);
  };

  const handleDeleteSale = (saleId) => {
    setSaleToDelete(saleId);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      if (documentId === null) {
        throw new Error("Document ID not found");
      }

      const docRef = doc(db, "sales", documentId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const currentSales = docSnap.data().sales || [];
        // Remove the sale at the specified index
        currentSales.splice(saleToDelete, 1);

        // Update the document with the modified sales array
        await updateDoc(docRef, {
          sales: currentSales,
        });

        toast.success("Sale deleted successfully");
      }
    } catch (error) {
      console.error("Error deleting sale:", error);
      toast.error("Failed to delete sale");
    } finally {
      setIsDeleteModalOpen(false);
      setSaleToDelete(null);
    }
  };

  // Table columns configuration
  const salesColumns = [
    {
      key: "name",
      label: "Client/Dealership",
      render: (value, row) => {
        if (row?.saleType === "wholesale") {
          return row?.dealershipPurchase || "N/A";
        }
        return row?.customerName || "N/A";
      },
    },
    {
      key: "carName",
      label: "Vehicle Type",
      render: (value, row) => `${row.vehicleMake} ${row.vehicleModel}`,
    },
    { key: "saleDate", label: "Sale Date" },
    {
      key: "insuranceStatus",
      label: "Insurance Status",
      render: (value) => (
        <div className="flex items-center">
          <span
            className={`w-3 h-3 rounded-full mr-2 ${
              value === "Completed" ? "bg-green-500" : "bg-red-500"
            }`}
          ></span>
          {value}
        </div>
      ),
    },
    {
      key: "fundStatus",
      label: "Car Funded Status",
      render: (value) => (
        <div className="flex items-center">
          <span
            className={`w-3 h-3 rounded-full mr-2 ${
              value === "Car Funded" ? "bg-green-500" : "bg-red-500"
            }`}
          ></span>
          {value}
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (value, row) => (
        <div className="flex space-x-4">
          <button
            className="px-4 py-2 text-white bg-[#003160] rounded-lg"
            onClick={() => handleOpenViewModal(row)}
          >
            View Details
          </button>
          <button
            className="px-4 py-2 text-white bg-red-600 rounded-lg"
            onClick={() => handleDeleteSale(row.id)}
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  // Pagination calculations
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const currentSales = filteredSales?.slice(startIndex, endIndex);
  const totalPages = Math.max(1, Math.ceil(filteredSales.length / rowsPerPage));

  return (
    <>
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSaleToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Sale"
        message="Are you sure you want to delete this sale? This action cannot be undone."
      />

      <div className="px-4 flex items-start justify-start w-full h-full overflow-y-auto ">
        <div className="flex flex-col w-full h-full  overflow-y-auto ">
          <Filters
            onFilterChange={handleFilterChange}
            showFilters={showFilters}
            otherFilters={false}
            handleFilterToggle={handleFilterToggle}
            selectedLeadSource={selectedLeadSource}
            setSelectedLeadSource={setSelectedLeadSource}
            selectedSalesPerson={selectedSalesPerson}
            setSelectedSalesPerson={setSelectedSalesPerson}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
          />
          <SaleTabs
            selectedSaleType={selectedSaleType}
            onSaleTypeChange={setSelectedSaleType}
          />
          <SalesTableVA columns={salesColumns} data={currentSales} />
          <PaginationVA
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={setRowsPerPage}
          />
        </div>
      </div>
      {isModalOpen ? (
        <ViewDetails
          hide={true}
          onClose={() => {
            setIsModalOpen(false);
          }}
          sale={modalData}
        />
      ) : null}
    </>
  );
};

export default SalesOfSPTable;
