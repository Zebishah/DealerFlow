import { useEffect, useState } from "react";
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
import { toast } from "react-toastify";
import Filters from "../../../shared/VirtualAssistantComponents/TableFilters";
import SalesTableVA from "../../../shared/VirtualAssistantComponents/TableComponent";
import { db } from "../../../config/firebaseConfig";
import PaginationVA from "../../../shared/VirtualAssistantComponents/Pagination";
import { useAuth } from "../../../AuthContext";
import UploadLeadModal from "./UploadLeadModal";
import ConfirmationModal from "./DeleteConfirmation";

const LeadsPageVA = ({
  leadSources,
  setLeadSources,
  SalesPerson,
  setSalesPerson,
  setTotalLeads,
}) => {
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
  const [leadToDelete, setLeadToDelete] = useState(null);
  const [receivedStartDate, setReceivedStartDate] = useState(null);
  const [receivedEndDate, setReceivedEndDate] = useState(null);
  useEffect(() => {
    const unsubscribeEmployees = setupEmployeesListener();
    const unsubscribeLeads = setupLeadsListener();

    return () => {
      unsubscribeEmployees && unsubscribeEmployees();
      unsubscribeLeads && unsubscribeLeads();
    };
  }, [currentUser?.uid]);

  const setupEmployeesListener = () => {
    try {
      const employeesCollection = collection(db, "employees");
      return onSnapshot(
        employeesCollection,
        (querySnapshot) => {
          let salesData = [];
          const salesPersonData = [];
          let totalLeadsCount = 0;

          querySnapshot.forEach((doc) => {
            const employeeData = doc.data();
            const { leads, name, uid } = employeeData;

            if (leads && Array.isArray(leads)) {
              totalLeadsCount += leads.length;
            }

            salesPersonData.push({ name, uid });

            if (leads && Array.isArray(leads)) {
              let relevantLeads = leads;

              if (currentUser?.userType !== "Admin") {
                relevantLeads = leads.filter(
                  (lead) => lead.VAUid === currentUser?.uid
                );
              }

              if (relevantLeads.length > 0) {
                // First group leads by their batchId
                const leadsByBatch = relevantLeads.reduce((batches, lead) => {
                  const batchId =
                    lead.batchId ||
                    lead.timestamp?.toDate?.()?.getTime() ||
                    new Date().getTime();
                  if (!batches[batchId]) {
                    batches[batchId] = [];
                  }
                  batches[batchId].push(lead);
                  return batches;
                }, {});

                // Then process each batch
                Object.entries(leadsByBatch).forEach(
                  ([batchId, batchLeads]) => {
                    // Sort leads within batch by timestamp
                    const sortedBatchLeads = batchLeads.sort((a, b) => {
                      const dateA = a.timestamp?.toDate
                        ? a.timestamp.toDate()
                        : new Date(a.timestamp);
                      const dateB = b.timestamp?.toDate
                        ? b.timestamp.toDate()
                        : new Date(b.timestamp);
                      return dateB - dateA;
                    });

                    // Create a summary row for the batch
                    const firstLead = sortedBatchLeads[0];
                    const leadDateTime = firstLead.timestamp
                      ?.toDate()
                      .toISOString()
                      .slice(0, 10);
                    const receivedDate = firstLead.receivedDate
                      ? firstLead.receivedDate
                          .toDate()
                          .toLocaleDateString("en-CA", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                          })
                      : "";

                    // Calculate totals for the batch
                    const totalAmount = batchLeads.reduce(
                      (sum, lead) => sum + (lead.leadAmount || 0),
                      0
                    );
                    const leadSources = [
                      ...new Set(
                        batchLeads.map((lead) => lead.leadSource.trim())
                      ),
                    ].join(", ");

                    salesData.push({
                      saleId: doc.id,
                      salesPerson: name,
                      leadSource: leadSources,
                      receivedDate: receivedDate?.replace("T", " "),
                      amount: totalAmount,
                      dateTime: leadDateTime.replace("T", " "),
                      salesPersonId: uid,
                      batchId: batchId,
                      isBatch: true,
                      leadCount: batchLeads.length,
                      leadData: batchLeads, // Store all leads in this batch
                    });

                    // If you want to show individual leads as well (optional)
                    // sortedBatchLeads.forEach((lead, index) => {
                    //   salesData.push({
                    //     saleId: doc.id,
                    //     salesPerson: name,
                    //     leadSource: lead.leadSource.trim(),
                    //     receivedDate: receivedDate?.replace("T", " "),
                    //     amount: lead.leadAmount,
                    //     dateTime: leadDateTime.replace("T", " "),
                    //     salesPersonId: uid,
                    //     leadId: lead.id,
                    //     batchId: batchId,
                    //     isBatch: false,
                    //     leadData: lead,
                    //   });
                    // });
                  }
                );
              }
            }
          });

          salesData.sort((a, b) => {
            const dateA = new Date(a.dateTime);
            const dateB = new Date(b.dateTime);
            return dateB - dateA;
          });

          setSalesPerson(salesPersonData);
          setAllSales(salesData);
          setTotalLeads(totalLeadsCount);
        },
        (error) => {
          console.error("Error in employees listener:", error);
          toast.error("Error loading employee data");
        }
      );
    } catch (error) {
      console.error("Error setting up employees listener:", error);
      return null;
    }
  };
  const setupLeadsListener = () => {
    try {
      const leadsCollection = collection(db, "leads");
      return onSnapshot(
        leadsCollection,
        (querySnapshot) => {
          const fetchedLeads = querySnapshot.docs.map(
            (doc) => doc.data().leadName
          );
          setLeadSources(fetchedLeads);
        },
        (error) => {
          console.error("Error in leads listener:", error);
          toast.error("Error loading lead sources");
        }
      );
    } catch (error) {
      console.error("Error setting up leads listener:", error);
      return null;
    }
  };

  useEffect(() => {
    handleFilter();
  }, [
    selectedLeadSource,
    selectedSalesPerson,
    startDate,
    endDate,
    allSales,
    receivedStartDate,
    receivedEndDate,
  ]);

  const handleFilter = () => {
    let filteredSales = [...allSales];

    if (selectedSalesPerson) {
      filteredSales = filteredSales.filter(
        (sale) => sale.salesPersonId === selectedSalesPerson
      );
    }

    if (selectedLeadSource) {
      // console.log("selectedLeadSource", selectedLeadSource);
      filteredSales = filteredSales.filter((sale) =>
        sale.leadSource.includes(selectedLeadSource.trimEnd())
      );
    }

    if (startDate && endDate) {
      filteredSales = filteredSales.filter((sale) => {
        if (!sale.dateTime) return false; // Ensure date exists

        const saleDate = new Date(sale.dateTime); // Convert to Date object
        const start = new Date(startDate).setHours(0, 0, 0, 0); // Reset time for accuracy
        const end = new Date(endDate).setHours(23, 59, 59, 999); // Include the full day

        return saleDate.getTime() >= start && saleDate.getTime() <= end;
      });
    }
    if (receivedStartDate && receivedEndDate) {
      filteredSales = filteredSales.filter((sale) => {
        if (!sale.receivedDate) return false; // Ensure receivedDate exists

        const receivedDate = new Date(sale.receivedDate); // Convert to Date object
        const start = new Date(receivedStartDate).setHours(0, 0, 0, 0); // Reset time for accuracy
        const end = new Date(receivedEndDate).setHours(23, 59, 59, 999); // Include the full day

        return receivedDate.getTime() >= start && receivedDate.getTime() <= end;
      });
    }

    setFilteredClients(filteredSales);
    setCurrentPage(1);
  };

  const handleFilterChange = (filters) => {
    const {
      selectedLeadSource,
      selectedSalesPerson,
      startDate,
      endDate,
      receivedStartDate,
      receivedEndDate,
    } = filters;

    setSelectedLeadSource(selectedLeadSource);
    setSelectedSalesPerson(selectedSalesPerson);
    setStartDate(startDate);
    setEndDate(endDate);
    setReceivedStartDate(receivedStartDate);
    setReceivedEndDate(receivedEndDate);
  };
  const handleFilterToggle = () => setShowFilters(!showFilters);

  const handleOpenViewModal = (rowData) => {
    setModalMode("view");
    // If it's a batch, we'll pass all leads in the batch
    // If it's a single lead, we'll pass it as an array with one item
    const leadData = rowData.isBatch ? rowData.leadData : [rowData.leadData];
    setModalData({
      ...rowData,
      allLeads: leadData,
      salesPersonId: rowData.salesPersonId,
    });
    setIsModalOpen(true);
  };
  const handleDeleteSale = (row) => {
    setLeadToDelete(row);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      if (!leadToDelete) {
        toast.error("No lead selected for deletion");
        return;
      }

      const employeeDocRef = doc(db, "employees", leadToDelete.saleId);
      const employeeDoc = await getDoc(employeeDocRef);

      if (!employeeDoc.exists()) {
        toast.error("Employee document not found");
        return;
      }

      const employeeData = employeeDoc.data();
      let leads = [...employeeData.leads];

      if (leadToDelete.isBatch) {
        // Delete entire batch
        leads = leads.filter((lead) => {
          const leadBatchId =
            lead.batchId ||
            lead.timestamp?.toDate?.()?.getTime() ||
            new Date(lead.timestamp).getTime();
          return leadBatchId.toString() !== leadToDelete.batchId.toString();
        });
      } else {
        // Delete single lead
        const leadIndex = leads.findIndex(
          (lead) => lead.id === leadToDelete.leadId
        );
        if (leadIndex === -1) {
          toast.error("Lead not found in employee's leads array");
          return;
        }
        leads.splice(leadIndex, 1);
      }

      await updateDoc(employeeDocRef, {
        leads: leads,
        lastUpdated: new Date(),
      });

      toast.success(
        leadToDelete.isBatch
          ? "Batch deleted successfully"
          : "Lead deleted successfully"
      );

      // Rest of your notification logic...
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();
      const monthYearKey = `${currentYear}-${currentMonth + 1}`;

      const currentMonthLeads = leads.filter((lead) => {
        const leadDate = lead.timestamp?.toDate
          ? lead.timestamp.toDate()
          : new Date(lead.timestamp);
        return (
          leadDate.getMonth() === currentMonth &&
          leadDate.getFullYear() === currentYear
        );
      });

      if (currentMonthLeads.length < 10) {
        const notificationDocRef = doc(
          db,
          "notificationHistory",
          "leadThresholds",
          "monthlyRecords",
          monthYearKey
        );

        const notificationDocSnap = await getDoc(notificationDocRef);

        if (notificationDocSnap.exists()) {
          const notificationData = notificationDocSnap.data();
          const updatedNotifiedUserIds = (
            notificationData.notifiedUserIds || []
          ).filter((uid) => uid !== employeeData.uid);

          await updateDoc(notificationDocRef, {
            notifiedUserIds: updatedNotifiedUserIds,
            updatedAt: new Date(),
          });
        }
      }
    } catch (error) {
      console.error("Error deleting lead:", error);
      toast.error("Failed to delete lead: " + error.message);
    } finally {
      setIsDeleteModalOpen(false);
      setLeadToDelete(null);
    }
  };

  const salesColumns = [
    {
      key: "dateTime",
      label: "Created Date",
      render: (value, row) => <div>{value}</div>,
    },
    { key: "receivedDate", label: "Received Date" },
    { key: "salesPerson", label: "Sales Person" },
    {
      key: "leadSource",
      label: "Lead Source",
      render: (value, row) => (
        <div className="max-w-xs truncate" title={value}>
          {value ? value : "N/A"}
        </div>
      ),
    },
    {
      key: "amount",
      label: "Lead Amount",
      // render: (value) => `$${value.toLocaleString()}`,
      render: (value) =>
        `$${Number(value).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
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
            {row.isBatch ? "View Batch" : "View Details"}
          </button>
          <button
            className="px-4 py-2 text-white bg-red-600 rounded-lg"
            onClick={() => handleDeleteSale(row)}
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const currentClients = filteredClients.slice(startIndex, endIndex);
  const totalPages = Math.max(
    1,
    Math.ceil(filteredClients.length / rowsPerPage)
  );

  // console.log("currentClients", currentClients);

  return (
    <>
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setLeadToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title={leadToDelete?.isBatch ? "Delete Batch" : "Delete Lead"}
        message={
          leadToDelete?.isBatch
            ? `Are you sure you want to delete this batch of ${leadToDelete.leadCount} leads? This action cannot be undone.`
            : "Are you sure you want to delete this lead? This action cannot be undone."
        }
      />

      <UploadLeadModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setModalMode("create");
          setModalData(null);
        }}
        leadSources={leadSources}
        SalesPerson={SalesPerson}
        mode={modalMode}
        setModalMode={setModalMode}
        initialData={modalData}
      />
      <div className="px-4 flex items-start justify-start w-full h-full pb-8 overflow-y-auto  ">
        <div className="flex flex-col w-full h-full gap-y-8 overflow-y-auto">
          <Filters
            leadSources={leadSources}
            salesPersons={SalesPerson}
            onFilterChange={handleFilterChange}
            showFilters={showFilters}
            otherFilters={true}
            handleFilterToggle={handleFilterToggle}
            selectedLeadSource={selectedLeadSource}
            setSelectedLeadSource={setSelectedLeadSource}
            selectedSalesPerson={selectedSalesPerson}
            setSelectedSalesPerson={setSelectedSalesPerson}
            startDate={startDate}
            setStartDate={setStartDate}
            receivedStartDate={receivedStartDate}
            receivedEndDate={receivedEndDate}
            setReceivedEndDate={setReceivedEndDate}
            setReceivedStartDate={setReceivedStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
          />
          <SalesTableVA
            columns={salesColumns}
            data={currentClients}
            handleDeleteSale={handleDeleteSale}
            handleOpenViewModal={handleOpenViewModal}
          />
          <PaginationVA
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={setRowsPerPage}
          />
        </div>
      </div>
    </>
  );
};

export default LeadsPageVA;
