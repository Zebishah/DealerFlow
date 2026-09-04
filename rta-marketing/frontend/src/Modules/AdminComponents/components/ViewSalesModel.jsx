import React, { useEffect, useState } from "react";
import { IoMdClose } from "react-icons/io";
import SalesTableVA from "../../../shared/VirtualAssistantComponents/TableComponent";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../config/firebaseConfig";

const ViewSalesModel = ({ onClose, userId = null }) => {
  const [salesState, setSalesState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [grandTotal, setGrandTotal] = useState(0);

  useEffect(() => {
    const fetchSalesData = async () => {
      if (!userId) return;

      try {
        setLoading(true);
        const salesDocRef = doc(db, "sales", userId);
        const salesDocSnap = await getDoc(salesDocRef);

        if (salesDocSnap.exists()) {
          const salesData = salesDocSnap.data().sales || [];

          const currentMonth = new Date().toLocaleString("default", {
            month: "long",
            year: "numeric",
          });

          // Filter current month's individual sales
          const monthlySales = salesData.filter((sale) => {
            if (!sale.saleDate || sale.saleType !== "individual") return false;
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

          // Sort by date ascending
          const sortedSales = monthlySales.sort(
            (a, b) => new Date(a.saleDate) - new Date(b.saleDate)
          );

          // Format for display
          const formattedSales = sortedSales.map((sale) => ({
            id: sale.saleId,
            client: sale.customerName || "N/A",
            vehicle:
              `${sale.vehicleMake || ""} ${sale.vehicleModel || ""}`.trim() ||
              "N/A",
            date: sale.saleDate || "N/A",
            commissionRate: sale.commissionRate || "0%",
            CommissionAmount: parseFloat(sale.commission || 0),
            rawData: sale,
          }));

          setSalesState(formattedSales);

          const total = formattedSales.reduce(
            (sum, sale) => sum + (sale.CommissionAmount || 0),
            0
          );
          setGrandTotal(total);
        } else {
          setSalesState([]);
          setGrandTotal(0);
        }
      } catch (error) {
        console.error("Error fetching sales data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSalesData();
  }, [userId]);

  const dummy = [
    {
      client: "ahsan",
      vehicle: "Honda",
      date: "july 10,2025",
      commissionRate: "2%",
      CommissionAmount: 1000,
    },
  ];
  const salesHeader = [
    {
      key: "client",
      label: "Client",
      render: (value, row) => <div>{value}</div>,
    },
    { key: "vehicle", label: "Vehicle" },
    {
      key: "date",
      label: "Date",
    },
    {
      key: "commissionRate",
      label: "Commission %",
    },
    {
      key: "CommissionAmount",
      label: "Commission $ ",
    },
  ];
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center w-full   bg-[#00000076]  overflow-x-hidden overflow-y-auto outline-none focus:outline-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-[90%] max-w-[1000px] mx-auto  max-h-[90%] "
      >
        <div className="relative flex flex-col w-full bg-white border-0 rounded-lg shadow-lg outline-none focus:outline-none pt-[40px] pb-[30px] pl-[60px] pr-[60px] z-10">
          <button
            onClick={onClose}
            className="hover:bg-gray-100 p-1 rounded-full absolute right-[30px] top-[41px]"
          >
            <IoMdClose size={24} />
          </button>
          <div>
            <h1 className="text-[26px] font-semibold">Sales Details</h1>
          </div>
          <div className="mt-5">
            <SalesTableVA
              columns={salesHeader}
              data={salesState}
              grandTotal={grandTotal}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewSalesModel;
