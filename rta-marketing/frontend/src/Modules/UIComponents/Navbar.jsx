import { FaChevronDown } from "react-icons/fa";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";

import image from "../..//images/pngwing.com.png";
import { useAuth } from "../../AuthContext";
import { Link } from "react-router-dom";
const Navbar = () => {
  const { currentUser, handleLogout } = useAuth();
  const changePasswordPath =
    currentUser?.userType === "Employee"
      ? "/EmployeeLayout/changePassword"
      : currentUser?.userType === "Virtual Assistant"
      ? "/VirtualAssistantLayout/changePassword"
      : "/AdminLayout/changePassword";

  return (
    <div className="flex flex-row items-center justify-between px-12 py-4 bg-transparent border-b-1 border-b-gray-300">
      <div className="flex w-full">
        {/* Conditionally render the userType only if currentUser is not null */}
        <h1 className="text-2xl font-bold text-blue-800 font-radios">
          {currentUser ? (
            `${currentUser.userType} Dashboard`
          ) : (
            <div className="flex items-center justify-center h-screen loading-spinner">
              {/* Spinner */}
              <div className="w-16 h-16 border-4 rounded-full border-t-transparent border-gray-900/50 animate-spin"></div>
            </div>
          )}
        </h1>
      </div>
      <div className="flex w-full gap-x-6">
        <div className="flex items-center justify-end w-full gap-x-2">
          {/* Conditionally render the user name and image only if currentUser exists */}
          {currentUser && (
            <>
              <img src={image} alt="Profile" className="rounded-full w-7 h-7" />
              <p className="text-sm text-black font-radios">
                {currentUser.name}
              </p>
            </>
          )}
        </div>
        <div className="flex items-center justify-center gap-x-3">
          <Menu as="div" className="relative inline-block text-left">
            <div>
              <MenuButton className="inline-flex w-full justify-center gap-x-1.5 rounded-md px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm  hover:bg-gray-50">
                <FaChevronDown
                  aria-hidden="true"
                  className="w-5 h-5 -mr-1 text-gray-400"
                />
              </MenuButton>
            </div>

            <MenuItems
              transition
              className="absolute right-0 z-10 mt-2 w-56 origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 transition focus:outline-none data-[closed]:scale-95 data-[closed]:transform data-[closed]:opacity-0 data-[enter]:duration-100 data-[leave]:duration-75 data-[enter]:ease-out data-[leave]:ease-in"
            >
              <div className="py-1">
                <MenuItem>
                  <Link
                    className="block px-4 py-2 text-sm text-gray-700 data-[focus]:bg-gray-100 data-[focus]:text-blue-800 font-radios "
                    onClick={handleLogout}
                  >
                    Logout
                  </Link>
                </MenuItem>
              </div>
              <div className="py-1">
                <MenuItem>
                  <Link
                    to={changePasswordPath}
                    className="block px-4 py-2 text-sm text-gray-700 data-[focus]:bg-gray-100 data-[focus]:text-blue-800 font-radios "
                  >
                    Change Password
                  </Link>
                </MenuItem>
              </div>
            </MenuItems>
          </Menu>

          {/* <FaBell size={20} className="text-gray-500 cursor-pointer" /> */}
        </div>
      </div>
    </div>
  );
};

export default Navbar;
