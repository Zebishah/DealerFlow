import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { toast } from "react-toastify";

import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useEffect, useRef, useState } from "react";
import CommissionModal from "../AdminComponents/components/CommissionModal";
import { useAuth } from "../../AuthContext";
import { db } from "../../config/firebaseConfig";
import {
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";

const CommissionTable = ({
  sales,
  handleDeleteSale,
  handleOpenViewModal,
  setShowModal,
  VA,
  onAddData,
  admin,
}) => {
  const [isTransferring, setIsTransferring] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [edit, setEdit] = useState(false);
  const [viewNote, setviewNote] = useState(false);
  const { currentUser } = useAuth();
  const [openDropDown, setOpenDropDown] = useState(false);
  const [openCommissionModal, setOpenCommissionModal] = useState(false);
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const updateReport = async (db, saleData, newStatus, newNote) => {
    let isSubmitting = true;

    try {
      if (!saleData?.documentId) throw new Error("Missing document ID");
      if (!saleData?.saleId) throw new Error("Missing sale ID");

      const saleRef = doc(db, "sales", saleData.documentId);
      const saleDoc = await getDoc(saleRef);

      if (!saleDoc.exists()) {
        throw new Error("Sale document not found");
      }

      const salesData = saleDoc.data().sales || [];

      const updatedSales = salesData.map((saleItem) => {
        if (saleItem?.saleId === saleData.saleId) {
          return {
            ...saleItem,
            reportStatus: {
              ...saleItem.reportStatus,
              status: newStatus,
              note: newNote,
            },
          };
        }
        return saleItem;
      });

      await updateDoc(saleRef, {
        sales: updatedSales,
      });

      toast.success("Report status updated successfully!");
    } catch (error) {
      console.error("Error updating report status:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update report status"
      );
    } finally {
      isSubmitting = false;
    }

    return { isSubmitting };
  };

  // handlers
  const handleAccept = () => {
    if (!selectedSale) return;
    updateReport(db, selectedSale, "accepted", "");
    // Add your actual acceptance logic here
  };

  const handleReject = (reason) => {
    if (!selectedSale) return;

    updateReport(db, selectedSale, "rejected", reason);

    // Add your actual rejection logic here
  };

  const handleCommissionModal = () => {
    setOpenCommissionModal(!openCommissionModal);
  };

  //close of the dropdown
  const dropdownRef = useRef(null); // ADD THIS
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenDropDown(null); // close dropdown if clicked outside
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  const handleTransferToNextMonth = async (sale) => {
    setIsConfirmOpen(true);
    setSelectedSale(sale);
  };

  const confirmTransfer = async () => {
    if (!selectedSale) return;

    setIsTransferring(true);
    try {
      if (selectedSale.FundStatus) {
        toast.error("This sale has already been transferred");
        return;
      }

      // Calculate next month's first date
      const currentDate = new Date(selectedSale.intermediateDate);
      const nextMonth = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        1
      );

      // Format the date and time
      const formattedDate = nextMonth.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      const now = new Date();
      const formattedTime = now.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });

      // Get all sales documents
      const salesCollection = collection(db, "sales");
      const querySnapshot = await getDocs(salesCollection);

      let found = false;

      // Iterate through all sales documents
      for (const doc of querySnapshot.docs) {
        const salesData = doc.data();
        if (salesData.sales && Array.isArray(salesData.sales)) {
          // Find the sale in the array
          const saleIndex = salesData.sales.findIndex(
            (s) => s.saleId === selectedSale.saleId
          );

          if (saleIndex !== -1) {
            found = true;
            // Create updated sales array
            const updatedSales = [...salesData.sales];
            updatedSales[saleIndex] = {
              ...updatedSales[saleIndex],
              intermediateDate: formattedDate,
              intermediateTime: formattedTime,
            };

            // Update the document
            await updateDoc(doc.ref, {
              sales: updatedSales,
            });
            break; // Exit loop once found
          }
        }
      }

      if (!found) {
        toast.error("Sale not found in any document");
        return;
      }

      toast.success(
        `Sale transferred to ${formattedDate} at ${formattedTime} successfully!`
      );
    } catch (error) {
      console.error("Error transferring sale:", error);
      toast.error("Failed to transfer sale");
    } finally {
      setIsTransferring(false);
      setIsConfirmOpen(false);
      setSelectedSale(null);
    }
  };
  return (
    <>
      <div className="overflow-x-auto">
        <div className="min-w-[800px] md:min-w-0 min-h-[280px]">
          <table className="w-full table-fixed text-sm text-left text-black rtl:text-right dark:text-black font-radios ">
            <thead className="text-sm text-gray-700 uppercase bg-gray-50 dark:bg-[#003160] dark:text-white">
              <tr>
                <th
                  scope="col"
                  className="px-2 py-3 sm:px-4 sm:py-4 rounded-tl-md"
                >
                  Sales person
                </th>
                <th
                  scope="col"
                  className="px-2 py-3 sm:px-4 sm:py-4 hidden sm:table-cell"
                >
                  Client/Dealership
                </th>
                <th scope="col" className="px-2 py-3 sm:px-4 sm:py-4">
                  Sale Date
                </th>
                <th
                  scope="col"
                  className="px-2 py-3 sm:px-4 sm:py-4 hidden md:table-cell"
                >
                  Sheet Date
                </th>
                <th
                  scope="col"
                  className="px-2 py-3 sm:px-4 sm:py-4 hidden md:table-cell"
                >
                  Report Status
                </th>
                <th
                  scope="col"
                  className="px-2 py-3 sm:px-4 sm:py-4 rounded-tr-md"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="border-t-0 border-gray-300 border-1">
              {sales && sales.length > 0 ? (
                sales.map((sale, saleIndex) => {
                  const currentDate = new Date(sale.intermediateDate);
                  const nextMonth = new Date(
                    currentDate.getFullYear(),
                    currentDate.getMonth() + 1,
                    1
                  );
                  return (
                    <tr
                      key={saleIndex}
                      className="bg-white border-b dark:bg-white dark:border-gray-300"
                    >
                      <td className="px-2 py-3 sm:px-4 sm:py-4 font-medium text-gray-900 whitespace-nowrap dark:text-black">
                        <div className="font-medium">
                          {sale.salesRep ? sale?.salesRep : "--"}
                        </div>
                      </td>
                      <td className="px-2 py-3 sm:px-4 sm:py-4 text-gray-900 hidden sm:table-cell">
                        {/* {sale.vehicleMake} {sale.vehicleModel} */}
                        {sale.customerName
                          ? sale?.customerName
                          : sale?.dealershipPurchase}
                      </td>
                      <td className="px-2 py-3 sm:px-4 sm:py-4 text-gray-900">
                        {sale.saleDate}
                      </td>
                      <td className="px-2 py-3 sm:px-4 sm:py-4 hidden md:table-cell">
                        <div className="flex items-center">
                          {sale?.reportStatus?.generatedAt
                            ? new Date(
                                sale.reportStatus.generatedAt
                              ).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })
                            : "--"}
                        </div>
                      </td>
                      <td className="px-2 py-3 sm:px-4 sm:py-4 hidden md:table-cell">
                        <div className="flex items-center">
                          <span
                            className={`inline-block w-3 h-3 rounded-full mr-2 ${
                              sale?.reportStatus?.status === "accepted"
                                ? "bg-green-500"
                                : sale?.reportStatus?.status === "pending"
                                ? "bg-yellow-300"
                                : "bg-red-500"
                            }`}
                          ></span>
                          <span className="hidden capitalize lg:inline">
                            {sale?.reportStatus?.status
                              ? sale?.reportStatus?.status
                              : "pending"}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-3 sm:px-4 sm:py-4">
                        <div className="relative">
                          {/* Three dots button */}
                          <button
                            className="p-1 rounded-full hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400"
                            onClick={() =>
                              setOpenDropDown(
                                openDropDown === sale.saleId
                                  ? null
                                  : sale.saleId
                              )
                            }
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-6 w-6 text-gray-600"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"
                              />
                            </svg>
                          </button>

                          {/* Dropdown menu */}
                          {openDropDown === sale.saleId && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-[1000]">
                              <div className="py-1">
                                {/* View Details Option */}
                                <button
                                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left disabled:opacity-50  disabled:cursor-not-allowed "
                                  onClick={() => {
                                    handleCommissionModal();
                                    // setOpenDropDown(false);
                                  }}
                                >
                                  View Details
                                </button>
                                <button
                                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left disabled:opacity-50"
                                  onClick={() => {
                                    setSelectedSale(sale); // Store the selected sale
                                    setAcceptDialogOpen(true);
                                    setOpenDropDown(false);
                                  }}
                                  disabled={
                                    sale?.reportStatus?.status === "accepted"
                                  }
                                >
                                  Accept
                                </button>

                                {/* Update Option */}
                                <button
                                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left disabled:opacity-50  disabled:cursor-not-allowed "
                                  onClick={() => {
                                    setSelectedSale(sale); // Store the selected sale
                                    setRejectDialogOpen(true);
                                    setOpenDropDown(false);
                                  }}
                                  disabled={
                                    sale?.reportStatus?.status === "accepted"
                                  }
                                >
                                  Reject
                                </button>

                                {openCommissionModal && (
                                  <CommissionModal
                                    openDialog={openCommissionModal}
                                    setOpenDialog={setOpenCommissionModal}
                                    saleData={sale}
                                    editMode={false}
                                    isEmployee={true}
                                  />
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="w-full p-4 text-center">
                    No Commission data available{" "}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Accept Confirmation Modal */}
      {acceptDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black bg-opacity-50">
          <div className="relative w-[45%] max-w-xl bg-white p-6 rounded-lg shadow-lg mt-10 mb-10 overflow-y-auto max-h-[90%]">
            <button
              onClick={() => setAcceptDialogOpen(false)}
              className="absolute text-2xl text-gray-600 top-2 right-2 hover:text-gray-800"
            >
              &times;
            </button>
            <h2 className="mb-4 text-xl font-bold text-center">
              Confirm Acceptance
            </h2>

            <div className="py-6">
              <p className="text-center mb-6">
                Are you sure you want to accept this commission?
              </p>

              <div className="flex justify-center gap-2">
                <button
                  onClick={() => setAcceptDialogOpen(false)}
                  className="px-3 py-2  text-white bg-red-500 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleAccept();
                    setAcceptDialogOpen(false);
                  }}
                  className="px-3 py-2  text-white bg-[#003160] rounded-lg"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {rejectDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black bg-opacity-50">
          <div className="relative w-[45%] max-w-xl bg-white p-6 rounded-lg shadow-lg mt-10 mb-10 overflow-y-auto max-h-[90%]">
            <button
              onClick={() => setRejectDialogOpen(false)}
              className="absolute text-2xl text-gray-600 top-2 right-2 hover:text-gray-800"
            >
              &times;
            </button>
            <h2 className="mb-4 text-xl font-bold text-center">
              Provide Rejection Reason
            </h2>

            <div className="py-6">
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for rejection (optional)
                </label>
                <textarea
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-[#003160] focus:border-transparent"
                  rows={4}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter the reason for rejection..."
                />
              </div>

              <div className="flex justify-center gap-2">
                <button
                  onClick={() => setRejectDialogOpen(false)}
                  className="px-3 py-2  text-white bg-red-500 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleReject(rejectionReason);
                    setRejectionReason("");
                    setRejectDialogOpen(false);
                  }}
                  className="px-3 py-2  text-white bg-[#003160] rounded-lg"
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CommissionTable;
