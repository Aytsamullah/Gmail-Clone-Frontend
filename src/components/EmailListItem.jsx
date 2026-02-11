import { useState, useMemo, memo, useEffect } from 'react';



const EmailListItem = memo(function EmailListItem({ email, onClick, isSelected, onToggleSelection, currentView, onDelete, onRestore, onPermanentDelete, onToggleStar }) {
    const [hovered, setHovered] = useState(false);
    const [isStarred, setIsStarred] = useState(email.isStarred);

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 1) {
            return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        } else if (diffDays < 365) {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } else {
            return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        }
    };

    const getDisplayName = (emailString) => {
        if (!emailString) return 'Unknown';
        const match = emailString.match(/^(.+?)\s*<.*>$/);
        return match ? match[1] : emailString.split('@')[0];
    };

    const handleActionClick = (e, action) => {
        e.stopPropagation();
        action(email.id);
    };

    const handleStarClick = (e) => {
        e.stopPropagation();
        const newStarredStatus = !isStarred;
        setIsStarred(newStarredStatus);
        if (onToggleStar) {
            onToggleStar(email.id, newStarredStatus);
        }
    };

    // Sync state if email prop changes
    useEffect(() => {
        setIsStarred(email.isStarred);
    }, [email.isStarred]);

    return (
        <div
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className={`group relative flex items-center px-2 md:px-4 py-3 md:py-2 border-b border-gray-100 cursor-pointer transition-shadow hover:shadow-[0_1px_3px_0_rgba(60,64,67,0.3)] hover:z-10 ${isSelected ? 'bg-[#c2e7ff] text-[#001d35]' : 'bg-white hover:bg-[#f2f6fc]'
                } ${email.isUnread ? 'font-bold bg-white' : 'font-normal bg-[rgba(242,245,245,0.8)]'}`}
        >
            {/* Checkbox and Star */}
            <div className="mr-2 md:mr-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <div
                    className={`w-5 h-5 border-2 rounded-sm flex items-center justify-center cursor-pointer transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-400 hover:border-gray-600'}`}
                    onClick={() => onToggleSelection()}
                >
                    {isSelected && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
                </div>

                {/* Star Icon */}
                <button
                    className={`p-1 rounded-full hover:bg-gray-200 focus:outline-none transition-colors ${isStarred ? 'text-yellow-400' : 'text-gray-300 hover:text-gray-500'}`}
                    onClick={handleStarClick}
                    title={isStarred ? "Starred" : "Not starred"}
                >
                    <svg className={`w-5 h-5 ${isStarred ? 'fill-current' : 'fill-none'}`} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                </button>
            </div>

            {/* Sender / Recipient */}
            <div className={`w-32 md:w-48 truncate pr-2 md:pr-4 ${email.isUnread ? 'font-bold text-[#202124]' : 'font-medium text-[#5f6368]'}`}>
                {(currentView === 'sent' || currentView === 'drafts')
                    ? `To: ${getDisplayName(email.to)}`
                    : getDisplayName(email.from)}
            </div>

            {/* Content Preview */}
            <div className="flex-1 flex items-center min-w-0">
                <span className={`truncate ${email.isUnread ? 'font-bold text-[#202124]' : 'text-[#5f6368]'}`}>
                    {email.subject || '(no subject)'}
                </span>
                <span className="mx-1 text-[#5f6368] hidden sm:inline">-</span>
                <span className="text-[#5f6368] truncate flex-1 hidden sm:block">
                    {email.snippet}
                </span>

                {/* Attachments Icon */}
                {email.attachments && email.attachments.length > 0 && (
                    <div className="ml-2 px-2 py-0.5 bg-gray-100 border border-gray-200 rounded-full text-xs text-gray-500 whitespace-nowrap flex items-center gap-1">
                        <span>📎</span>
                        <span className="hidden sm:inline">{(email.attachments[0].filename || email.attachments[0].originalname || email.attachments[0].name).split('.').pop().toUpperCase()}</span>
                    </div>
                )}
            </div>

            {/* Right Side Info */}
            <div className="flex items-center justify-end min-w-[60px] md:min-w-[120px] pl-2 md:pl-4">
                {/* Hover Actions - Desktop Only */}
                <div className={`hidden md:flex items-center gap-1 ${hovered ? 'opacity-100' : 'opacity-0'} transition-opacity absolute right-4 bg-inherit pl-2`}>
                    {currentView === 'trash' ? (
                        <>
                            <button
                                onClick={(e) => handleActionClick(e, onRestore)}
                                className="p-2 hover:bg-gray-200 rounded-full text-gray-500 hover:text-gray-700 transition-colors"
                                title="Restore to Inbox"
                            >
                                ↩️
                            </button>
                            <button
                                onClick={(e) => handleActionClick(e, onPermanentDelete)}
                                className="p-2 hover:bg-gray-200 rounded-full text-gray-500 hover:text-red-600 transition-colors"
                                title="Delete forever"
                            >
                                🗑️
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={(e) => handleActionClick(e, onDelete)}
                            className="p-2 hover:bg-gray-200 rounded-full text-gray-500 hover:text-gray-700 transition-colors"
                            title="Delete"
                        >
                            🗑️
                        </button>
                    )}
                </div>

                {/* Date */}
                <div className={`text-xs font-medium text-[#5f6368] whitespace-nowrap ${hovered ? 'md:opacity-0' : 'opacity-100'}`}>
                    {formatDate(email.date || email.internalDate)}
                </div>
            </div>
        </div>
    );
});

export default EmailListItem;
