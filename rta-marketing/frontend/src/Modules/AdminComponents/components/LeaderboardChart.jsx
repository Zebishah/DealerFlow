import ReactApexChart from "react-apexcharts";
import PropTypes from "prop-types";
import { Loader } from "../../../Utils/Loader";

const LeaderboardChart = ({
  chartData,
  selectedUserIndex = -1,
  date,
  loading,
}) => {
  if (loading) {
    return (
      <div className="w-full bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4 text-center flex items-center justify-center h-[500px]">
        <Loader />
      </div>
    );
  }
  if (
    !chartData ||
    !chartData.categories ||
    !chartData.salesCount ||
    !chartData.totalGross ||
    !date
  ) {
    return (
      <div className="w-full bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4 text-center">
        <p className="text-gray-500">No data available for chart</p>
      </div>
    );
  }

  console.log("selectedUserIndex", selectedUserIndex);

  const { selectedYear, selectedMonth } = date;
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const monthYearText = `${monthNames[selectedMonth]} ${selectedYear}`;

  const { categories, salesCount, totalGross } = chartData;
  const scaleFactor = 1000;

  const scaledSales = salesCount.map((count) => count * scaleFactor);

  const options = {
    chart: {
      type: "bar",
      height: 600,
      toolbar: { show: true },
    },

    plotOptions: {
      bar: {
        horizontal: true,
        barHeight: "66%",
        borderRadius: 2,
      },
    },
    states: {
      hover: {
        filter: {
          type: "none",
        },
      },
    },
    title: {
      text: "Monthly Leaderboard",
      align: "left",
      style: {
        fontSize: "16px",
        fontWeight: 600,
        color: "#011c64",
      },
    },
    stroke: {
      width: [3, 3],
      curve: "smooth",
      colors: [
        ({ dataPointIndex }) =>
          dataPointIndex === selectedUserIndex
            ? "rgba(1, 28, 100, 0.8)"
            : "rgba(66, 153, 225, 0.8)",
        ({ dataPointIndex }) =>
          dataPointIndex === selectedUserIndex
            ? "rgba(254, 242, 242, 0.8)"
            : "rgba(154, 230, 180, 0.8)",
      ],
    },
    colors: [
      ({ dataPointIndex }) =>
        dataPointIndex === selectedUserIndex ? "#011c64" : "#4299e1",
      ({ dataPointIndex }) =>
        dataPointIndex === selectedUserIndex ? "#48bb78" : "#FEF2F2",
    ],
    fill: {
      type: "solid",
      opacity: 1,
      colors: [
        ({ dataPointIndex }) =>
          dataPointIndex === selectedUserIndex ? "#011c64" : "#4299e1",
        ({ dataPointIndex }) =>
          dataPointIndex === selectedUserIndex ? "#FE0000" : "#9ae6b4",
      ],
    },
    grid: {
      xaxis: {
        lines: { show: false },
      },
      row: {
        colors: categories.map((_, i) =>
          i === selectedUserIndex ? "#f8fafc" : "transparent"
        ),
        opacity: 0.5,
      },
    },
    xaxis: {
      categories,
      title: {
        text: "Sales Gross ($)",
        style: { color: "#48bb78" },
      },
      labels: {
        formatter: (val) => `$${Number(val).toLocaleString()}`,
        style: { colors: "#48bb78" },
      },
    },
    yaxis: {
      title: {
        text: "Salepersons",
        style: {
          color: "#011c64",
        },
      },
      labels: {
        style: {
          colors: categories.map((_, i) =>
            i === selectedUserIndex ? "#48bb78" : "#666"
          ),
          fontWeight: categories.map((_, i) =>
            i === selectedUserIndex ? "700" : "400"
          ),
          fontSize: "12px",
        },
        maxWidth: 100,
        trim: false,
      },
    },
    noData: {
      text: "No data available",
      align: "center",
      verticalAlign: "middle",
      style: {
        color: "#666",
        fontSize: "14px",
        fontFamily: "sans-serif",
      },
    },

    dataLabels: {
      enabled: true,
      formatter: (val, { seriesIndex }) =>
        seriesIndex === 0
          ? `${Math.round(val / scaleFactor)} units sold `
          : `$${val.toLocaleString()}`,
    },
    tooltip: {
      shared: true,
      intersect: false,
      y: [
        {
          formatter: (val) => `${Math.round(val / scaleFactor)} units sold`,
        },
        {
          formatter: (val) => `$${Number(val).toLocaleString()}`,
        },
      ],
    },
    legend: {
      position: "top",
      horizontalAlign: "center",
      labels: {
        colors: "#333",
      },
    },
  };

  const series = [
    {
      name: `Units sold (1 unit = ${scaleFactor} gross)`,
      data: scaledSales,
    },
    {
      name: "Sales Gross ($)",
      data: totalGross,
    },
  ];

  return (
    <div className="w-full bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
      <div className="text-sm text-gray-600 px-2 pb-1 flex justify-between">
        <span>↑ Units sold scaled by {scaleFactor}</span>
        <span>{monthYearText}</span>
        <span>↓ Gross Value ($)</span>
      </div>
      <ReactApexChart
        options={options}
        series={series}
        type="bar"
        height={600}
      />
    </div>
  );
};

LeaderboardChart.propTypes = {
  chartData: PropTypes.shape({
    categories: PropTypes.arrayOf(PropTypes.string).isRequired,
    salesCount: PropTypes.arrayOf(PropTypes.number).isRequired,
    totalGross: PropTypes.arrayOf(PropTypes.number).isRequired,
  }).isRequired,
  selectedUserIndex: PropTypes.number,
};

export default LeaderboardChart;
