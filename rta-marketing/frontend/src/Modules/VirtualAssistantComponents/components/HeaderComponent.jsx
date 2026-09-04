import React from "react";
import { FaPlus } from "react-icons/fa6";
import { useAuth } from "../../../AuthContext";

const HeaderComponent = ({
  title = "Monthly Targets",
  buttonText = "Add Sales Target",
  showButton = true,
  onButtonClick = () => {},
  className = "",
  name = "",
  totalLeads = "",
  totalSales = "",
  showStats = false,
  showModal,
  setShowModal,
}) => {
  const metrics = [
    { label: "Total Leads", value: totalLeads, color: "bg-[#003160]" },
    { label: "Total Sales", value: totalSales, color: "bg-sky-400" },
  ];
  const { currentUser } = useAuth();

  return (
    <div
      className={`flex justify-between items-start bg-white px-6  mt-6     ${className}`}
    >
      <h2 className="text-2xl font-bold text-gray-900">
        {showButton ? title : `${title} `}
      </h2>

      {showButton && (
        <div className="flex flex-row gap-4 ">
          {currentUser.userType === "Admin" && (
            <button
              className="bg-[#003160] hover:bg-[#173652] text-white px-10 py-2 rounded-full text-lg"
              onClick={() => setShowModal(true)}
            >
              Lead sources
            </button>
          )}

          <button
            onClick={onButtonClick}
            className="bg-[#003160] hover:bg-[#173652] text-white px-10 py-2 rounded-full text-lg flex items-center gap-1"
          >
            <FaPlus className="w-4 h-4" />
            {buttonText}
          </button>
        </div>
      )}
      {showStats && (
        <div className="flex gap-8 p-8 items-start justify-start -mt-10">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className={`${metric.color} rounded-full w-36 h-36 flex flex-col items-center justify-center text-white`}
            >
              <div className="text-2xl font-bold mb-2">{metric.value}</div>
              <div className="text-lg">{metric.label}</div>{" "}
              {/* Fixed this line */}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HeaderComponent;
