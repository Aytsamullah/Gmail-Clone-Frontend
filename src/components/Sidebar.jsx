import { useAuth } from '../context/AuthContext';

// Simple Icons
const InboxIcon = () => (
    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
        <path d="M19 3H4.99c-1.11 0-1.98.89-1.98 2L3 19c0 1.1.88 2 1.99 2H19c1.1 0 2-.9 2-2V5c0-1.11-.9-2-2-2zm0 12h-4c0 1.66-1.35 3-3 3s-3-1.34-3-3H4.99V5H19v10z" />
    </svg>
);

const SentIcon = () => (
    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
);

const DraftsIcon = () => (
    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
    </svg>
);

// New Starred Icon
const StarredIcon = () => (
    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    </svg>
);

function Sidebar({ currentView, onViewChange, onCompose, isOpen, onClose }) {
    const { user, logout } = useAuth();

    // Placeholder for unreadCount, as it's not defined in the original context
    const unreadCount = 0;

    const menuItems = [
        { id: 'inbox', label: 'Inbox', icon: <InboxIcon />, count: unreadCount },
        { id: 'starred', label: 'Starred', icon: <StarredIcon />, count: 0 },
        { id: 'sent', label: 'Sent', icon: <SentIcon />, count: 0 },
        { id: 'drafts', icon: <DraftsIcon />, label: 'Drafts', count: 0 },
    ];

    const isActive = (id) => currentView === id;

    // Sidebar Content
    const sidebarContent = (
        <div className="h-full flex flex-col bg-white">
            {/* Header / Logo */}
            <div className="h-16 flex items-center px-6">
                <div className="flex items-center gap-3">
                    {/* Mobile Close Button */}
                    <button onClick={onClose} className="md:hidden mr-2 p-1 hover:bg-gray-100 rounded-full">
                        <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8">
                            <svg viewBox="0 0 24 24" className="w-full h-full">
                                <path fill="#EA4335" d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8l8 5 8-5v10zm-8-7L4 6h16l-8 5z" />
                            </svg>
                        </div>
                        <span className="text-xl text-[#5f6368] font-normal relative top-[-1px]">Gmail Clone</span>
                    </div>
                </div>
            </div>

            {/* Compose FAB */}
            <div className="px-2 py-4">
                <button
                    onClick={onCompose}
                    className="flex items-center gap-3 bg-[#c2e7ff] hover:shadow-md transition-shadow text-[#001d35] font-medium rounded-2xl px-6 py-4 min-w-[140px]"
                >
                    <span className="text-2xl">✏️</span>
                    <span>Compose</span>
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 pr-4 overflow-y-auto">
                {menuItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onViewChange(item.id)}
                        className={`w-full flex items-center gap-4 px-6 py-1.5 rounded-r-3xl mb-1 text-sm font-medium transition-colors ${isActive(item.id)
                            ? 'bg-[#d3e3fd] text-[#001d35]'
                            : 'text-gray-700 hover:bg-gray-100'
                            }`}
                    >
                        <span className="text-lg">{item.icon}</span>
                        <span className="flex-1 text-left">{item.label}</span>
                        {item.badge && (
                            <span className="text-xs font-bold text-gray-600">
                                {item.badge}
                            </span>
                        )}
                    </button>
                ))}

                <button
                    onClick={() => onViewChange('trash')}
                    className={`w-full flex items-center gap-4 px-6 py-1.5 rounded-r-3xl mb-1 text-sm font-medium transition-colors ${isActive('trash')
                        ? 'bg-[#d3e3fd] text-[#001d35]'
                        : 'text-gray-700 hover:bg-gray-100'
                        }`}
                >
                    <span className="text-lg">🗑️</span>
                    <span className="flex-1 text-left">Trash</span>
                </button>
            </nav>

            {/* User Profile */}
            <div className="p-4 mt-auto border-t border-gray-100">
                <div className="flex items-center gap-3 group cursor-pointer hover:bg-gray-100 p-2 rounded-xl transition-colors" onClick={logout} title="Click to sign out">
                    {user?.picture ? (
                        <img
                            src={user.picture}
                            alt={user.name}
                            className="w-8 h-8 rounded-full"
                        />
                    ) : (
                        <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                            {user?.name?.charAt(0) || 'U'}
                        </div>
                    )}
                    <div className="flex-1 min-w-0 overflow-hidden">
                        <p className="text-sm font-medium text-gray-900 truncate">
                            {user?.name || 'User'}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                    </div>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            logout();
                        }}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                        title="Sign out"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <>
            {/* Mobile Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity"
                    onClick={onClose}
                />
            )}

            {/* Sidebar Container */}
            <div className={`
                fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:shadow-none md:z-auto
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                {sidebarContent}
            </div>
        </>
    );
}



export default Sidebar;
