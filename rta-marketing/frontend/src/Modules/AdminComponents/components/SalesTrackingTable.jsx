import React from "react";

export default function SalesTrackingTable({ sales = [], isEmployee }) {
  const displaySales = sales.length > 0 ? sales : [];

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };
  const dateFields = [
    "dealershipSold",
    "dateLeadReceived",
    "saleDate",
    "dateVehicleReceived",
    "dateVehicleSold",
  ];
  // Separate columns for individual and wholesale sales
  const individualColumns = isEmployee
    ? [
        { key: "customerName", label: "Customer Name" },
        { key: "leadSource", label: "Lead Source" },
        { key: "dateLeadReceived", label: "Date Lead Received" },
        { key: "saleDate", label: "Sale Date" },
        { key: "salesGross", label: "Sales Gross" },
        { key: "commission", label: "Commission" },
        { key: "financeProvider", label: "Finance Provider" },
        { key: "interestRate", label: "Interest Rate" },
        { key: "stockNumber", label: "Stock #" },
      ]
    : [
        { key: "customerName", label: "Customer Name" },
        { key: "leadSource", label: "Lead Source" },
        { key: "dateLeadReceived", label: "Date Lead Received" },
        { key: "saleDate", label: "Sale Date" },
        { key: "salesRep", label: "Sales Rep" },
        { key: "grossProfit", label: "Gross" },
        { key: "salesGross", label: "Sales Gross" },
        { key: "commission", label: "Commission" },
        { key: "trueGross", label: "True Gross" },
        { key: "financeProvider", label: "Finance Provider" },
        { key: "interestRate", label: "Interest Rate" },
        { key: "stockNumber", label: "Stock #" },
        { key: "vehicle", label: "Vehicle" },
        { key: "tradeDescription", label: "Trade Description" },
        { key: "lienAmount", label: "Lien" },
      ];

  const wholesaleColumns = [
    { key: "dealershipPurchase", label: "Dealership" },
    { key: "dealershipSold", label: "Dealership Sold" },
    { key: "dateLeadReceived", label: "Date Lead Received" },
    { key: "saleDate", label: "Sale Date" },
    { key: "salesRep", label: "Sales Rep" },
    { key: "grossProfit", label: "Gross" },
    { key: "salesGross", label: "Sales Gross" },
    { key: "profitLoss", label: "Profit/Loss" },
    { key: "trueGross", label: "True Gross" },
    { key: "vehiclePurchasePrice", label: "Vehicle Purchase Price" },
    { key: "interestRate", label: "Interest Rate" },
    { key: "stockNumber", label: "Stock #" },
    { key: "vehicle", label: "Vehicle" },
    { key: "tradeDescription", label: "Trade Description" },
    { key: "lienAmount", label: "Lien" },
  ];

  // Group sales by type
  const individualSales = displaySales.filter(
    (sale) => sale.saleType === "individual"
  );
  const wholesaleSales = displaySales.filter(
    (sale) => sale.saleType === "wholesale"
  );

  // Add helper function to check if details are pending
  const isDetailsComplete = (sale) => {
    return sale.updatedAt || sale.updatedBy || sale.updatedById;
  };

  // Add array of numeric fields that need decimal formatting
  const numericFields = [
    "grossProfit",
    "salesGross",
    "commission",
    "trueGross",
    "interestRate",
    "lienAmount",
    "vehiclePurchasePrice",
    "profitLoss",
  ];

  // Add helper function to format numbers
  const formatNumber = (value) => {
    if (!value && value !== 0) return "N/A";
    const number = parseFloat(value);
    return isNaN(number) ? value : number.toFixed(2);
  };

  // Update the renderCellContent function
  const renderCellContent = (sale, col) => {
    // Check if details are pending
    if (!isDetailsComplete(sale)) {
      if (col.key === "grossProfit") {
        return (
          <span className="text-xs text-gray-500 italic">Details pending</span>
        );
      }
      if (!sale[col.key]) {
        return (
          <span className="text-xs text-gray-500 italic">Details pending</span>
        );
      }
    }

    // Handle specific column types
    if (col.key === "vehicle") {
      return `${sale.vehicleMake || "N/A"} ${sale.vehicleModel || ""}`;
    }

    if (dateFields.includes(col.key)) {
      return formatDate(sale[col.key]);
    }

    // Format numeric fields
    if (numericFields.includes(col.key)) {
      return formatNumber(sale[col.key]);
    }

    return sale[col.key] || "N/A";
  };

  return (
    <div className="overflow-x-auto w-full">
      {/* Individual Sales Table */}
      {individualSales.length > 0 && (
        <>
          <h2 className="text-xl font-bold mb-4">Individual Sales</h2>
          <table className="w-full border-collapse mb-8">
            <thead>
              <tr className="bg-[#011c64]">
                {individualColumns.map((col, index) => (
                  <th
                    key={index}
                    className="border border-[#011c64] text-white p-2 text-sm truncate"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {individualSales?.map((sale, index) => (
                <tr key={index}>
                  {individualColumns.map((col, colIndex) => (
                    <td
                      key={colIndex}
                      className="border  border-gray-300 p-2 text-sm truncate"
                    >
                      {renderCellContent(sale, col)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Wholesale Sales Table */}
      {wholesaleSales.length > 0 && (
        <>
          <h2 className="text-xl font-bold mb-4">Wholesale Sales</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#011c64]">
                {wholesaleColumns.map((col, index) => (
                  <th
                    key={index}
                    className="border border-[#011c64] text-white p-2 text-sm truncate"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {wholesaleSales.map((sale, index) => (
                <tr key={index}>
                  {wholesaleColumns.map((col, colIndex) => (
                    <td
                      key={colIndex}
                      className="border border-gray-300 p-2 text-sm truncate"
                    >
                      {renderCellContent(sale, col)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
