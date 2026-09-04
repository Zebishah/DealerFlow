import { Outlet } from "react-router";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import FloatingTVButton from "../../shared/TvFloatingButton";
const AuthLayout = () => {
  return (
    <>
      <div className="flex items-center justify-center w-full">
        <Outlet />
        <FloatingTVButton />
      </div>
    </>
  );
};

export default AuthLayout;
