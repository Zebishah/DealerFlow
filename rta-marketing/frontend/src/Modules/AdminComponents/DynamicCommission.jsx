import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import {
  FaArrowLeft,
  FaArrowRight,
  FaBan,
  FaChartLine,
  FaCheckDouble,
  FaDollarSign,
  FaExchangeAlt,
  FaPlus,
  FaUsers,
} from "react-icons/fa";
import DynamicCommissionModal from "./components/DynamicCommissionModal";
import SalesTableVA from "../../shared/VirtualAssistantComponents/TableComponent";
import { db } from "../../config/firebaseConfig";
import ViewSalesModel from "./components/ViewSalesModel";

const currentMonth = new Date().toLocaleString("default", {
  month: "long",
  year: "numeric",
}); // e.g., "July 2025"

const DynamicCommission = () => {
  const [formModal, setFormModal] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [globalRule, setGlobalRule] = useState(null);
  const [customRuleUserId, setCustomRuleUserId] = useState(null);
  const [customRuleUserName, setCustomRuleUserName] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [specificRules, setSpecificRules] = useState({});
  const [viewSalesId, setviewSalesId] = useState(null);
  const [refetch, setrefecth] = useState(false);

  const refetchhanlder = () => {
    setrefecth(!refetch);
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      try {
        const employeeSnap = await getDocs(collection(db, "employees"));
        const globalRuleSnap = await getDoc(
          doc(db, "commissionRules", "global")
        );
        const specificRulesSnap = await getDocs(
          collection(db, "userCommissionRules")
        );

        const global = globalRuleSnap.exists() ? globalRuleSnap.data() : null;
        setGlobalRule(global);

        const specificRules = {};
        specificRulesSnap.forEach((doc) => {
          specificRules[doc.id] = doc.data();
        });

        setSpecificRules(specificRules);

        const data = await Promise.all(
          employeeSnap.docs.map(async (empDoc) => {
            const emp = empDoc.data();
            const uid = emp.uid;

            const salesDocSnap = await getDoc(doc(db, "sales", uid));
            const sales = salesDocSnap.exists()
              ? salesDocSnap.data().sales || []
              : [];
            // Filter sales by current month
            const monthlySales = sales.filter((sale) => {
              // if (!sale.saleDate) return false;
              if (!sale.saleDate || sale.saleType !== "individual")
                return false;
              try {
                const d = new Date(sale.saleDate);
                const saleMonth = d.toLocaleString("default", {
                  month: "long",
                  year: "numeric",
                });
                return saleMonth === currentMonth;
              } catch {
                return false;
              }
            });

            const rule = specificRules[uid] || global || {};
            const minSalesCount = rule.minSalesCount || 0;
            const minAvgSalesGross = rule.minAvgSalesGross || 0;
            const bonusCommissionRate = rule.bonusCommissionRate || 0;
            const baseCommissionRate = rule.baseCommissionRate || 25;

            const sortedSales = [...monthlySales].sort((a, b) => {
              return new Date(a.saleDate) - new Date(b.saleDate);
            });

            const selectedSales = sortedSales.slice(0, minSalesCount);

            const totalGross = selectedSales.reduce(
              (sum, sale) => sum + parseFloat(sale.salesGross || 0),
              0
            );

            const totalSales = monthlySales.length;
            const avgGross =
              selectedSales.length > 0 ? totalGross / selectedSales.length : 0;

            const qualifies =
              totalSales >= minSalesCount && avgGross >= minAvgSalesGross;
            const commissionRate =
              baseCommissionRate + (qualifies ? bonusCommissionRate : 0);

            return {
              name: emp.name,
              uid,
              sales: `${minSalesCount}`,
              commissionRate: `${commissionRate}%`,
              avgGross: `$${avgGross.toFixed(2)}/$${minAvgSalesGross.toFixed(
                2
              )}`,
              rule,
              qualifies: qualifies ? "initial target met" : "target pending",
            };
          })
        );

        setRows(data);
      } catch (err) {
        console.error("Error fetching commission data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [refetch]);

  const columns = [
    { key: "name", label: "Salesperson" },
    { key: "sales", label: "Target" },
    { key: "avgGross", label: "Average Gross/Target " },
    { key: "commissionRate", label: "Commission Rate" },
    {
      key: "qualifies",
      label: "qualifies",
      render: (_, row) => (
        <span
          className={`px-3 py-2 rounded-lg text-xs capitalize ${
            row.qualifies === "initial target met"
              ? "bg-green-50 text-green-500"
              : "bg-red-50 text-red-500"
          }`}
        >
          {row.qualifies}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (_, row) => (
        <div className="flex items-center justify-center gap-3 text-xs">
          <button
            onClick={() => {
              setviewSalesId(row?.uid || null);
            }}
            className="px-4 py-2 text-white bg-[#003160] rounded-lg"
          >
            View sales{" "}
          </button>

          <button
            onClick={() => {
              setCustomRuleUserId(row?.uid || null);
              setCustomRuleUserName(row?.name || null);
            }}
            className="px-4 py-2 text-white bg-[#003160] rounded-lg"
          >
            Update Commission
          </button>
        </div>
      ),
    },
  ];

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
  };

  const handleRowsPerPageChange = (e) => {
    setRowsPerPage(Number(e.target.value));
    setCurrentPage(1); // reset to page 1
  };

  const totalPages = Math.ceil(rows.length / rowsPerPage);
  const paginatedData = rows.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  return (
    <div className="flex items-start justify-start w-full px-12 py-8 overflow-y-auto h-full pb-50">
      <div className="flex flex-col w-full h-full gap-y-4">
        <div className="flex flex-row items-center justify-between w-full">
          <h1 className="text-2xl font-semibold my-4">Dynamic Commission</h1>
          <button
            type="button"
            className="flex flex-row items-center px-10 py-2 text-lg text-white bg-[#003160] rounded-full cursor-pointer gap-x-3 hover:bg-blue-900 transition-all ease-in-out duration-300"
            onClick={() => setFormModal(true)}
          >
            Add Global Commission
            <FaPlus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex item justify-start items-center  -mb-[10px] gap-2">
          <h3 className="text-lg font-semibold ">Global</h3>
          <button
            onClick={() => setFormModal(true)}
            className=" flex item justify-center text-sm text-[#003160] font-bold"
          >
            {"View All >>"}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ">
          <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-100 transition-shadow ">
            <div className="p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold text-gray-500">
                  Sales Target
                </h3>
                <div className="p-2 bg-green-100 rounded-full">
                  <FaCheckDouble className="text-green-600 text-lg" />
                </div>
              </div>
              <div className="flex items-end">
                <span className="text-2xl font-bold text-gray-800">
                  {globalRule?.rules[0]?.minSalesCount || 0}
                </span>
                <span className="text-xs text-gray-500 ml-2 mb-1">sales</span>
              </div>
            </div>
            <div className="h-1 w-full bg-green-500"></div>
          </div>

          <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-100 transition-shadow">
            <div className="p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold text-gray-500">
                  Average Sales Gross
                </h3>
                <div className="p-2 bg-blue-100 rounded-full">
                  <FaDollarSign className="text-blue-600 text-lg" />
                </div>
              </div>
              <div className="flex items-end">
                <span className="text-2xl font-bold text-gray-800">
                  {globalRule?.rules[0]?.minAvgSalesGross.toFixed(2) || 0}
                </span>
                <span className="text-xs text-gray-500 ml-2 mb-1">$</span>
              </div>
            </div>
            <div className="h-1 w-full bg-blue-500"></div>
          </div>
          <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-100 transition-shadow">
            <div className="p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold text-gray-500">
                  Bonus Commission
                </h3>
                <div className="p-2 bg-yellow-100 rounded-full">
                  <FaChartLine className="text-yellow-600 text-lg" />
                </div>
              </div>
              <div className="flex items-end">
                <span className="text-2xl font-bold text-gray-800">
                  {globalRule?.rules[0]?.bonusCommissionRate || 0}
                </span>
                <span className="text-xs text-gray-500 ml-2 mb-1">%</span>
              </div>
            </div>
            <div className="h-1 w-full bg-yellow-500"></div>
          </div>
        </div>
        <div className="relative p-2  bg-white shadow-lg sm:rounded-lg  pb-50 ">
          <SalesTableVA
            columns={columns}
            data={paginatedData}
            loading={loading}
          />
          <div className="flex items-center justify-between mt-4 ">
            <div>
              <label
                htmlFor="rows-per-page"
                className="p-3 mr-2 text-white bg-[#003160] rounded-lg font-radios"
              >
                Rows per page :
              </label>
              <select
                id="rows-per-page"
                value={rowsPerPage}
                onChange={handleRowsPerPageChange}
                className="px-6 py-3 border-gray-300 rounded-md border-1"
              >
                <option value={5} className="p-3">
                  5 per page
                </option>
                <option value={7} className="p-3">
                  7 per page
                </option>
                <option value={10} className="p-3">
                  10 per page
                </option>
                <option value={15} className="p-3">
                  15 per page
                </option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <div className="relative">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`px-4 py-2 border rounded-l-lg flex items-center space-x-1 ${
                    currentPage === 1
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-800"
                  }`}
                >
                  <FaArrowLeft />
                </button>
                {currentPage === 1 && (
                  <div className="absolute inset-0 flex items-center justify-center text-red-500 opacity-0 hover:opacity-100">
                    <FaBan size={20} />
                  </div>
                )}
              </div>

              <span className="px-4 py-2">
                Page {currentPage} of {totalPages}
              </span>

              <div className="relative">
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={`px-4 py-2 border rounded-r-lg flex items-center space-x-1 ${
                    currentPage === totalPages
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-800"
                  }`}
                >
                  <FaArrowRight />
                </button>
                {currentPage === totalPages && (
                  <div className="absolute inset-0 flex items-center justify-center text-red-500 opacity-0 hover:opacity-100">
                    <FaBan size={20} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="h-32 w-full invisible"> hidden</div>
      </div>

      {formModal && (
        <DynamicCommissionModal
          onClose={() => setFormModal(false)}
          globalRule={globalRule}
          refetch={refetchhanlder}
        />
      )}
      {customRuleUserId && (
        <DynamicCommissionModal
          userId={customRuleUserId}
          userName={customRuleUserName}
          onClose={() => setCustomRuleUserId(null)}
          globalRule={specificRules[customRuleUserId] || globalRule}
          refetch={refetchhanlder}
        />
      )}
      {viewSalesId && (
        <ViewSalesModel
          onClose={() => setviewSalesId(null)}
          userId={viewSalesId}
        />
      )}
    </div>
  );
};

export default DynamicCommission;
