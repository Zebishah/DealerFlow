import { GrLinkNext } from "react-icons/gr";
import { IoMdClose } from "react-icons/io";
import { toast } from "react-toastify";
import { useAuth } from "../../AuthContext";

import {
  IoAddCircleOutline,
  IoArrowBack,
  IoRemoveCircleOutline,
} from "react-icons/io5";
import {
  Button,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import React, { useEffect } from "react";
const SaleForm2 = ({
  formData,
  setShowModal,
  handleInputChange,
  setThirdForm,
  setFormData,
  setSecondForm,
  setFirstForm,
}) => {
  const { currentUser } = useAuth();
  const calculateGrossProfit = () => {
    const {
      salePrice,
      unitCost,
      warCost,
      warr,
      gap,
      gapCost,
      admin,
      pac,
      safety,
      reserve,
      otherCostItems,
    } = formData;

    if (isSecondFormDataValid()) {
    // Safe number parser: empty/undefined → 0
    const toNum = (v) => {
      const n = parseFloat(v);
      return isNaN(n) ? 0 : n;
    };

    const otherCostsTotal = otherCostItems?.reduce((sum, item) => {
      const amt = toNum(item.amount);
      return sum + amt;
    }, 0);

      const grossProfit =
     toNum(salePrice) -
      toNum(unitCost) +
      toNum(warr) +
      toNum(admin) +
      toNum(gap) -
      toNum(warCost) -
      toNum(gapCost) -
      toNum(pac) -
      toNum(safety) +
      toNum(reserve) -
      otherCostsTotal;

      setFormData((prevData) => ({
        ...prevData,
        grossProfit: grossProfit.toFixed(2),
      }));

    } else {
      toast.error("Please fill in all required fields.");
    }
  };

  const isSecondFormDataValid = () => {
    const requiredFields = [
      formData.salePrice,
      formData.unitCost,
      formData.warCost,
      formData.admin,
      formData.gapCost,
      formData.pac,
      formData.safety,
      formData.reserve,

      formData.saleDate, // Check if date is set
    ];

    // Checking that string fields are not empty and numeric fields are not NaN or null
    return requiredFields.every((value) => {
      if (typeof value === "string") {
        return value.trim() !== ""; // Check if the string is not empty
      }
      return value !== null && value !== undefined && !isNaN(value); // For numbers, ensure they are not null, undefined, or NaN
    });
  };
  const handleSecondNext = () => {
    if (isSecondFormDataValid() && formData.grossProfit) {
      setShowModal(false);
      setSecondForm(false);
      setThirdForm(true);
    } else {
      toast.error(
        "Please fill in all required fields and calculate gross profit."
      );
    }
  };
  useEffect(() => {
    // you can inline the validity check if you want—or just call your fn:
    if (isSecondFormDataValid()) {
      calculateGrossProfit();
    }
  }, [
    formData.salePrice,
    formData.unitCost,
    formData.warCost,
    formData.warr,
    formData.gap,
    formData.gapCost,
    formData.admin,
    formData.pac,
    formData.safety,
    formData.reserve,
    formData.otherCostItems,
  ]);
  const handleGoBack = () => {
    //code here
    setSecondForm(false);
    setFirstForm(true);
    setShowModal(true);
  };
  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-screen loading-spinner">
        {/* Spinner */}
        <div className="w-16 h-16 border-4 rounded-full border-t-transparent border-gray-900/50 animate-spin"></div>
      </div>
    ); // or you can display a fallback UI or redirect
  }
  const handleAddOtherCost = () => {
    setFormData((prev) => ({
      ...prev,
      otherCostItems: [
        ...prev?.otherCostItems,
        { amount: "", description: "" },
      ],
    }));
  };

  const handleRemoveOtherCost = (index) => {
    setFormData((prev) => ({
      ...prev,
      otherCostItems: prev?.otherCostItems?.filter((_, i) => i !== index),
    }));
  };

  const handleOtherCostChange = (index, field, value) => {
    setFormData((prev) => {
      const updatedItems = [...prev?.otherCostItems];
      updatedItems[index] = {
        ...updatedItems[index],
        [field]: value,
      };
      return { ...prev, otherCostItems: updatedItems };
    });
  };
  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center w-full overflow-x-hidden overflow-y-auto outline-none focus:outline-none">
        <div className="relative w-[90%] sm:w-[80%] md:w-[70%] lg:w-[50%] xl:w-[45%] mx-auto my-6 h-[90vh]">
          {/* Modal Content */}
          <div className="relative flex flex-col w-full h-full bg-white border-0 rounded-lg shadow-lg outline-none focus:outline-none">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-solid rounded-t border-blueGray-200">
              <h1 className="w-full text-2xl font-bold text-center text-black font-radios">
                Add a New Sale 2
              </h1>
              <button
                className="float-right ml-auto -mt-1.5 font-semibold leading-none text-black border-0 outline-none focus:outline-none"
                onClick={() => setSecondForm(false)}
              >
                <span className="block text-3xl text-black outline-none focus:outline-none cursor-pointer">
                  <IoMdClose />
                </span>
              </button>
            </div>
            {/* Body */}
            <div className="relative flex flex-col items-center justify-center w-full p-6 overflow-y-auto">
              <div className="w-full h-full overflow-y-auto p-4 pt-0">
                {" "}
                {/* Ensure the body scrolls */}
                <form className="flex flex-col justify-center items-center w-[80%] mx-auto gap-y-4">
                  <div className="self-start  flex gap-4">
                    <button
                      onClick={() => {
                        handleGoBack();
                      }}
                    >
                      <IoArrowBack size={20} />
                    </button>
                    <h1 className="w-full mb-1 text-xl font-extrabold text-black text-start font-radios">
                      Gross Profit Calculator
                    </h1>
                  </div>

                  <div className="flex flex-row flex-wrap items-center justify-between w-full ">
                    {/* Form fields */}
                    <div className="w-[48%] mb-2">
                      <label
                        htmlFor="salePrice"
                        className="block mb-2 text-sm font-medium text-gray-900 font-radios "
                      >
                        Sale Price
                      </label>
                      <input
                        type="number"
                        id="salePrice"
                        value={formData.salePrice}
                        onChange={handleInputChange}
                        className="block w-full p-3 text-sm text-gray-900 border border-gray-300 rounded-lg shadow-sm bg-gray-50 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:placeholder-gray-400 dark:focus:ring-blue-500 dark:focus:border-blue-500 dark:shadow-sm-light"
                        placeholder="Sale Price"
                        required
                      />
                    </div>
                    <div className="w-[48%] mb-2">
                      <label
                        htmlFor="unitCost"
                        className="block mb-2 text-sm font-medium text-gray-900 font-radios "
                      >
                        Unit Cost
                      </label>
                      <input
                        type="number"
                        id="unitCost"
                        value={formData.unitCost}
                        onChange={handleInputChange}
                        className="block w-full p-3 text-sm text-gray-900 border border-gray-300 rounded-lg shadow-sm bg-gray-50 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:placeholder-gray-400 dark:focus:ring-blue-500 dark:focus:border-blue-500 dark:shadow-sm-light"
                        placeholder=" Unit Cost"
                        required
                      />
                    </div>
                    <div className="w-[48%] mb-2">
                      <label
                        htmlFor="warr"
                        className="block mb-2 text-sm font-medium text-gray-900 font-radios "
                      >
                        Warr
                      </label>
                      <input
                        type="number"
                        id="warr"
                        value={formData.warr}
                        onChange={handleInputChange}
                        className="block w-full p-3 text-sm text-gray-900 border border-gray-300 rounded-lg shadow-sm bg-gray-50 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:placeholder-gray-400 dark:focus:ring-blue-500 dark:focus:border-blue-500 dark:shadow-sm-light"
                        placeholder="Warr"
                        required
                      />
                    </div>
                    <div className="w-[48%] mb-2">
                      <label
                        htmlFor="warCost"
                        className="block mb-2 text-sm font-medium text-gray-900 font-radios "
                      >
                        War Cost
                      </label>
                      <input
                        type="number"
                        id="warCost"
                        value={formData.warCost}
                        onChange={handleInputChange}
                        className="block w-full p-3 text-sm text-gray-900 border border-gray-300 rounded-lg shadow-sm bg-gray-50 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:placeholder-gray-400 dark:focus:ring-blue-500 dark:focus:border-blue-500 dark:shadow-sm-light"
                        placeholder="War Cost"
                        required
                      />
                    </div>
                    <div className="w-[48%] mb-2">
                      <label
                        htmlFor="gap"
                        className="block mb-2 text-sm font-medium text-gray-900 font-radios "
                      >
                        Gap
                      </label>
                      <input
                        type="number"
                        id="gap"
                        value={formData.gap}
                        onChange={handleInputChange}
                        className="block w-full p-3 text-sm text-gray-900 border border-gray-300 rounded-lg shadow-sm bg-gray-50 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:placeholder-gray-400 dark:focus:ring-blue-500 dark:focus:border-blue-500 dark:shadow-sm-light"
                        placeholder="Gap"
                        required
                      />
                    </div>
                    <div className="w-[48%] mb-2">
                      <label
                        htmlFor="gapCost"
                        className="block mb-2 text-sm font-medium text-gray-900 font-radios "
                      >
                        Gap Cost
                      </label>
                      <input
                        type="number"
                        id="gapCost"
                        value={formData.gapCost}
                        onChange={handleInputChange}
                        className="block w-full p-3 text-sm text-gray-900 border border-gray-300 rounded-lg shadow-sm bg-gray-50 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:placeholder-gray-400 dark:focus:ring-blue-500 dark:focus:border-blue-500 dark:shadow-sm-light"
                        placeholder="Gap Cost"
                        required
                      />
                    </div>
                    <div className="w-[48%] mb-2">
                      <label
                        htmlFor="admin"
                        className="block mb-2 text-sm font-medium text-gray-900 font-radios "
                      >
                        Admin
                      </label>
                      <input
                        type="number"
                        id="admin"
                        value={formData.admin}
                        onChange={handleInputChange}
                        className="block w-full p-3 text-sm text-gray-900 border border-gray-300 rounded-lg shadow-sm bg-gray-50 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:placeholder-gray-400 dark:focus:ring-blue-500 dark:focus:border-blue-500 dark:shadow-sm-light"
                        placeholder="Admin"
                        required
                      />
                    </div>
                    <div className="w-[48%] mb-2">
                      <label
                        htmlFor="pac"
                        className="block mb-2 text-sm font-medium text-gray-900 font-radios "
                      >
                        PAC
                      </label>
                      <input
                        type="number"
                        id="pac"
                        value={formData.pac}
                        onChange={handleInputChange}
                        className="block w-full p-3 text-sm text-gray-900 border border-gray-300 rounded-lg shadow-sm bg-gray-50 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:placeholder-gray-400 dark:focus:ring-blue-500 dark:focus:border-blue-500 dark:shadow-sm-light"
                        placeholder="PAC"
                        required
                      />
                    </div>
                    <div className="w-[48%] mb-2">
                      <label
                        htmlFor="safety"
                        className="block mb-2 text-sm font-medium text-gray-900 font-radios "
                      >
                        Safety
                      </label>
                      <input
                        type="number"
                        id="safety"
                        value={formData.safety}
                        onChange={handleInputChange}
                        className="block w-full p-3 text-sm text-gray-900 border border-gray-300 rounded-lg shadow-sm bg-gray-50 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:placeholder-gray-400 dark:focus:ring-blue-500 dark:focus:border-blue-500 dark:shadow-sm-light"
                        placeholder="Safety"
                        required
                      />
                    </div>
                    <div className="w-[48%] mb-2">
                      <label
                        htmlFor="reserve"
                        className="block mb-2 text-sm font-medium text-gray-900 font-radios "
                      >
                        Reserve
                      </label>
                      <input
                        type="number"
                        id="reserve"
                        value={formData.reserve}
                        onChange={handleInputChange}
                        className="block w-full p-3 text-sm text-gray-900 border border-gray-300 rounded-lg shadow-sm bg-gray-50 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:placeholder-gray-400 dark:focus:ring-blue-500 dark:focus:border-blue-500 dark:shadow-sm-light"
                        placeholder="Reserve"
                        required
                      />
                    </div>
                    {/* wrap everything in a 12-col grid with consistent gaps */}
                    <div className="w-full grid grid-cols-12 gap-4">
                      {/* header */}
                      <div className="col-span-12">
                        <h3 className="text-lg font-semibold mb-2">
                          Other Cost Items
                        </h3>
                        <hr className="mb-4" />
                      </div>

                      {formData?.otherCostItems?.map((item, index) => (
                        <React.Fragment key={index}>
                          {/* amount = 5 columns */}
                          <div className="col-span-12 sm:col-span-5">
                            <label
                              htmlFor={`other-amount-${index}`}
                              className="block text-sm font-medium mb-1"
                            >
                              Other Cost {index + 1} Amount
                            </label>
                            <div className="relative">
                              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                                $
                              </span>
                              <input
                                type="text"
                                id={`other-amount-${index}`}
                                value={item.amount}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  if (v === "" || /^[0-9]*\.?[0-9]*$/.test(v)) {
                                    handleOtherCostChange(index, "amount", v);
                                  }
                                }}
                                placeholder="0.00"
                                className="block w-full pl-8 pr-3 py-2 border  border-gray-300 rounded-lg shadow-sm bg-gray-50 "
                              />
                            </div>
                          </div>

                          {/* description = 6 columns */}
                          <div className="col-span-12 sm:col-span-6">
                            <label
                              htmlFor={`other-desc-${index}`}
                              className="block text-sm font-medium mb-1"
                            >
                              Other Cost {index + 1} Description
                            </label>
                            <input
                              type="text"
                              id={`other-desc-${index}`}
                              value={item.description}
                              onChange={(e) =>
                                handleOtherCostChange(
                                  index,
                                  "description",
                                  e.target.value
                                )
                              }
                              placeholder="Description"
                              className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-gray-50"
                            />
                          </div>

                          {/* delete button = 1 column, aligned bottom */}
                          <div className="col-span-12 sm:col-span-1 flex items-end">
                            <button
                              type="button"
                              onClick={() => handleRemoveOtherCost(index)}
                              className="p-1 text-red-500 hover:text-red-700"
                            >
                              <IoRemoveCircleOutline size={24} />
                            </button>
                          </div>
                        </React.Fragment>
                      ))}

                      {/* “Add” button, full width row */}
                      <div className="col-span-12">
                        <button
                          type="button"
                          onClick={handleAddOtherCost}
                          className="inline-flex items-center px-4 py-2 border rounded text-sm font-medium hover:bg-gray-100"
                        >
                          <IoAddCircleOutline className="mr-2" />
                          Add Other Cost
                        </button>
                      </div>
                    </div>
                  </div>
                  <button
                    className="flex flex-row items-center justify-center px-6 py-3 mr-1 text-sm font-bold text-white uppercase transition-all duration-150 ease-linear rounded shadow outline-none gap-x-2 bg-[#6636C0] active:bg-[#6636C0] hover:shadow-lg focus:outline-none"
                    type="button"
                    onClick={calculateGrossProfit}
                  >
                    Calculate Gross Profit
                  </button>
                  <div className="flex flex-col items-end justify-end w-full p-3 border-t border-solid rounded-b border-blueGray-200">
                    <div className="w-full ">
                      <div className="w-full mx-auto mb-4">
                        <label
                          htmlFor="grossProfit"
                          className="block mb-2 text-sm font-medium text-gray-900 font-radios "
                        >
                          Gross Profit
                        </label>
                        <input
                          type="text"
                          id="grossProfit"
                          value={formData.grossProfit}
                          className="block w-full p-3 text-sm text-gray-900 border border-gray-300 rounded-lg shadow-sm bg-gray-50 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:placeholder-gray-400 dark:focus:ring-blue-500 dark:focus:border-blue-500 dark:shadow-sm-light"
                          placeholder="Gross Profit"
                          required
                          disabled
                        />
                      </div>
                    </div>
                    {/* <button
                      className={`flex flex-row items-center justify-center px-6 py-3 mb-1 text-sm font-bold text-white uppercase transition-all duration-150 ease-linear rounded shadow outline-none gap-x-2 ${
                        isSecondFormDataValid()
                          ? "bg-[#003160] hover:shadow-lg active:bg-[#003160]"
                          : "bg-gray-500 cursor-not-allowed"
                      }`}
                      type="button"
                      onClick={handleSecondNext}
                      disabled={!isSecondFormDataValid()}
                    >
                      Next <GrLinkNext size={23} className="mb-0.5" />
                    </button> */}
                    <button
                      onClick={handleSecondNext}
                      disabled={!formData.grossProfit}
                      className={`flex items-center justify-center gap-2 px-6 py-3 mt-4 text-white transition bg-[#123352] rounded-lg ${
                        !formData.grossProfit
                          ? "opacity-50 cursor-not-allowed bg-gray-600"
                          : "hover:bg-[#002548]"
                      }`}
                    >
                      Next
                      <GrLinkNext />
                    </button>
                  </div>
                </form>
              </div>
            </div>
            {/*footer*/}
          </div>
        </div>
      </div>
      <div className="fixed inset-0 z-40 bg-black opacity-25"></div>
    </>
  );
};

export default SaleForm2;
