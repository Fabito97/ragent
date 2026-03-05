// import React from 'react'

import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";

const RootLayout = () => {
  return (
    <div className="h-screen text-gray-800 dark:text-gray-100 dark:bg-primary-background font-sans flex flex-col">
      <div className="flex flex-1 h-full overflow-hidden">
        <Sidebar />
        <main className="flex-1 h-full overflow-hidden flex flex-col">
          <Header />
          <div className="flex-1 overflow-hidden">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default RootLayout;
