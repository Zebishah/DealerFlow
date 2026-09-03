import { Navigate, Outlet } from "react-router";
import Navbar from "../UIComponents/Navbar";
import "../../index.css";
import AdminSidebar from "./AdminSidebar";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import FloatingTVButton from "../../shared/TvFloatingButton";
import { useAuth } from "../../AuthContext";
const AdminLayout = () => {
  const { currentUser } = useAuth();

  const getDashboardPath = (userType) => {
    switch (userType) {
      case "Employee":
        return "/EmployeeLayout";
      case "Virtual Assistant":
        return "/VirtualAssistantLayout";
      case "Admin":
        return "/AdminLayout";
      default:
        return "/";
    }
  };

  if (currentUser && currentUser.userType !== "Admin") {
    const path = getDashboardPath(currentUser.userType);
    return <Navigate to={path} />;
  }

  return (
    <>
      <div className="flex flex-row w-full h-screen">
        <div className="w-[15%] h-full">
          <AdminSidebar />
        </div>
        <div className="w-[85%] flex flex-col h-full">
          <Navbar />
          <div className="flex flex-col items-center justify-center flex-grow w-full overflow-auto">
            <Outlet />
            <FloatingTVButton />
          </div>
        </div>
      </div>{" "}
    </>
  );
};

export default AdminLayout;
