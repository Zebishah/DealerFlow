import { useState } from "react";
import { TextField } from "@mui/material";
import {
  getAuth,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Eye, EyeOff } from "lucide-react";

const ChangePassword = () => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      currentPassword === "" ||
      newPassword === "" ||
      confirmNewPassword === ""
    ) {
      toast.error("Please fill all the fields");
      return;
    }

    if (currentPassword === newPassword) {
      toast.error("New Password should be different from the Old Password");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast.error("New Password & Confirm Password don't match");
      return;
    }

    try {
      setIsUpdating(true);
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        toast.error("No user is currently logged in.");
        setIsUpdating(false);
        return;
      }
      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword
      );
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      toast.success("Password updated successfully!");
    } catch (error) {
      toast.error(
        "Failed to update password. Please check your current password and try again."
      );
    } finally {
      setIsUpdating(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    }
  };

  return (
    <>
      <div className="w-[60%] flex flex-col justify-center items-center mt-8 mb-20 bg-white shadow-lg rounded-md">
        <div className="py-12 text-2xl font-semibold"> Change Password </div>
        <div className="w-[85%] lg:w-[70%] flex flex-col justify-center items-center gap-4 mb-10">
          <TextField
            id="currentpassword"
            name="currentpassword"
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            fullWidth
          />{" "}
          <div className="relative w-full">
            <TextField
              id="newpassword"
              name="newpassword"
              label="New Password"
              type={showPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              fullWidth
            />{" "}
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-blue-600"
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>{" "}
          <div className="relative w-full">
            <TextField
              id="confirmnewpassword"
              name="confirmnewpassword"
              label="Confirm New Password"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              fullWidth
            />{" "}
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-blue-600"
            >
              {showConfirmPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
          <button
            className="lg:w-[30%] w-full rounded-xl cursor-pointer bg-[#4501ff] text-white font-semibold p-3"
            onClick={handleSubmit}
          >
            {isUpdating ? "Updating" : "Update Password"}
          </button>
        </div>
      </div>
    </>
  );
};

export default ChangePassword;
