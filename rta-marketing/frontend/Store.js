// store.js
import { configureStore } from "@reduxjs/toolkit";
import RootReducer from "./src/Redux/RootReducer";

const Store = configureStore({
  reducer: RootReducer,
});

export default Store;
