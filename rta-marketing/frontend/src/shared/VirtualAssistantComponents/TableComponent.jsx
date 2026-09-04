// const SalesTableVA = ({
//   columns,
//   data,
//   handleDeleteSale,
//   handleOpenViewModal,
//   loading,
// }) => {
//   return (
//     <div className="w-full overflow-x-auto">
//       <table className="w-full text-sm text-left text-black rtl:text-right dark:text-black font-radios">
//         <thead className="text-sm text-gray-700 uppercase bg-gray-50 dark:bg-[#003160] dark:text-white ">
//           <tr>
//             {columns?.map((col, index) => (
//               <th
//                 key={index}
//                 scope="col"
//                 className={`px-4 py-4 font-semibold
//                   ${index === 0 ? "rounded-tl-md" : ""}
//                   ${index === columns.length - 1 ? "rounded-tr-md" : ""}
//                   ${
//                     col.key === "actions" ? "w-1/5" : "w-1/5"
//                   }  // Distribute width evenly
//                 `}
//               >
//                 {col.label}
//               </th>
//             ))}
//           </tr>
//         </thead>
//         <tbody className="border-t-0 border-gray-300 border-1">
//           {data && data.length > 0 ? (
//             data.map((row, rowIndex) => (
//               <tr
//                 key={rowIndex}
//                 className="bg-white border-b dark:bg-white dark:border-gray-300"
//               >
//                 {columns.map((col, colIndex) => (
//                   <td
//                     key={colIndex}
//                     className={`px-4 py-4 text-gray-900
//                       ${
//                         col.key === "actions" ? "w-1/5" : "w-1/5"
//                       }  // Consistent width
//                       break-words  // Allows long text to wrap
//                       truncate  // Truncates extremely long content
//                     `}
//                   >
//                     {col.render ? col.render(row[col.key], row) : row[col.key]}
//                   </td>
//                 ))}
//               </tr>
//             ))
//           ) : (
//             <tr>
//               <td
//                 colSpan={columns.length}
//                 className="w-full p-4 text-center text-gray-500"
//               >
//                 {loading ? "loading..." : " No data available"}
//               </td>
//             </tr>
//           )}
//         </tbody>
//       </table>
//     </div>
//   );
// };

// export default SalesTableVA;

const SalesTableVA = ({
  columns,
  data,
  handleDeleteSale,
  handleOpenViewModal,
  loading,
  grandTotal, // Add grandTotal prop
}) => {
  const totalRowColSpan = columns.length - 1;

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm text-left text-black rtl:text-right dark:text-black font-radios">
        <thead className="text-sm text-gray-700 uppercase bg-gray-50 dark:bg-[#003160] dark:text-white ">
          <tr>
            {columns?.map((col, index) => (
              <th
                key={index}
                scope="col"
                className={`px-4 py-4 font-semibold 
                  ${index === 0 ? "rounded-tl-md" : ""} 
                  ${index === columns.length - 1 ? "rounded-tr-md" : ""}
                  ${col.key === "actions" ? "w-1/5" : "w-1/5"} 
                `}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="border-t-0 border-gray-300 border-1">
          {data && data.length > 0 ? (
            <>
              {data.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="bg-white border-b dark:bg-white dark:border-gray-300"
                >
                  {columns.map((col, colIndex) => (
                    <td
                      key={colIndex}
                      className={`px-4 py-4 text-gray-900 
                        ${col.key === "actions" ? "w-1/5" : "w-1/5"}
                        break-words
                        truncate
                      `}
                    >
                      {col.render
                        ? col.render(row[col.key], row)
                        : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))}

              {/* ✅ Grand Total Row */}
              {grandTotal !== undefined && (
                <tr
                  //  className="bg-gray-100 font-semibold text-black border-t"
                  className={`px-4 py-4 text-gray-900 
                        break-words
                        truncate
                      `}
                >
                  <td
                    colSpan={totalRowColSpan}
                    className="px-4 py-4 text-right text-[#003160] font-bold "
                  >
                    Grand Total
                  </td>
                  <td className="px-4 py-4 text-left ">
                    ${parseFloat(grandTotal).toFixed(2)}
                  </td>
                </tr>
              )}
            </>
          ) : (
            <tr>
              <td
                colSpan={columns.length}
                className="w-full p-4 text-center text-gray-500"
              >
                {loading ? "Loading..." : "No data available"}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default SalesTableVA;
