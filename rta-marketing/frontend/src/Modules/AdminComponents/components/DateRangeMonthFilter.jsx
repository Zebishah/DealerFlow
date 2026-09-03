import DatePicker from "react-datepicker";
import { FaCalendarAlt } from "react-icons/fa";
import { useState } from "react";

const DateRangeMonthFilter = ({
  onFilterChange,
  showFilters,
  handleFilterToggle,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  selectedMonth,
  setSelectedMonth,
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());

  const handleApplyFilters = () => {
    onFilterChange({ startDate, endDate, selectedMonth });
  };

  return (
    <div className="w-full">
      <button
        onClick={handleFilterToggle}
        className="flex items-center px-4 py-3 ml-auto text-white bg-[#003160] rounded-lg"
      >
        <FaCalendarAlt className="mr-2" />
        Toggle Filters
      </button>

      {showFilters && (
        <div className="mt-4 flex items-center justify-end">
          {/* Date Pickers */}
          <div className="flex items-center mx-4">
            <label className="mr-2">From:</label>
            <DatePicker
              selected={startDate}
              onChange={(date) => setStartDate(date)}
              dateFormat="dd MMM yyyy"
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />
            <label className="ml-4 mr-2">To:</label>
            <DatePicker
              selected={endDate}
              onChange={(date) => setEndDate(date)}
              dateFormat="dd MMM yyyy"
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          {/* Month Filter */}
          <div className="relative w-52 mx-4">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-8 py-2 pr-4 border border-gray-300 rounded-md bg-white text-gray-500 cursor-pointer"
            >
              <option value="">Select Month</option>
              {[...Array(12).keys()].map((month) => {
                const date = new Date();
                date.setMonth(month);
                return (
                  <option key={month} value={month}>
                    {date.toLocaleString("default", { month: "long" })}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Apply and Clear Filters */}
          <button
            onClick={handleApplyFilters}
            className="px-3 py-2 mx-4 text-white bg-[#003160] rounded-lg"
          >
            Apply Filter
          </button>
          <button
            onClick={() => {
              setStartDate(null);
              setEndDate(null);
              setSelectedMonth(currentMonth);
              onFilterChange({
                startDate: null,
                endDate: null,
                selectedMonth: currentMonth,
              });
            }}
            className="px-3 py-2 text-white bg-red-500 rounded-lg"
          >
            Clear Filter
          </button>
        </div>
      )}
    </div>
  );
};

export default DateRangeMonthFilter;
