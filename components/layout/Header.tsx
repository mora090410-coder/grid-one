
import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';

const Header: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    const navItems = [
        { name: 'Dashboard', path: '/dashboard' },
        { name: 'Create Contest', path: '/create' },
    ];

    const isLanding = location.pathname === '/';

    // Don't show header on BoardView if specifically requested to be fullscreen, 
    // but for now, we apply to all. 
    // Actually, if we are on landing page, we might swap to the landing header layout 
    // OR we just use this header for "App" pages. 
    // Users instructions implied unified system. 

    // If not logged in and not on landing, maybe show Login?
    // We'll focus on the Authenticated/App layout needs based on Dashboard/Create being the targets.

    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-[#0B0C0F]/95 backdrop-blur-md border-b border-white/5 h-16 transition-all duration-300">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between">

                {/* Brand */}
                <div
                    className="flex items-center gap-3 cursor-pointer group"
                    onClick={() => navigate(user ? '/dashboard' : '/')}
                >
                    <img
                        src="/icons/gridone-icon-256.png"
                        alt="GridOne"
                        className="h-8 w-8 rounded-lg shadow-lg shadow-[#8F1D2C]/20 group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="flex flex-col leading-none">
                        <span className="text-white font-bold tracking-tight text-sm">GridOne</span>
                        <span className="text-[10px] text-white/50 tracking-widest uppercase">Squares</span>
                    </div>
                </div>

                {/* Desktop Nav */}
                <nav className="hidden md:flex items-center gap-6">
                    {user && navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                `text-sm font-medium transition-all duration-200 hover:text-white ${isActive
                                    ? 'text-white border-b-2 border-[#8F1D2C]'
                                    : 'text-white/60 border-b-2 border-transparent'
                                }`
                            }
                        >
                            {item.name}
                        </NavLink>
                    ))}

                    {user && (
                        <div className="h-4 w-px bg-white/10 mx-2" />
                    )}

                    {user ? (
                        <div className="flex items-center gap-4">
                            <span className="text-xs text-white/40 font-medium hidden lg:block">
                                {user.email}
                            </span>
                            <button
                                onClick={handleLogout}
                                className="text-xs font-bold uppercase tracking-wider text-[#8F1D2C] hover:text-[#ff2e4d] transition-colors"
                            >
                                Log Out
                            </button>
                        </div>
                    ) : (
                        !isLanding && (
                            <button
                                onClick={() => navigate('/login')}
                                className="text-sm font-medium text-white/70 hover:text-white transition-colors"
                            >
                                Log In
                            </button>
                        )
                    )}
                </nav>

                {/* Mobile Menu Button */}
                <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="md:hidden p-2 text-white/70 hover:text-white transition-colors"
                    aria-label="Toggle menu"
                    aria-expanded={isMenuOpen}
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        {isMenuOpen ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        )}
                    </svg>
                </button>
            </div>

            {/* Mobile/Drawer Menu */}
            <div
                className={`md:hidden absolute top-16 left-0 right-0 bg-[#0B0C0F] border-b border-white/10 shadow-2xl overflow-hidden transition-all duration-300 ease-in-out ${isMenuOpen ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'
                    }`}
            >
                <div className="px-4 py-6 space-y-4 flex flex-col">
                    {user && navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={() => setIsMenuOpen(false)}
                            className={({ isActive }) =>
                                `text-base font-medium transition-colors ${isActive ? 'text-white pl-2 border-l-2 border-[#8F1D2C]' : 'text-white/60 pl-2 border-l-2 border-transparent'
                                }`
                            }
                        >
                            {item.name}
                        </NavLink>
                    ))}

                    {user ? (
                        <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                            <span className="text-xs text-white/40 truncate max-w-[150px]">{user.email}</span>
                            <button
                                onClick={() => {
                                    handleLogout();
                                    setIsMenuOpen(false);
                                }}
                                className="text-xs font-bold uppercase tracking-wider text-[#8F1D2C]"
                            >
                                Log Out
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => {
                                navigate('/login');
                                setIsMenuOpen(false);
                            }}
                            className="text-sm font-medium text-white/70 hover:text-white text-left pl-2"
                        >
                            Log In
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
