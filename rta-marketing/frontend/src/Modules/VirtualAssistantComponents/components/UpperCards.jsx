import { FaPlus } from "react-icons/fa6";
import VA1 from "../../../images/va1cardi.png";
import VA2 from "../../../images/va2cardi.png";

const MetricCards = ({ leadSources, SalesPerson, totalLeads }) => {
  return (
    <div className="flex flex-wrap gap-8 p-4 w-full">
      {/* Total Leads Card */}
      {totalLeads && (
        <div className="bg-white rounded-xl shadow-lg px-6 py-8 flex items-center justify-between w-[30%]">
          <div>
            <p className="text-gray-600 text-sm font-medium">Total Leads</p>
            <p className="text-2xl font-bold mt-1">{totalLeads}</p>
          </div>
          <div className="bg-blue-50 p-3 rounded-lg">
            <img src={VA1} alt="Leads" className="w-16 h-16 " />
          </div>
        </div>
      )}

      {/* Total Sources Card */}
      {leadSources && (
        <div className="bg-white rounded-xl shadow-lg px-6 py-8 flex items-center justify-between w-[30%]">
          <div>
            <p className="text-gray-600 text-sm font-medium">Total Sources</p>
            <p className="text-2xl font-bold mt-1">{leadSources?.length}</p>
          </div>
          <div className="bg-emerald-50 p-3 rounded-lg">
            <img src={VA2} alt="Sales" className="w-16 h-16 " />
          </div>
        </div>
      )}
      {SalesPerson && (
        <div className="bg-white rounded-xl shadow-lg px-6 py-8 flex items-center justify-between w-[30%]">
          <div>
            <p className="text-gray-600 text-sm font-medium">
              Total SalesPerson
            </p>
            <p className="text-2xl font-bold mt-1">{SalesPerson?.length}</p>
          </div>
          <div className="bg-emerald-50 p-3 rounded-lg">
            <img src={VA2} alt="Sales" className="w-16 h-16 " />
          </div>
        </div>
      )}

      {/* Upload New Lead Button */}
    </div>
  );
};

export default MetricCards;
