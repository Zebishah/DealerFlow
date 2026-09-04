import { useState, useEffect, Fragment } from "react";
import {
  collection,
  getDoc,
  getDocs,
  doc,
  query,
  where,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { Dialog, Transition } from "@headlessui/react";
import { db } from "../../../config/firebaseConfig";

const SalesPerson = () => {
  const [salesPersons, setSalesPersons] = useState([]);
  const [filteredSalesPersons, setFilteredSalesPersons] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    const fetchSalesPersons = async () => {
      try {
        const employeesRef = collection(db, "employees");
        const querySnapshot = await getDocs(employeesRef);

        const salesData = await Promise.all(
          querySnapshot.docs.map(async (employeeDoc) => {
            const employeeData = { id: employeeDoc.id, ...employeeDoc.data() };

            // Extract unique lead sources
            const leadSources = employeeData.leads
              ? [...new Set(employeeData.leads.map((lead) => lead.leadSource))]
              : [];

            // Fetch total sales count from the sales collection (document ID is the employee UID)
            let totalSales = 0;
            const salesDocRef = doc(db, "sales", employeeData.uid); // Fetch sales using UID as doc ID

            try {
              const salesDocSnap = await getDoc(salesDocRef);
              if (salesDocSnap.exists()) {
                const salesData = salesDocSnap.data();
                totalSales = salesData.sales
                  ? Object.keys(salesData.sales).length
                  : 0; // Count the number of sales instances
              }
            } catch (error) {
              console.error(
                `Error fetching sales for ${employeeData.uid}:`,
                error
              );
            }

            return {
              ...employeeData,
              leadSources,
              totalSales,
            };
          })
        );

        setSalesPersons(salesData);
        setFilteredSalesPersons(salesData);
      } catch (error) {
        console.error("Error fetching sales persons:", error);
      }
    };

    fetchSalesPersons();
  }, []);

  const handleSearch = (event) => {
    const term = event.target.value.toLowerCase();
    setSearchTerm(term);

    const filtered = salesPersons.filter((person) =>
      person.name.toLowerCase().includes(term)
    );

    setFilteredSalesPersons(filtered);
  };
  const handleViewMore = (person) => {
    setSelectedPerson(person);
    const id = encodeURIComponent(person.uid);
    navigate(`/AdminLayout/SalesOfSalesPerson/${id}`, {
      state: {
        name: person.name,
        totalLeads: person.leads?.length,
        totalSales: person.totalSales,
      },
    });
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedPerson(null);
  };

  return (
    <div className="p-6 bg-gray-100 w-[75vw] min-h-[90vh]">
      <div className="w-full mx-auto">
        <div className="mb-4 flex justify-between w-full">
          <h1 className="text-black font-bold text-xl">Sales Persons</h1>
          <input
            type="text"
            placeholder="Search by Name to Filter..."
            value={searchTerm}
            onChange={handleSearch}
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSalesPersons.map((person) => {
            // Ensure conversion rate doesn't produce Infinity or NaN
            const totalLeads = person.leads?.length || 0;
            const conversionRate =
              totalLeads > 0
                ? Math.round((person.totalSales / totalLeads) * 100)
                : 0;

            return (
              <div
                key={person.id}
                className="bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden"
              >
                <div className="p-4 flex flex-col justify-between h-full">
                  <h2 className="text-lg font-bold text-gray-800 mb-2">
                    {person.name}
                  </h2>
                  <div className="space-y-1 mb-4">
                    <p className="text-gray-600">
                      <span className="font-semibold">Total Leads:</span>{" "}
                      <span className="text-gray-500">{totalLeads}</span>
                    </p>
                    <p className="text-gray-600">
                      <span className="font-semibold">Lead Sources:</span>{" "}
                      <span className="text-gray-500">
                        {person.leadSources.join(", ") || "N/A"}
                      </span>
                    </p>
                    <p className="text-gray-600">
                      <span className="font-semibold">Total Sales:</span>{" "}
                      <span className="text-gray-500">{person.totalSales}</span>
                    </p>
                    <p className="text-gray-600">
                      <span className="font-semibold">Conversion:</span>{" "}
                      <span className="text-gray-500">{conversionRate}%</span>
                    </p>
                  </div>
                  <button
                    onClick={() => handleViewMore(person)}
                    className="w-full bg-[#011C64] text-white py-2 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    View More
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Headless UI Modal */}
        <Transition appear show={isModalOpen} as={Fragment}>
          <Dialog as="div" className="relative z-10" onClose={closeModal}>
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black/25" />
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
                      Sales Person Details
                    </Dialog.Title>
                    {selectedPerson && (
                      <div className="mt-4">
                        <p>Name: {selectedPerson.name}</p>
                        <p>Total Leads: {selectedPerson.leads?.length || 0}</p>
                        <p>
                          Lead Sources:{" "}
                          {selectedPerson.leadSources.join(", ") || "N/A"}
                        </p>
                        <p>Total Sales: {selectedPerson.totalSales}</p>
                      </div>
                    )}
                    <div className="mt-4">
                      <button
                        type="button"
                        className="inline-flex justify-center rounded-md border border-transparent bg-blue-100 px-4 py-2 text-sm font-medium text-blue-900 hover:bg-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                        onClick={closeModal}
                      >
                        Close
                      </button>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>
      </div>
    </div>
  );
};

export default SalesPerson;
