import { FaArrowLeft, FaArrowRight, FaBan } from "react-icons/fa6";

const PaginationVA = ({
  currentPage,
  totalPages,
  onPageChange,
  rowsPerPage,
  onRowsPerPageChange,
}) => {
  return (
    <div className="flex items-center justify-between mt-4">
      <div>
        <label className="p-3 mr-2 text-white bg-[#003160] rounded-lg">
          Rows per page:
        </label>
        <select
          value={rowsPerPage}
          onChange={(e) => onRowsPerPageChange(Number(e.target.value))}
          className="px-6 py-3 border-gray-300 rounded-md border-1"
        >
          {[5, 7, 10, 15].map((num) => (
            <option key={num} value={num}>
              {num} per page
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={`px-4 py-2 border rounded-l-lg flex items-center space-x-1 ${
            currentPage === 1
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-800"
          }`}
        >
          <FaArrowLeft />
        </button>
        <span className="px-4 py-2">
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={`px-4 py-2 border rounded-r-lg flex items-center space-x-1 ${
            currentPage === totalPages
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-800"
          }`}
        >
          <FaArrowRight />
        </button>
      </div>
    </div>
  );
};

export default PaginationVA;
