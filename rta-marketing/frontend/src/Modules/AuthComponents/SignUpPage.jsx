import { useState } from "react";
import { db, auth } from "../../config/firebaseConfig";
import { collection, addDoc, query, where, getDocs } from "firebase/firestore";
import { toast } from "react-toastify";
import bcrypt from "bcryptjs";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";
import { useAuth } from "../../AuthContext";
import { Link, useNavigate } from "react-router-dom";
import logo from "../../images/rta-logo.png";
import { Eye, EyeOff } from "lucide-react";

const SignUpPage = () => {
  const [selected, setSelected] = useState("SignUp As");
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const options = [
    // { value: "admin", label: "Admin" },
    { value: "employee", label: "Employee" },
    { value: "virtual-assistant", label: "Virtual Assistant" },
  ];

  const RegisterUser = async (e) => {
    e.preventDefault(); // Prevent default form submission behavior

    try {
      if (password !== confirmPassword) {
        return toast.error("Passwords do not match!");
      }

      const hashedPassword = bcrypt.hashSync(password, 10);

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      let collectionName;
      switch (selected) {
        case "Employee":
          collectionName = "employees";
          break;
        case "Admin":
          collectionName = "admins";
          break;
        case "Virtual Assistant":
          collectionName = "virtual-assistants";
          break;
        default:
          throw new Error("Invalid user type selected");
      }

      // Store additional user information in the appropriate Firestore collection
      await addDoc(collection(db, collectionName), {
        uid: user.uid,
        name: name,
        email: email,
        password: hashedPassword,
        userType: selected,
        dateCreated: new Date(),
      });
      // console.log(collectionName);
      if (collectionName !== "admins") {
        await sendEmailVerification(user);
      }

      // Clear the form fields after successful registration
      setName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setSelected("SignUp As");

      toast.success("You registered successfully!");
      setTimeout(() => {
        navigate("/verificationPage");
      }, 3000);
      // const queryCollection = async (collectionName) => {
      //   const q = query(
      //     collection(db, collectionName),
      //     where("uid", "==", user.uid)
      //   );
      //   const querySnapshot = await getDocs(q);
      //   if (!querySnapshot.empty) {
      //     return querySnapshot.docs.map((doc) => ({
      //       ...doc.data(),
      //       id: doc.id,
      //     }))[0];
      //   } else {
      //     return null;
      //   }
      // };

      // Check in "admins" collection
      // let userData = await queryCollection("admins");
      // if (userData) {
      //   setTimeout(() => {
      //     navigate("/AdminLayout");
      //   }, 3000);
      // }

      // // Check in "employees" collection
      // userData = await queryCollection("employees");
      // if (userData) {
      //   setTimeout(() => {
      //     navigate("/EmployeeLayout");
      //   }, 3000);
      // }

      // // Check in "users" collection
      // userData = await queryCollection("virtual-assistants");
      // if (userData) {
      //   setTimeout(() => {
      //     navigate("/VirtualAssistantLayout");
      //   }, 3000);
      // }
    } catch (err) {
      console.error(err);
      toast.error(`Registration failed: ${err.message}`);
    }
  };

  return (
    <div className="flex flex-col justify-center items-center w-screen bg-[#1332b9] h-screen">
      <div className="flex flex-col items-center w-[50%] justify-center bg-white rounded-md shadow-lg gap-y-8 px-10 py-14">
        <img src={logo} className="max-w-[220px]" />
        <div className="flex flex-col items-center justify-center w-full gap-y-8">
          <h1 className="text-2xl font-bold text-black">SignUp Form</h1>
          <div className="flex flex-col items-center justify-center w-full">
            <form
              className="w-[48%] flex flex-col items-center justify-center gap-y-6"
              onSubmit={RegisterUser}
            >
              <div className="relative w-full">
                <button
                  type="button"
                  className={`w-full p-4 text-left border border-gray-300 rounded-md ${
                    selected === "SignUp As" ? "text-gray-500" : "text-black"
                  }`}
                  onClick={() => setIsOpen(!isOpen)}
                >
                  {selected}
                  <span className="float-right mt-1.5 text-xs">&#x25BC;</span>
                </button>
                {isOpen && (
                  <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md">
                    {options.map((option) => (
                      <li
                        key={option.value}
                        className="p-4 text-black cursor-pointer hover:bg-gray-100"
                        onClick={() => {
                          setSelected(option.label);
                          setIsOpen(false);
                        }}
                      >
                        {option.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <input
                type="text"
                name="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-4 border-gray-300 rounded-md border-1 placeholder:text-gray-500"
                placeholder="Name"
              />
              <input
                type="text"
                name="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-4 border-gray-300 rounded-md border-1 placeholder:text-gray-500"
                placeholder="Email"
              />
              <div className="relative w-full">
                <input
                  type={showPassword ? "text" : "password"}
                  name="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-4 border border-gray-300 rounded-md placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 outline-none pr-12"
                  placeholder="Password"
                />
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
              </div>
              <div className="relative w-full">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="ConfirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full p-4 border border-gray-300 rounded-md placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 outline-none pr-12"
                  placeholder="Confirm Password"
                />
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
              <div className="flex flex-col items-center justify-center w-full gap-y-5">
                <input
                  type="submit" // Use type="submit" for the button
                  className="w-full p-4 text-white bg-blue-600 rounded-md shadow-lg cursor-pointer"
                  value={"Register"}
                  onSubmit={RegisterUser}
                />
                <div className="flex flex-col items-end justify-end w-full">
                  <p className="text-black cursor-pointer">Already a member?</p>
                  <Link to={"/signIn"} className="w-full">
                    <button
                      className="bg-[#043758] rounded-md text-white shadow-lg p-4 w-full"
                      type="button"
                    >
                      Login
                    </button>
                  </Link>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
export default SignUpPage;
