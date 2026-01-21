
import React from 'react';
import Header from './Header';

interface LayoutProps {
    children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    return (
        <div className="min-h-screen bg-[#060607] text-white flex flex-col">
            <Header />
            <main className="flex-1 pt-20 px-4 sm:px-6 w-full max-w-7xl mx-auto">
                {children}
            </main>
        </div>
    );
};

export default Layout;
