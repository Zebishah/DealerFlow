import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "./AuthContext.jsx";
import { SalesProvider } from "./SalesContext.jsx";

let clientId =
  "1045795584807-hj1qc8fcgsqd20seip2hsc8jci5rk9uk.apps.googleusercontent.com";
ReactDOM.createRoot(document.getElementById("root")).render(
  <GoogleOAuthProvider clientId={clientId}>
    <AuthProvider>
      <SalesProvider>
        <App />
      </SalesProvider>
    </AuthProvider>
  </GoogleOAuthProvider>
);
