import { TextField } from "@mui/material";
import React from "react";
import DatePicker from "react-datepicker";
import { FaCalendarAlt } from "react-icons/fa";

const Filters = ({
  leadSources = [],
  salesPersons = [""],
  onFilterChange,
  showFilters,
  otherFilters = true,
  handleFilterToggle,
  selectedLeadSource,
  setSelectedLeadSource,
  selectedSalesPerson,
  setSelectedSalesPerson,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  receivedStartDate,
  setReceivedStartDate,
  receivedEndDate,
  setReceivedEndDate,
}) => {
  const handleApplyFilters = () => {
    onFilterChange({
      selectedLeadSource,
      selectedSalesPerson,
      startDate,
      endDate,
      receivedStartDate,
      receivedEndDate,
    });
  };

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
          <div className="flex flex-col gap-y-4">
            {/* Sales Person Dropdown */}
            <div className="flex items-center">
              {otherFilters && (
                <>
                  <div className="flex flex-col gap-4">
                    <label className="ml-4">Sales Person:</label>
                    <div className="relative w-52 mx-4">
                      <select
                        value={selectedSalesPerson}
                        onChange={(e) => setSelectedSalesPerson(e.target.value)}
                        className="w-full px-8 py-2.5 pr-4 border border-gray-300 rounded-md bg-white text-gray-500 cursor-pointer"
                      >
                        <option value="">Sales Person</option>
                        {salesPersons?.map((person) => (
                          <option key={person.uid} value={person.uid}>
                            {person.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <label className="ml-4">Lead Source:</label>
                    <div className="relative w-52 mx-4">
                      <select
                        value={selectedLeadSource}
                        onChange={(e) => setSelectedLeadSource(e.target.value)}
                        className="w-full px-8 py-2.5 pr-4 border border-gray-300 rounded-md bg-white text-gray-500 cursor-pointer"
                      >
                        <option value="">Lead Source</option>
                        {leadSources?.map((lead) => (
                          <option key={lead} value={lead}>
                            {lead}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}
              {/* Date Pickers */}
              <div className="flex items-center mx-4 gap-4">
                <div className="flex flex-col gap-4">
                  <label className="">Created Date From:</label>
                  <DatePicker
                    selected={startDate}
                    onChange={(date) => setStartDate(date)}
                    dateFormat="dd MMM yyyy"
                    placeholderText="Select Start Date"
                    customInput={<CustomDatePickerInput />}
                  />
                </div>
                <div className="flex flex-col gap-4">
                  <label className="">Created Date To:</label>
                  <DatePicker
                    selected={endDate}
                    onChange={(date) => setEndDate(date)}
                    dateFormat="dd MMM yyyy"
                    placeholderText="Select End Date"
                    customInput={<CustomDatePickerInput />}
                  />
                </div>
              </div>
              <div className="flex items-center gap-4 mx-4 my-2">
                <div className="flex flex-col gap-4 ">
                  <label className="">Received Date From:</label>
                  <DatePicker
                    selected={receivedStartDate}
                    onChange={(date) => {
                      setReceivedStartDate(date);
                    }}
                    dateFormat="dd MMM yyyy"
                    placeholderText="Select Received Start Date"
                    customInput={<CustomDatePickerInput />}
                  />
                </div>
                <div className="flex flex-col gap-4 ">
                  <label className="">Received Date To:</label>
                  <DatePicker
                    selected={receivedEndDate}
                    onChange={(date) => setReceivedEndDate(date)}
                    dateFormat="dd MMM yyyy"
                    placeholderText="Select Received End Date"
                    customInput={<CustomDatePickerInput />}
                  />
                </div>
              </div>{" "}
            </div>
            <div className="flex w-full justify-end gap-2">
              {/* Apply and Clear Filters */}
              <button
                onClick={handleApplyFilters}
                className="px-3 py-2 mx-4 text-white bg-[#003160] rounded-lg"
              >
                Apply Filter
              </button>
              <button
                onClick={() => {
                  setSelectedLeadSource("");
                  setSelectedSalesPerson("");
                  setStartDate(null);
                  setEndDate(null);
                  onFilterChange({
                    selectedLeadSource: "",
                    selectedSalesPerson: "",
                    startDate: null,
                    endDate: null,
                  });
                }}
                className="px-3 py-2 text-white bg-red-500 rounded-lg"
              >
                Clear Filter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Filters;
