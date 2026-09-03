import { FaPlus } from "react-icons/fa6";
// Import context
import MonthlyTargetModal from "./components/MonthlyTargetModal";
import SalesTableVA from "../../shared/VirtualAssistantComponents/TableComponent";
import { useSalesData } from "../../SalesDataContext";
import { useState } from "react";

const MonthlyTarget = () => {
  const { salesData, loading, selectedMonth, setSelectedMonth, fetchData } =
    useSalesData();
  const [showModal, setShowModal] = useState(false);

  const closeModal = (value) => {
    setShowModal(value);
  };

  const columns = [
    { key: "name", label: "Name" },
    { key: "target", label: "Target" },
    { key: "salesCompleted", label: "Sales Completed" },
    { key: "pending", label: "Pending" },
    { key: "midMonth", label: "Mid-Month Sales" },
  ];

  return (
    <>
      <div className="flex items-start justify-start w-full px-12 py-8 overflow-y-auto h-full">
        <div className="flex flex-col w-full h-full gap-y-8">
          <div className="flex flex-row items-center justify-between w-full">
            <h1 className="text-2xl font-semibold">Monthly Targets</h1>
            <button
              type="button"
              className="flex flex-row items-center px-10 py-2 text-lg  text-white bg-[#003160] rounded-full cursor-pointer gap-x-3 hover:bg-blue-900 transition-all ease-in-out duration-300"
              onClick={() => setShowModal(true)}
            >
              Add Sales Target
              <FaPlus className="w-4 h-4" />
            </button>
          </div>

          {/* Month Selector */}
          <div className="flex items-center justify-end gap-4 w-full">
            <label className="text-lg font-medium">Select Month:</label>
            <input
              type="month"
              className="w-full px-8 py-2 pr-4 border border-gray-300 rounded-md bg-white text-gray-500 cursor-pointer max-w-[208px] h-[41.78px]"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </div>

          <SalesTableVA columns={columns} data={salesData} loading={loading} />
        </div>
      </div>

      {showModal && (
        <MonthlyTargetModal setShowModal={closeModal} fetchData={fetchData} />
      )}
    </>
  );
};

export default MonthlyTarget;
