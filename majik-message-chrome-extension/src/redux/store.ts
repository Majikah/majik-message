import { configureStore } from "@reduxjs/toolkit";
import { persistStore, persistReducer } from "redux-persist";
import storage from "redux-persist/lib/storage"; // defaults to localStorage for web
import { combineReducers } from "redux";
import systemReducer from "./slices/system";
import userDataReducer from "./slices/user-data";

// Combine your reducers

const rootReducer = combineReducers({
  system: systemReducer,
  userData: userDataReducer,
});

const persistConfig = {
  key: "root",
  storage,
  whitelist: ["system", "userData"], // List the slices you want to persist
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export const persistor = persistStore(store);
