import React, { useEffect, useState } from "react";
import { Pencil, Trash2, Check } from "lucide-react";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
  query,
  setDoc,
} from "firebase/firestore";
import { db } from "../../config/firebaseConfig";
import { toast } from "react-toastify";
import { Dialog, DialogContent, DialogTitle } from "@mui/material";
import FinanceProviderManager from "../UIComponents/FinanceProvidersModal";

const SalesHeader = ({ VA }) => {
  const [showModal, setShowModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  return (
    <>
      <div className="flex items-center justify-between w-full">
        <div className="text-2xl pt-4 font-bold">Sales</div>
        <div className="flex flex-row gap-4">
          {/* <button
            className="bg-[#003160] hover:bg-[#173652] text-white px-10 py-2 rounded-full text-lg"
            onClick={() => setShowModal(true)}
          >
            Lead sources
          </button> */}
          {!VA && (
            <button
              className="bg-[#003160] hover:bg-[#173652] text-white px-10 py-2 rounded-full text-lg mb-4"
              onClick={() => setShowLimitModal(true)}
            >
              Set Limit
            </button>
          )}
        </div>
      </div>
      <FinanceProviderManager />
      <LeadSourceModal open={showModal} onClose={() => setShowModal(false)} />
      <LimitModal
        open={showLimitModal}
        onClose={() => setShowLimitModal(false)}
      />
    </>
  );
};
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

// const LimitModal = ({ open, onClose }) => {
//   const [limit, setLimit] = useState("");
//   const [selectedMonth, setSelectedMonth] = useState("January"); // Default: January
//   const [docId, setDocId] = useState(null);

//   // Fetch the existing limit for the selected month
//   useEffect(() => {
//     const fetchLimit = async () => {
//       try {
//         const q = query(
//           collection(db, "SalesLimit"),
//           where("month", "==", selectedMonth)
//         );
//         const querySnapshot = await getDocs(q);

//         if (!querySnapshot.empty) {
//           const doc = querySnapshot.docs[0];
//           setLimit(doc.data().limit);
//           setDocId(doc.id); // Store doc ID for updates
//         } else {
//           setLimit(""); // No limit set for this month
//           setDocId(null);
//         }
//       } catch (error) {
//         console.error("Error fetching sales limit:", error);
//       }
//     };

//     fetchLimit();
//   }, [selectedMonth]);

//   const handleSubmit = async (e) => {
//     e.preventDefault();

//     if (limit.trim() === "") {
//       toast.error("Limit cannot be empty");
//       return;
//     }

//     try {
//       const limitRef = doc(db, "SalesLimit", docId || `${selectedMonth}-limit`);

//       await setDoc(limitRef, {
//         limit,
//         month: selectedMonth,
//         createdAt: new Date(),
//       });

//       toast.success(`Limit for ${selectedMonth} updated successfully!`);
//       onClose();
//     } catch (error) {
//       toast.error("Error updating limit: " + error.message);
//     }
//   };

//   return (
//     <Dialog
//       open={open}
//       onClose={onClose}
//       maxWidth="md"
//       fullWidth
//       PaperProps={{
//         sx: {
//           width: "60%",
//           maxWidth: "700px",
//           margin: "32px auto",
//           borderRadius: "12px",
//           height: "auto",
//           maxHeight: "90vh",
//         },
//       }}
//     >
//       <DialogContent sx={{ padding: "24px", overflow: "auto" }}>
//         <DialogTitle sx={{ padding: "0 0 24px 0" }}>
//           <div className="flex items-center justify-between">
//             <h1 className="text-2xl font-bold font-radios">Gross Profit Benchmark</h1>
//           </div>
//         </DialogTitle>

//         <div className="w-full">
//           <form onSubmit={handleSubmit} className="flex flex-col w-full items-end">
//             {/* Month Dropdown */}
//             <label htmlFor="month" className="text-xl font-medium self-start">
//               Select Month
//             </label>
//             <Select
//               value={selectedMonth}
//               onChange={(e) => setSelectedMonth(e.target.value)}
//               className="block w-full border-2 border-gray-300 p-3 rounded-md my-2"
//             >
//               {months.map((month) => (
//                 <MenuItem key={month} value={month}>
//                   {month}
//                 </MenuItem>
//               ))}
//             </Select>

//             {/* Set Limit Field */}
//             <label htmlFor="sales-limit" className="text-xl font-medium self-start">
//               Set Limit
//             </label>
//             <input
//               type="number"
//               value={limit}
//               placeholder="Set Limit"
//               className="block border-2 w-full border-gray-300 p-3 rounded-md my-2"
//               onChange={(e) => setLimit(e.target.value)}
//             />

//             {/* Buttons */}
//             <div className="flex gap-4 mt-2">
//               <button
//                 type="button"
//                 onClick={onClose}
//                 className="px-8 py-2 text-xl rounded-md border-2 border-gray-300 hover:bg-gray-50"
//               >
//                 Cancel
//               </button>
//               <button
//                 type="submit"
//                 className="bg-blue-900 text-white py-2 px-8 text-xl rounded-md"
//               >
//                 Submit
//               </button>
//             </div>
//           </form>
//         </div>
//       </DialogContent>
//     </Dialog>
//   );
// };

const LimitModal = ({ open, onClose }) => {
  const [limit, setLimit] = useState("");
  const [docId, setDocId] = useState(null); // Store document ID for updates

  // Fetch the existing limit from Firestore on mount
  useEffect(() => {
    const fetchLimit = async () => {
      try {
        const q = query(collection(db, "SalesLimit"));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const doc = querySnapshot.docs[0];
          setLimit(doc.data().limit);
          setDocId(doc.id); // Store the document ID for updating
        }
      } catch (error) {
        console.error("Error fetching sales limit:", error);
      }
    };

    fetchLimit();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (limit.trim() === "") {
      toast.error("Limit cannot be empty");
      return;
    }

    try {
      // const limitRef = doc(db, "SalesLimit", docId || "salesLimitDoc"); // Use existing doc or create a default one
      const limitRef = doc(db, "SalesLimit", docId); // Use existing doc or create a default one
      await setDoc(limitRef, { limit, createdAt: new Date() }); // setDoc replaces existing data

      toast.success("Limit updated successfully!");
      onClose();
    } catch (error) {
      toast.error("Error updating limit: " + error.message);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          width: "60%",
          maxWidth: "700px",
          margin: "32px auto",
          borderRadius: "12px",
          height: "auto",
          maxHeight: "90vh",
        },
      }}
    >
      <DialogContent
        sx={{
          padding: "24px",
          overflow: "auto",
        }}
      >
        <DialogTitle sx={{ padding: "0 0 24px 0" }}>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold font-radios">
              Gross Profit BenchMark
            </h1>
          </div>
        </DialogTitle>
        <div className="w-full ">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col w-full items-end"
          >
            <label
              htmlFor="sales-limit"
              className="text-xl font-medium self-start"
            >
              {"Set Limit"}
            </label>
            <input
              type="number"
              value={limit}
              placeholder="Set Limit"
              className="block border-2 w-full border-gray-300 p-3 rounded-md my-2"
              onChange={(e) => setLimit(e.target.value)}
            />
            <div className="flex gap-4 mt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-8 py-2 text-xl rounded-md border-2 border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-blue-900 text-white py-2 px-8 text-xl rounded-md"
              >
                Submit
              </button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const LeadSourceModal = ({ open, onClose }) => {
  const [leads, setLeads] = useState([]);
  const [inputLead, setInputLead] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");

  React.useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "leads"));
      const fetchedLeads = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        leadName: doc.data().leadName,
      }));
      setLeads(fetchedLeads);
    } catch (error) {
      console.error("Error fetching leads: ", error);
      toast.error("Failed to fetch leads: " + error.message);
    }
  };

  const handleInput = (e) => {
    setInputLead(e.target.value);
  };

  const startEditing = (lead) => {
    setEditingId(lead.id);
    setEditText(lead.leadName);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditText("");
  };

  const handleDelete = async (leadId) => {
    try {
      await deleteDoc(doc(db, "leads", leadId));
      toast.success("Lead deleted successfully!");
      fetchLeads();
    } catch (error) {
      toast.error("Error deleting lead: " + error.message);
    }
  };

  const handleSubmitEdit = async (leadId) => {
    if (editText.trim() === "") {
      toast.error("Lead Source cannot be empty");
      return;
    }

    const lowerCaseEdit = editText.toLowerCase();
    const capitalizedEdit =
      lowerCaseEdit.charAt(0).toUpperCase() + lowerCaseEdit.slice(1);

    const isDuplicate = leads.some(
      (lead) =>
        lead.id !== leadId &&
        lead.leadName.toLowerCase() === capitalizedEdit.toLowerCase()
    );

    if (isDuplicate) {
      toast.error("Lead Source already exists");
      return;
    }

    try {
      await updateDoc(doc(db, "leads", leadId), {
        leadName: capitalizedEdit,
        updatedAt: new Date(),
      });
      toast.success("Lead Source updated successfully!");
      setEditingId(null);
      fetchLeads();
    } catch (error) {
      toast.error("Error updating lead: " + error.message);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    if (inputLead.trim() === "") {
      toast.error("Lead Source cannot be empty");
      return;
    }

    const lowerCaseLead = inputLead.toLowerCase();
    const capitalizedLead =
      lowerCaseLead.charAt(0).toUpperCase() + lowerCaseLead.slice(1);

    const isDuplicate = leads.some(
      (lead) => lead.leadName.toLowerCase() === capitalizedLead.toLowerCase()
    );

    if (isDuplicate) {
      toast.error("Lead Source already exists");
      return;
    }

    try {
      await addDoc(collection(db, "leads"), {
        leadName: capitalizedLead,
        createdAt: new Date(),
      });
      toast.success("Lead Source added successfully!");
      setShowForm(false);
      setInputLead("");
      fetchLeads();
    } catch (error) {
      toast.error("Error adding lead: " + error.message);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          width: "60%",
          maxWidth: "700px",
          margin: "32px auto",
          borderRadius: "12px",
          height: "auto",
          maxHeight: "90vh",
        },
      }}
    >
      <DialogContent
        sx={{
          padding: "24px",
          overflow: "auto",
        }}
      >
        <DialogTitle sx={{ padding: "0 0 24px 0" }}>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold font-radios">Lead Sources</h1>
            <button
              className="bg-blue-900 text-white px-10 py-2 rounded-full text-2xl"
              onClick={() => setShowForm(true)}
            >
              Add lead source <span>+</span>
            </button>
          </div>
        </DialogTitle>
        {showForm && (
          <div className="w-full px-6">
            <form
              onSubmit={handleFormSubmit}
              className="flex flex-col w-full items-end"
            >
              <label
                htmlFor="lead-source"
                className="text-xl font-medium self-start"
              >
                {"New Lead Source"}
              </label>
              <input
                type="text"
                value={inputLead}
                placeholder="Lead source"
                className="block border-2 w-full border-gray-300 p-3 rounded-md my-2"
                onChange={handleInput}
              />
              <div className="flex gap-4 mt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-8 py-2 text-xl rounded-md border-2 border-gray-300 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-900 text-white py-2 px-8 text-xl rounded-md"
                >
                  Upload
                </button>
              </div>
            </form>
          </div>
        )}
        <div>
          <ul className="py-10 px-6 space-y-4">
            {leads.map((lead) => (
              <li
                key={lead.id}
                className="flex items-center justify-between text-xl font-medium bg-white shadow-lg p-4 rounded-xl text-white"
              >
                {editingId === lead.id ? (
                  <input
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="text-blue-500 bg-transparent border-b-2 border-blue-500 focus:outline-none px-1"
                    autoFocus
                  />
                ) : (
                  <span className="list-disc text-blue-500">
                    {lead.leadName}
                  </span>
                )}
                <div className="flex gap-4">
                  {editingId === lead.id ? (
                    <button
                      onClick={() => handleSubmitEdit(lead.id)}
                      className="bg-green-600 hover:bg-green-800 text-white p-2 rounded-md"
                    >
                      <Check className="h-5 w-5" />
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => startEditing(lead)}
                        className="bg-blue-600 hover:bg-blue-800 text-white p-2 rounded-md"
                      >
                        <Pencil className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(lead.id)}
                        className="bg-red-600 hover:bg-red-800 text-white p-2 rounded-md"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SalesHeader;
