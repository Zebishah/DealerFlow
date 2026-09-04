import { Outlet, useNavigate } from "react-router";
import Navbar from "../UIComponents/Navbar";
import SideBar from "../UIComponents/SideBar";
import { useAuth } from "../../AuthContext";
import { useEffect } from "react";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";
import FloatingTVButton from "../../shared/TvFloatingButton";
const EmployeeLayout = () => {
  const navigate = useNavigate();
  const { isEmailVerified } = useAuth();

  useEffect(() => {
    // console.log(isEmailVerified);
    if (!isEmailVerified) {
      navigate("/signIn");
    }
  }, [isEmailVerified]);

  return isEmailVerified ? (
    <>
      <div className="flex flex-row w-full ">
        <div className="w-[15%]">
          <SideBar />
        </div>
        <div className="w-[85%] flex flex-col h-screen overflow-y-auto">
          <Navbar />
          <div className="flex flex-col items-start justify-center flex-grow w-full">
            <Outlet />
            <FloatingTVButton />
          </div>
        </div>
      </div>
    </>
  ) : null;
  // Return null while navigating to avoid rendering unnecessary UI
};

export default EmployeeLayout;
