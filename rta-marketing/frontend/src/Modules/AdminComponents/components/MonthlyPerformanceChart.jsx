import ReactApexChart from "react-apexcharts";
import PropTypes from "prop-types";

const MonthlyPerformanceChart = ({ salesData }) => {
  // Data validation
  if (!salesData || !salesData.series || !salesData.labels) {
    return (
      <div className="w-full bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4 text-center">
        <p className="text-gray-500">No data available for chart</p>
      </div>
    );
  }

  // Ensure series data exists and is properly formatted
  const sanitizedSeries = salesData.series.map((series) => ({
    ...series,
    data:
      series.data?.map((d) => ({
        x: d?.x || "",
        y: d?.y ? Number(d.y) : 0,
      })) || [],
  }));

  // Ensure labels exist
  const sanitizedLabels = salesData.labels || [];

  // Ensure selectedMonthIndex is valid
  const validSelectedIndex =
    Number.isInteger(salesData.selectedMonthIndex) &&
    salesData.selectedMonthIndex >= 0 &&
    salesData.selectedMonthIndex < sanitizedLabels.length
      ? salesData.selectedMonthIndex
      : -1;

  const options = {
    chart: {
      height: 350,
      type: "line",
      toolbar: {
        show: true,
      },
    },
    stroke: {
      width: [0, 3],
      curve: "smooth",
    },
    plotOptions: {
      bar: {
        columnWidth: "50%",
        borderRadius: 2,
        distributed: false,
      },
    },
    states: {
      hover: {
        filter: {
          type: "none",
        },
      },
    },
    colors: ["#4299e1", "#9ae6b4"],
    title: {
      text: "Monthly Performance Overview",
      align: "left",
      style: {
        fontSize: "16px",
        fontWeight: 600,
        color: "#011c64",
      },
    },

    fill: {
      type: "solid",
      opacity: 1,
      colors: [
        function ({ dataPointIndex }) {
          return dataPointIndex === validSelectedIndex ? "#011c64" : "#4299e1";
        },
        function ({ dataPointIndex }) {
          return dataPointIndex === validSelectedIndex ? "#48bb78" : "#9ae6b4";
        },
      ],
    },
    grid: {
      xaxis: {
        lines: {
          show: false,
        },
      },
      column: {
        colors: undefined,
        opacity: 0.1,
      },
      row: {
        colors: sanitizedLabels.map((_, index) =>
          index === validSelectedIndex ? "#f8fafc" : "transparent"
        ),
        opacity: 0.5,
      },
    },
    xaxis: {
      categories: sanitizedLabels,
      labels: {
        style: {
          colors: sanitizedLabels.map((_, index) =>
            index === validSelectedIndex ? "#011c64" : "#666"
          ),
          fontWeight: sanitizedLabels.map((_, index) =>
            index === validSelectedIndex ? "700" : "400"
          ),
        },
      },
    },
    yaxis: [
      {
        title: {
          text: "Units Sold",
          style: {
            color: "#011c64",
          },
        },
        labels: {
          formatter: function (val) {
            return val ? Number(val).toFixed(2) : "0.00";
          },
          style: {
            colors: "#011c64",
          },
        },
      },
      {
        opposite: true,
        title: {
          text: "Sales Gross ($)",
          style: {
            color: "#48bb78",
          },
        },
        labels: {
          formatter: function (val) {
            return val
              ? `$${Number(val).toFixed(2).toLocaleString()}`
              : "$0.00";
          },
          style: {
            colors: "#48bb78",
          },
        },
      },
    ],
    tooltip: {
      shared: true,
      intersect: false,
      y: [
        {
          formatter: function (y) {
            return y ? `${Number(y).toFixed(2)} units` : "0.00 units";
          },
        },
        {
          formatter: function (y) {
            return y ? `$${Number(y).toFixed(2).toLocaleString()}` : "$0.00";
          },
        },
      ],
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
  };

  try {
    return (
      <div className="w-full bg-white rounded-lg shadow-sm border border-gray-200 p-2 mb-4">
        <ReactApexChart
          options={options}
          series={[
            {
              name: "Units Sold",
              type: "column",
              data:
                sanitizedSeries[0]?.data?.map((d) => ({
                  x: d.x,
                  y: Number(d.y).toFixed(2),
                })) || [],
            },
            {
              name: "Sales Gross",
              type: "column",
              data:
                sanitizedSeries[1]?.data?.map((d) => ({
                  x: d.x,
                  y: Number(d.y).toFixed(2),
                })) || [],
            },
          ]}
          height={350}
        />
      </div>
    );
  } catch (error) {
    console.error("Error rendering chart:", error);
    return (
      <div className="w-full bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4 text-center">
        <p className="text-gray-500">Error rendering chart</p>
      </div>
    );
  }
};

// Add prop types validation
MonthlyPerformanceChart.propTypes = {
  salesData: PropTypes.shape({
    labels: PropTypes.arrayOf(PropTypes.string),
    selectedMonthIndex: PropTypes.number,
    series: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string,
        type: PropTypes.string,
        data: PropTypes.arrayOf(
          PropTypes.shape({
            x: PropTypes.string,
            y: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
          })
        ),
      })
    ),
  }),
};

export default MonthlyPerformanceChart;
