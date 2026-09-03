import React from "react";

const SaleTabs = ({ selectedSaleType, onSaleTypeChange }) => {
  return (
    <div className="relative bg-white rounded-lg shadow-md">
      {/* Sale Type Tabs - Enhanced */}
      <div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onSaleTypeChange("all")}
            className={`px-4 py-2 text-lg font-medium rounded-t-lg transition-all duration-200 ${
              selectedSaleType === "all"
                ? "bg-[#011c64] text-white shadow-sm"
                : "text-[#011c64] hover:bg-[#011c64] hover:text-white"
            }`}
          >
            All Sales
          </button>
          <button
            type="button"
            onClick={() => onSaleTypeChange("individual")}
            className={`px-4 py-2 text-lg font-medium rounded-t-lg transition-all duration-200 ${
              selectedSaleType === "individual"
                ? "bg-[#011c64] text-white shadow-sm"
                : "text-[#011c64] hover:bg-[#011c64] hover:text-white"
            }`}
          >
            Individual
          </button>
          <button
            type="button"
            onClick={() => onSaleTypeChange("wholesale")}
            className={`px-4 py-2 text-lg font-medium rounded-t-lg transition-all duration-200 ${
              selectedSaleType === "wholesale"
                ? "bg-[#011c64] text-white shadow-sm"
                : "text-[#011c64] hover:bg-[#011c64] hover:text-white"
            }`}
          >
            Wholesale
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaleTabs;
