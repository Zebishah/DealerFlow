import React, { useState, useEffect } from "react";
import { IoChevronDown, IoCheckmark } from "react-icons/io5";
import { Menu } from "@headlessui/react";

const MultiSelectLeadSource = ({
  leadSources,
  selectedLeadSources,
  setSelectedLeadSources,
}) => {
  // Handle selecting/deselecting a lead source
  const toggleLeadSource = (source) => {
    if (source === "All") {
      // If "All" is selected, only select "All"
      setSelectedLeadSources(["All"]);
    } else {
      // If clicking on a specific source
      setSelectedLeadSources((prev) => {
        // If "All" was previously selected, remove it
        const withoutAll = prev.filter((item) => item !== "All");

        // Check if the source is already selected
        if (withoutAll.includes(source)) {
          // If we're removing the last source, select "All" again
          const result = withoutAll.filter((item) => item !== source);
          return result.length === 0 ? ["All"] : result;
        } else {
          // Add the new source
          return [...withoutAll, source];
        }
      });
    }
  };

  // Compute display text for the button
  const getButtonText = () => {
    if (selectedLeadSources.includes("All")) {
      return "All";
    }
    if (selectedLeadSources.length === 1) {
      return selectedLeadSources[0];
    }
    if (selectedLeadSources.length <= 2) {
      return selectedLeadSources.join(", ");
    }
    return `${selectedLeadSources.length} sources selected`;
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="block text-gray-700 text-sm font-bold mb-1">
        Lead Source:
      </label>
      <Menu as="div" className="relative inline-block text-left min-w-[200px]">
        <Menu.Button className="w-full flex items-center justify-between bg-white border border-gray-300 rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm">
          {getButtonText()}
          <IoChevronDown className="ml-2 h-4 w-4" />
        </Menu.Button>
        <Menu.Items className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
          {leadSources.map((source) => (
            <Menu.Item key={source}>
              {({ active }) => (
                <button
                  className={`${
                    active ? "bg-blue-100 text-blue-900" : "text-gray-900"
                  } group flex w-full items-center px-4 py-2 text-sm ${
                    selectedLeadSources.includes(source)
                      ? "bg-gray-100 font-medium"
                      : ""
                  }`}
                  onClick={() => toggleLeadSource(source)}
                >
                  <div className="flex items-center w-full">
                    <div className="mr-2 h-4 w-4 flex items-center justify-center">
                      {selectedLeadSources.includes(source) && (
                        <IoCheckmark className="h-4 w-4 text-blue-600" />
                      )}
                    </div>
                    {source}
                  </div>
                </button>
              )}
            </Menu.Item>
          ))}
        </Menu.Items>
      </Menu>
    </div>
  );
};

export default MultiSelectLeadSource;
