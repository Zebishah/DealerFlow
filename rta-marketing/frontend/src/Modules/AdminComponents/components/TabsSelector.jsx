import React from "react";

const TabsSelector = ({ tab, setTab, options }) => {
  return (
    <div className="relative bg-white rounded-lg shadow-md">
      <div>
        <div className="flex gap-2">
          {options.map((option) => {
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setTab(option.value)}
                className={`px-4 py-2 text-lg font-medium rounded-t-lg transition-all duration-200 ${
                  tab === option.value
                    ? "bg-[#011c64] text-white shadow-sm"
                    : "text-[#011c64] hover:bg-[#011c64] hover:text-white"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TabsSelector;
