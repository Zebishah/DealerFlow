import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import "../../index.css";
import logo from "../../images/rta-logo.png";
import { useSalesCounts } from "../../SalesContext";

const AdminSidebar = () => {
  const location = useLocation();
  const [activeItem, setActiveItem] = useState("");
  const { statusCount } = useSalesCounts();

  const menuItems = [
    { name: "Sales", route: "/", matcher: (r) => r === "/AdminLayout" },
    { name: "Users", route: "users", matcher: (r) => r === "/AdminLayout/users" },
    { name: "TV Screen", route: "/tv", matcher: (r) => r === "/tv" },
    { name: "Salespeople", route: "SalesPersons", matcher: (r) => r === "/AdminLayout/SalesPersons" },
    { name: "Monthly Target", route: "monthly-target", matcher: (r) => r === "/AdminLayout/monthly-target" },
    { name: "Leads", route: "leads", matcher: (r) => r === "/AdminLayout/leads" },
    { name: "Analytics", route: "graphs", matcher: (r) => r === "/AdminLayout/graphs" },
    { name: "Monthly Analytics", route: "monthlyAnalytics", matcher: (r) => r === "/AdminLayout/monthlyAnalytics" },
    { name: "Commission Sheet", route: "comission", matcher: (r) => r === "/AdminLayout/comission" },
    { name: "Dynamic Commission", route: "dynamic-comission", matcher: (r) => r === "/AdminLayout/dynamic-comission" },
    { name: "Public Api Leads", route: "api-leads", matcher: (r) => r === "/AdminLayout/api-leads" },
    { name: "Inventory", route: "inventory", matcher: (r) => r === "/AdminLayout/inventory" },
  ];

  useEffect(() => {
    const matchedItem = menuItems.find((item) => item.matcher(location.pathname));
    if (matchedItem) setActiveItem(matchedItem.name);
  }, [location.pathname]);

  return (
    <div className="bg-[#011c64] h-full w-full overflow-hidden">
      {/* Scrollable inner container */}
      <div className="flex flex-col items-center justify-start w-full h-full px-5 py-5 gap-y-10 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
        <div className="flex w-full justify-center bg-white py-2 rounded-lg flex-shrink-0">
          <img src={logo} alt="RTA Logo" className="max-w-[160px]" />
        </div>

        <div className="flex flex-col w-full gap-y-4 flex-grow">
          {menuItems.map((item, index) => (
            <Link
              key={index}
              to={item.route}
              className={`w-full transition-all duration-300 ease-in-out rounded-md ${activeItem === item.name
                ? "bg-white shadow-lg"
                : "hover:bg-white hover:text-blue-900"
                }`}
            >
              <p
                className={`w-full p-3 rounded-md font-radios flex items-center justify-between ${activeItem === item.name ? "text-blue-800" : "text-white"
                  }`}
              >
                {item.name}
                {item.name === "Commission Sheet" && statusCount > 0 && (
                  <span
                    className={`${activeItem === item.name
                      ? "text-white bg-[#011c64]"
                      : "text-[#011c64] bg-white"
                      } w-5 h-5 flex items-center justify-center rounded-full text-sm`}
                  >
                    {statusCount}
                  </span>
                )}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminSidebar;
