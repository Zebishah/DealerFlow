import React, { useState, useEffect } from "react";
import { X, Plus } from "lucide-react";
import {
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import { toast } from "react-toastify";
import { db } from "../../../config/firebaseConfig";
import { useAuth } from "../../../AuthContext";
import { useLeadMonitoring } from "../../AdminComponents/components/LeadsMonitor";
import DatePicker from "react-datepicker";
import { FaCalendarAlt } from "react-icons/fa";

// Custom input component with calendar icon
const CustomDatePickerInput = React.forwardRef(
  ({ value, onClick, placeholder }, ref) => (
    <div className="relative">
      <input
        value={value}
        onClick={onClick}
        placeholder={placeholder}
        ref={ref}
        className="w-full px-3 py-2 border-1 border-gray-300 rounded-lg pr-10"
      />
      <FaCalendarAlt
        onClick={onClick}
        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 cursor-pointer"
      />
    </div>
  )
);
const UploadLeadModal = ({
  isOpen,
  onClose,
  leadSources,
  SalesPerson,
  mode = "create",
  setModalMode,
  initialData,
}) => {
  const [selectedSalesPerson, setSelectedSalesPerson] = useState("");
  // const [leadRows, setLeadRows] = useState([{ leadSource: "", leadAmount: 0 }]);
  const [leadRows, setLeadRows] = useState([
    { leadSource: "", leadAmount: 0, leadCost: 0 },
  ]);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [originalData, setOriginalData] = useState(null);
  const { currentUser } = useAuth();
  const [receivedDate, setReceivedDate] = useState(null);

  useEffect(() => {
    if (initialData && mode !== "create") {
      setOriginalData(initialData);

      // Handle both single lead and batch leads cases
      if (initialData.leadsData) {
        // Single lead case
        const processedLead = {
          ...initialData.leadData,
          id: initialData.leadData.id || uuidv4(),
        };
        setLeadRows([processedLead]);

        // Handle receivedDate for single lead
        if (initialData.leadData.receivedDate) {
          const dateToSet = initialData.leadData.receivedDate.toDate
            ? initialData.leadData.receivedDate.toDate()
            : new Date(initialData.leadData.receivedDate.seconds * 1000);
          setReceivedDate(isNaN(dateToSet.getTime()) ? null : dateToSet);
        } else {
          setReceivedDate(null);
        }
      } else if (initialData.allLeads) {
        // Batch leads case - set all leads in the batch
        const processedLeads = initialData.allLeads.map((lead) => ({
          ...lead,
          id: lead.id || uuidv4(),
        }));
        setLeadRows(processedLeads);

        // Handle receivedDate for batch (use first lead's date)
        const firstLead = initialData.allLeads[0];
        if (firstLead?.receivedDate) {
          const dateToSet = firstLead.receivedDate.toDate
            ? firstLead.receivedDate.toDate()
            : new Date(firstLead.receivedDate.seconds * 1000);
          setReceivedDate(isNaN(dateToSet.getTime()) ? null : dateToSet);
        } else {
          setReceivedDate(null);
        }
      }
    } else {
      // Reset for create mode
      setLeadRows([
        { leadSource: "", leadAmount: 0, leadCost: 0, id: uuidv4() },
      ]);
      setReceivedDate(null);
    }
  }, [initialData, mode]);
  // const addNewRow = () => {
  //   setLeadRows([...leadRows, { leadSource: "", leadAmount: 0 }]);
  // };
  const addNewRow = () => {
    setLeadRows([
      ...leadRows,
      { leadSource: "", leadAmount: 0, leadCost: 0, id: uuidv4() },
    ]);
  };

  const removeRow = (index) => {
    const newRows = leadRows.filter((_, idx) => idx !== index);
    setLeadRows(newRows);
  };
  const handleLeadCostChange = (index, value) => {
    if (!isEditing && mode === "view") return;

    const parsedValue = value === "" ? "" : Math.max(0, parseInt(value) || 0);
    const newRows = [...leadRows];
    newRows[index].leadCost = parsedValue;
    setLeadRows(newRows);
  };
  const handleLeadSourceChange = (index, value) => {
    if (!isEditing && mode === "view") return;
    const newRows = [...leadRows];
    newRows[index].leadSource = value;
    setLeadRows(newRows);
  };

  const handleLeadAmountChange = (index, value) => {
    if (!isEditing && mode === "view") return;

    const parsedValue = value === "" ? "" : Math.max(0, parseInt(value) || 0);
    const newRows = [...leadRows];
    newRows[index].leadAmount = parsedValue;
    setLeadRows(newRows);
  };

  const handleEdit = () => {
    setModalMode("edit");
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    // Reset to original data
    if (originalData) {
      setLeadRows(
        originalData.allLeads.map((lead) => ({
          leadSource: lead.leadSource,
          leadAmount: lead.leadAmount,
          receivedDate: new Date(receivedDate), // Convert properly
          VAName: lead.VAName,
          VAUid: lead.VAUid,
          timestamp: lead.timestamp,
        }))
      );
    }
    setIsEditing(false);
  };

  // const handleUpdateLeads = async () => {
  //   setLoading(true);

  //   try {
  //     const employeesRef = collection(db, "employees");
  //     const q = query(
  //       employeesRef,
  //       where("uid", "==", initialData.salesPersonId)
  //     );
  //     const querySnapshot = await getDocs(q);

  //     if (querySnapshot.empty) {
  //       toast.error("Sales Person not found in database!");
  //       setLoading(false);
  //       return;
  //     }

  //     const employeeDocRef = querySnapshot.docs[0].ref;

  //     // Update leads array, without serverTimestamp inside array elements
  //     const updatedLeads = leadRows.map((lead) => ({
  //       leadSource: lead.leadSource,
  //       leadAmount: lead.leadAmount,
  //       VAName: lead.VAName || currentUser.email,
  //       VAUid: lead.VAUid || currentUser.uid,
  //       timestamp: lead.timestamp || new Date(),
  //     }));

  //     // Use serverTimestamp for the lastUpdated field
  //     await updateDoc(employeeDocRef, {
  //       leads: updatedLeads,
  //       lastUpdated: serverTimestamp(),
  //     });
  //     onClose();
  //     toast.success("Leads updated successfully!");
  //     setIsEditing(false);
  //     onClose();
  //   } catch (error) {
  //     console.error("Error updating leads:", error);
  //     toast.error("Failed to update leads.");
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const handleUpdateLeads = async () => {
    setLoading(true);
    try {
      const employeesRef = collection(db, "employees");
      const q = query(
        employeesRef,
        where("uid", "==", initialData.salesPersonId)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast.error("Sales Person not found in database!");
        setLoading(false);
        return;
      }

      const employeeDocRef = querySnapshot.docs[0].ref;
      const employeeDoc = await getDoc(employeeDocRef);
      const currentLeads = employeeDoc.data().leads || [];

      const leadsMap = new Map(currentLeads.map((lead) => [lead.id, lead]));
      const batchId = leadRows[0]?.batchId || new Date().getTime();

      leadRows.forEach((leadRow) => {
        const existingLead = leadsMap.get(leadRow.id) || {};

        leadsMap.set(leadRow.id, {
          ...existingLead,
          leadSource: leadRow.leadSource || existingLead.leadSource,
          leadAmount: leadRow.leadAmount || existingLead.leadAmount,
          leadCost: leadRow.leadCost || existingLead.leadCost,
          receivedDate: receivedDate
            ? Timestamp.fromDate(new Date(receivedDate))
            : null,
          VAName: currentUser.email,
          VAUid: currentUser.uid,
          timestamp: existingLead.timestamp || new Date(),
          batchId: existingLead.batchId || batchId,
        });
      });

      const updatedLeads = Array.from(leadsMap.values());

      await updateDoc(employeeDocRef, {
        leads: updatedLeads,
        lastUpdated: serverTimestamp(),
      });

      toast.success("Leads updated successfully!");
      setIsEditing(false);
      onClose();
    } catch (error) {
      console.error("Error updating leads:", error);
      toast.error("Failed to update leads.");
    } finally {
      setLoading(false);
      await triggerCheck();
    }
  };

  // const handleUpload = async () => {
  //   if (mode === "edit" && isEditing) {
  //     await handleUpdateLeads();
  //     return;
  //   }

  //   // Original upload logic for new leads
  //   if (!selectedSalesPerson) {
  //     toast.error("Please select a Sales Person.");
  //     return;
  //   }

  //   setLoading(true);

  //   try {
  //     const employeesRef = collection(db, "employees");
  //     const q = query(employeesRef, where("uid", "==", selectedSalesPerson));
  //     const querySnapshot = await getDocs(q);

  //     if (querySnapshot.empty) {
  //       toast.error("Sales Person not found in database!");
  //       setLoading(false);
  //       return;
  //     }

  //     const employeeDocRef = querySnapshot.docs[0].ref;
  //     const employeeData = querySnapshot.docs[0].data();

  //     // New leads to add
  //     const newLeads = leadRows.map((lead) => ({
  //       leadSource: lead.leadSource,
  //       leadAmount: lead.leadAmount,
  //       VAName: currentUser.email,
  //       VAUid: currentUser.uid,
  //       timestamp: new Date(),
  //     }));

  //     // Check for existing leads
  //     const existingLeads = employeeData.leads || [];

  //     // Merge existing and new leads
  //     const updatedLeads = [...existingLeads, ...newLeads];

  //     // Update the employee's leads and set lastUpdated timestamp
  //     await updateDoc(employeeDocRef, {
  //       leads: updatedLeads,
  //       lastUpdated: serverTimestamp(),
  //     });

  //     toast.success("Leads uploaded successfully!");
  //     onClose();
  //     setLeadRows([{ leadSource: "", leadAmount: 1 }]);
  //     setSelectedSalesPerson("");
  //   } catch (error) {
  //     console.error("Error handling leads:", error);
  //     toast.error("Failed to upload leads.");
  //   } finally {
  //     setLoading(false);
  //   }
  // };
  const { status, triggerCheck } = useLeadMonitoring(db, 10, 60);

  const handleUpload = async () => {
    if (mode === "edit" && isEditing) {
      await handleUpdateLeads();
      return;
    }

    if (!selectedSalesPerson) {
      toast.error("Please select a Sales Person.");
      return;
    }

    setLoading(true);

    try {
      const employeesRef = collection(db, "employees");
      const q = query(employeesRef, where("uid", "==", selectedSalesPerson));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast.error("Sales Person not found in database!");
        setLoading(false);
        return;
      }

      const employeeDocRef = querySnapshot.docs[0].ref;
      const employeeData = querySnapshot.docs[0].data();

      const batch = writeBatch(db);
      const batchTimestamp = new Date();

      const batchLeads = leadRows.map((lead) => ({
        id: uuidv4(), // Add unique ID for each lead
        leadSource: lead.leadSource,
        leadAmount: lead.leadAmount,
        leadCost: lead.leadCost,
        VAName: currentUser.email,
        VAUid: currentUser.uid,
        timestamp: batchTimestamp,
        batchId: batchTimestamp.getTime(),
        receivedDate: Timestamp.fromDate(new Date(receivedDate)),
      }));

      const updatedLeads = [...(employeeData.leads || []), ...batchLeads];

      batch.update(employeeDocRef, {
        leads: updatedLeads,
        lastUpdated: serverTimestamp(),
      });

      await batch.commit();

      toast.success("Leads uploaded successfully!");
      onClose();
      setLeadRows([{ leadSource: "", leadAmount: 1, leadCost: 0 }]);
      setSelectedSalesPerson("");
      setReceivedDate(null);
    } catch (error) {
      console.error("Error handling leads:", error);
      toast.error("Failed to upload leads.");
    } finally {
      setLoading(false);
    }
  };
  const handleDateChange = (date) => {
    if (!isEditing && mode === "view") return;

    // Use the Date object directly (it already represents a UTC timestamp internally)

    setReceivedDate(new Date(date.toISOString()));
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">
            {mode === "view"
              ? isEditing
                ? "Edit Leads"
                : "View Leads"
              : "Upload Lead"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-6 ">
          {/* Sales Person Dropdown */}
          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sales Person
            </label>
            <select
              value={
                mode == "view" ? initialData?.salesPerson : selectedSalesPerson
              }
              onChange={(e) => setSelectedSalesPerson(e.target.value)}
              disabled={mode === "view" || isEditing}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="">Select Sales Person</option>
              {SalesPerson.map((person) => (
                <option
                  key={person.uid}
                  value={mode == "view" ? person.name : person.uid}
                >
                  {person.name}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Received Date
            </label>
            <DatePicker
              selected={receivedDate}
              onChange={handleDateChange}
              dateFormat="yyyy-MM-dd"
              placeholderText="Select received date"
              customInput={<CustomDatePickerInput />}
              disabled={!isEditing && mode === "view"}
              className="w-full"
            />
          </div>
          {/* Lead Source and Amount Rows */}
          {leadRows.map((row, index) => (
            <div key={index} className="flex gap-4 items-end justify-center">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lead Source
                </label>
                <select
                  value={row.leadSource}
                  onChange={(e) =>
                    handleLeadSourceChange(index, e.target.value)
                  }
                  disabled={!isEditing && mode === "view"}
                  className="w-full p-2.5 border border-gray-300 rounded-md"
                >
                  <option value="">Select Lead Source</option>
                  {leadSources.map((source, i) => (
                    <option key={i} value={source}>
                      {source}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lead Amount
                </label>
                <input
                  type="number"
                  min="1"
                  value={row.leadAmount}
                  onChange={(e) =>
                    handleLeadAmountChange(index, e.target.value)
                  }
                  disabled={!isEditing && mode === "view"}
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lead Cost
                </label>
                <input
                  type="number"
                  min="0"
                  value={row.leadCost}
                  onChange={(e) => handleLeadCostChange(index, e.target.value)}
                  disabled={!isEditing && mode === "view"}
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
              </div>

              {(isEditing || mode === "create") && (
                <div className="flex justify-center items-center gap-2">
                  {index > 0 && (
                    <button
                      onClick={() => removeRow(index)}
                      className="text-white p-2 bg-red-500 rounded hover:bg-red-700"
                    >
                      <X size={20} />
                    </button>
                  )}
                  {index === leadRows.length - 1 && (
                    <button
                      onClick={addNewRow}
                      className="text-white p-2 bg-blue-600 hover:bg-blue-700 rounded"
                    >
                      <Plus size={20} />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {mode === "view" && initialData?.allLeads?.[0]?.VAName && (
            <div className="flex flex-col gap-y-3 text-sm text-gray-600">
              <p>Added by: {initialData.allLeads[0].VAName}</p>
              <p>
                Date:{" "}
                {initialData.allLeads[0].timestamp
                  ?.toDate()
                  .toLocaleDateString()}
              </p>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="mt-6 flex justify-end gap-2 ">
          {!isEditing && (
            <button
              onClick={onClose}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200"
            >
              Close
            </button>
          )}

          {mode === "view" && !isEditing && (
            <button
              onClick={handleEdit}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Edit
            </button>
          )}

          {isEditing && (
            <>
              <button
                onClick={handleCancelEdit}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateLeads}
                className="bg-blue-800 text-white px-4 py-2 rounded-md hover:bg-blue-900"
                disabled={loading}
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
            </>
          )}

          {mode === "create" && (
            <button
              onClick={handleUpload}
              className="bg-blue-800 text-white px-4 py-2 rounded-md hover:bg-blue-900"
              disabled={loading}
            >
              {loading ? "Uploading..." : "Upload"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadLeadModal;
