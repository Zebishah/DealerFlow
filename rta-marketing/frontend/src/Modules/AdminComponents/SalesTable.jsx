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
import { db } from "../../config/firebaseConfig";
import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useEffect, useRef, useState } from "react";
import { useAuth } from "../../AuthContext";

const SalesTable = ({
  currentClients,
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
  const { currentUser } = useAuth();
  const [openDropDown, setOpenDropDown] = useState(false);

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
      <Transition appear show={isConfirmOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setIsConfirmOpen(false)}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900"
                  >
                    Confirm Transfer
                  </Dialog.Title>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Are you sure you want to transfer this sale to the first
                      day of next month?
                    </p>
                  </div>

                  <div className="mt-4 flex justify-end space-x-3">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
                      onClick={() => setIsConfirmOpen(false)}
                      disabled={isTransferring}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 disabled:opacity-50"
                      onClick={confirmTransfer}
                      disabled={isTransferring}
                    >
                      {isTransferring ? (
                        <>
                          <svg
                            className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          Transferring...
                        </>
                      ) : (
                        "Confirm Transfer"
                      )}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>{" "}
      <div className="overflow-x-auto">
        <div className="min-w-[800px] md:min-w-0 min-h-[280px]">
          <table className="w-full table-fixed text-sm text-left text-black rtl:text-right dark:text-black font-radios ">
            <thead className="text-sm text-gray-700 uppercase bg-gray-50 dark:bg-[#003160] dark:text-white">
              <tr>
                <th
                  scope="col"
                  className="px-2 py-3 sm:px-4 sm:py-4 rounded-tl-md"
                >
                  Client/Dealership
                </th>
                <th
                  scope="col"
                  className="px-2 py-3 sm:px-4 sm:py-4 hidden sm:table-cell"
                >
                  Vehicle
                </th>
                <th scope="col" className="px-2 py-3 sm:px-4 sm:py-4">
                  Date
                </th>
                <th
                  scope="col"
                  className="px-2 py-3 sm:px-4 sm:py-4 hidden md:table-cell"
                >
                  Insurance
                </th>
                <th
                  scope="col"
                  className="px-2 py-3 sm:px-4 sm:py-4 hidden md:table-cell"
                >
                  Fund
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
              {currentClients && currentClients.length > 0 ? (
                currentClients.map((sale, saleIndex) => {
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
                          {sale.customerName
                            ? sale?.customerName
                            : sale?.dealershipPurchase}
                        </div>
                        <div className="text-xs text-gray-500 sm:hidden">
                          {sale.vehicleMake} {sale.vehicleModel}
                        </div>
                      </td>
                      <td className="px-2 py-3 sm:px-4 sm:py-4 text-gray-900 hidden sm:table-cell">
                        {sale.vehicleMake} {sale.vehicleModel}
                      </td>
                      <td className="px-2 py-3 sm:px-4 sm:py-4 text-gray-900">
                        {sale.saleDate}
                      </td>
                      <td className="px-2 py-3 sm:px-4 sm:py-4 hidden md:table-cell">
                        <div className="flex items-center">
                          <span
                            className={`inline-block w-3 h-3 rounded-full mr-2 ${
                              sale.InsuranceStatus
                                ? "bg-green-500"
                                : "bg-red-500"
                            }`}
                          ></span>
                          <span className="hidden lg:inline">
                            {sale.InsuranceStatus ? "Completed" : "Pending"}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-3 sm:px-4 sm:py-4 hidden md:table-cell">
                        <div className="flex items-center">
                          <span
                            className={`inline-block w-3 h-3 rounded-full mr-2 ${
                              sale.FundStatus ? "bg-green-500" : "bg-red-500"
                            }`}
                          ></span>
                          <span className="hidden lg:inline">
                            {sale.FundStatus ? "Completed" : "Pending"}
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
                                {/* Move/Transfer Option */}
                                {currentUser.userType == "Admin" && (
                                  <button
                                    className={`block px-4 py-2 text-sm w-full text-left ${
                                      sale.FundStatus
                                        ? "text-gray-400 cursor-not-allowed"
                                        : "text-gray-700 hover:bg-gray-100"
                                    }`}
                                    disabled={sale.FundStatus}
                                    onClick={() => {
                                      handleTransferToNextMonth(sale);
                                      setOpenDropDown(null); // close dropdown after click
                                    }}
                                    title={
                                      sale.FundStatus
                                        ? "Fund Status Paid - Can't Transfer"
                                        : `Will transfer to ${nextMonth.toLocaleDateString(
                                            "en-GB",
                                            {
                                              month: "long",
                                              year: "numeric",
                                            }
                                          )}`
                                    }
                                  >
                                    Move to Next Month
                                  </button>
                                )}

                                {/* View Details Option */}
                                <button
                                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                                  onClick={() => {
                                    handleOpenViewModal(sale);
                                    setOpenDropDown(null); // close dropdown after click
                                  }}
                                >
                                  View Details
                                </button>

                                {/* Update Option */}
                                <button
                                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                                  onClick={() => {
                                    onAddData(sale);
                                    setOpenDropDown(null); // close dropdown after click
                                  }}
                                >
                                  Update
                                </button>

                                {/* Delete Sale Option */}
                                {!VA && (
                                  <button
                                    className="block px-4 py-2 text-sm text-red-600 hover:bg-gray-100 w-full text-left"
                                    onClick={() => {
                                      if (
                                        window.confirm(
                                          "Are you sure you want to delete this sale? This action cannot be undone."
                                        )
                                      ) {
                                        handleDeleteSale(
                                          sale.saleId,
                                          sale.documentId
                                        );
                                        setOpenDropDown(null); // close dropdown after click (even if cancel delete)
                                      }
                                    }}
                                  >
                                    Delete Sale
                                  </button>
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
                    No sales data available{" "}
                    {!VA && !admin && (
                      <button
                        className="text-blue-600 font-radios font-semibold"
                        onClick={() => setShowModal(true)}
                      >
                        Add New Sale
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default SalesTable;
