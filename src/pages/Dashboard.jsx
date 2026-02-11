import { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import EmailListItem from '../components/EmailListItem';
import EmailViewer from '../components/EmailViewer';
import ComposeModal from '../components/ComposeModal';
import { emailService } from '../services/api';

function Dashboard({ view: initialView = 'inbox' }) {
    const [currentView, setCurrentView] = useState(initialView);
    const [emails, setEmails] = useState([]);
    const [selectedEmail, setSelectedEmail] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showCompose, setShowCompose] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [error, setError] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null); // { emailId, subject }

    const [selectedEmailIds, setSelectedEmailIds] = useState(new Set());
    const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile sidebar state

    useEffect(() => {
        fetchEmails();
    }, [currentView]);


    const fetchEmails = async () => {
        setLoading(true);
        setError(null);
        try {
            let response;
            if (currentView === 'inbox') {
                response = await emailService.getInbox(50);
            } else if (currentView === 'sent') {
                response = await emailService.getSent(50);
            } else if (currentView === 'drafts') {
                response = await emailService.getDrafts();
                setEmails(response.drafts || []);
                setLoading(false);
                return;
            } else if (currentView === 'trash') {
                response = await emailService.getTrash(50);
            } else if (currentView === 'starred') {
                response = await emailService.getStarred(50);
            }

            const messages = response.messages || [];
            setEmails(messages);
        } catch (error) {
            console.error('Failed to fetch emails:', error);
            setError('Failed to load emails. Make sure the backend is running on port 5000.');
            setEmails([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            fetchEmails();
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const response = await emailService.searchMessages(searchQuery);
            setEmails(response.messages || []);
        } catch (error) {
            console.error('Search failed:', error);
            setError('Search failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleEmailClick = useCallback(async (email) => {
        try {
            const response = await emailService.getMessage(email.id);
            setSelectedEmail(response.message);

            // Mark as read if unread
            if (email.isUnread) {
                await emailService.markAsRead(email.id);
                // Optimistically update local state
                setEmails(prev => prev.map(e =>
                    e.id === email.id ? { ...e, isUnread: false } : e
                ));
            }
        } catch (error) {
            console.error('Failed to fetch email:', error);
            alert('Failed to load email. Please try again.');
        }
    }, []);

    const handleRefresh = useCallback(() => {
        fetchEmails();
        setSelectedEmail(null);
        setSelectedEmailIds(new Set());
    }, [currentView]); // Depend on currentView so it refreshes the right list

    // Move to trash (from inbox/sent/etc.)
    const handleDelete = useCallback(async (emailId) => {
        try {
            await emailService.deleteMessage(emailId);
            setEmails((prev) => prev.filter((e) => e.id !== emailId));
            if (selectedEmail?.id === emailId) {
                setSelectedEmail(null);
            }
        } catch (error) {
            console.error('Failed to delete email:', error);
            alert('Failed to move email to trash.');
        }
    }, [selectedEmail?.id]);

    // Restore from trash
    const handleRestore = useCallback(async (emailId) => {
        try {
            await emailService.restoreMessage(emailId);
            setEmails((prev) => prev.filter((e) => e.id !== emailId));
            if (selectedEmail?.id === emailId) {
                setSelectedEmail(null);
            }
        } catch (error) {
            console.error('Failed to restore email:', error);
            alert('Failed to restore email.');
        }
    }, [selectedEmail?.id]);

    // Show confirmation popup for permanent delete
    const handlePermanentDeleteRequest = useCallback((emailId) => {
        const email = emails.find((e) => e.id === emailId) || selectedEmail;
        setConfirmDelete({
            emailId,
            subject: email?.subject || '(no subject)',
        });
    }, [emails, selectedEmail]);

    // Actually permanently delete
    const handlePermanentDeleteConfirm = async () => {
        if (!confirmDelete) return;
        try {
            await emailService.permanentDeleteMessage(confirmDelete.emailId);
            setEmails((prev) => prev.filter((e) => e.id !== confirmDelete.emailId));
            if (selectedEmail?.id === confirmDelete.emailId) {
                setSelectedEmail(null);
            }
            setConfirmDelete(null);
        } catch (error) {
            console.error('Failed to permanently delete email:', error);
            alert('Failed to permanently delete email.');
            setConfirmDelete(null);
        }
    };

    // Selection Handlers
    const handleToggleSelection = useCallback((emailId) => {
        setSelectedEmailIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(emailId)) {
                newSet.delete(emailId);
            } else {
                newSet.add(emailId);
            }
            return newSet;
        });
    }, []);

    const handleSelectAll = useCallback(() => {
        if (selectedEmailIds.size === emails.length && emails.length > 0) {
            setSelectedEmailIds(new Set());
        } else {
            setSelectedEmailIds(new Set(emails.map(e => e.id)));
        }
    }, [emails, selectedEmailIds]);

    const handleDeleteSelected = useCallback(async () => {
        if (selectedEmailIds.size === 0) return;

        const isTrash = currentView === 'trash';
        const confirmMessage = isTrash
            ? `Are you sure you want to permanently delete ${selectedEmailIds.size} emails? This cannot be undone.`
            : `Are you sure you want to delete ${selectedEmailIds.size} emails?`;

        if (!confirm(confirmMessage)) return;

        try {
            // Delete one by one for now as backend might not support bulk
            const promises = Array.from(selectedEmailIds).map(id =>
                isTrash ? emailService.permanentDeleteMessage(id) : emailService.deleteMessage(id)
            );
            await Promise.all(promises);

            setEmails(prev => prev.filter(e => !selectedEmailIds.has(e.id)));
            setSelectedEmailIds(new Set());
            if (selectedEmail && selectedEmailIds.has(selectedEmail.id)) {
                setSelectedEmail(null);
            }
        } catch (error) {
            console.error('Failed to delete selected emails:', error);
            alert('Failed to delete some emails.');
            // Refresh to get consistent state
            fetchEmails();
        }
    }, [selectedEmailIds, emails, selectedEmail, currentView]); // Added currentView dependency

    const handleToggleStar = useCallback(async (emailId, isStarred) => {
        try {
            // Optimistic update
            setEmails(prev => prev.map(e =>
                e.id === emailId ? { ...e, isStarred } : e
            ));

            // If we are in 'starred' view and unstarring, remove from list
            if (currentView === 'starred' && !isStarred) {
                setEmails(prev => prev.filter(e => e.id !== emailId));
            }

            if (isStarred) {
                await emailService.starMessage(emailId);
            } else {
                await emailService.unstarMessage(emailId);
            }
        } catch (error) {
            console.error('Failed to toggle star:', error);
            // Revert on error
            setEmails(prev => prev.map(e =>
                e.id === emailId ? { ...e, isStarred: !isStarred } : e
            ));
        }
    }, [currentView]);

    const getViewIcon = () => {
        switch (currentView) {
            case 'inbox': return '📥';
            case 'sent': return '📤';
            case 'drafts': return '📝';
            case 'trash': return '🗑️';
            case 'starred': return '⭐';
            default: return '📥';
        }
    };

    return (
        <div className="flex h-screen bg-[#f6f8fc]">
            <Sidebar
                currentView={currentView}
                onViewChange={(view) => {
                    setCurrentView(view);
                    setSelectedEmail(null);
                    setSelectedEmailIds(new Set());
                    setSearchQuery('');
                    setIsSidebarOpen(false); // Close sidebar on selection (mobile)
                }}
                onCompose={() => {
                    setShowCompose(true);
                    setIsSidebarOpen(false);
                }}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />

            <div className="flex-1 flex flex-col overflow-hidden bg-white m-2 rounded-2xl shadow-sm border border-gray-100">
                {/* Search Header */}
                <div className="p-3 pr-6 flex items-center justify-between gap-2">
                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-full"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                    </button>
                    {/* Search Bar */}
                    <div className="flex-1 max-w-3xl relative mx-4">
                        <div className="relative group">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-600 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                            </span>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder={`Search ${currentView}...`}
                                className="w-full bg-[#f1f3f4] hover:bg-white hover:shadow-md focus:bg-white focus:shadow-md px-12 py-3 rounded-lg border-transparent focus:border-transparent focus:ring-0 transition-all text-gray-700 placeholder-gray-600 font-medium"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-12 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100"
                                >
                                    ✕
                                </button>
                            )}
                            <button
                                onClick={handleSearch}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                            >
                                ➔
                            </button>
                        </div>
                    </div>

                    {/* Top Actions */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleRefresh}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                            title="Refresh"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                        </button>
                        <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                        </button>
                    </div>
                </div>

                {/* Main View Area */}
                <div className="flex-1 overflow-hidden relative">
                    {!selectedEmail ? (
                        <div className="h-full flex flex-col">
                            {/* Toolbar */}
                            <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-4 text-gray-600 text-sm h-12">
                                <div
                                    className="w-5 h-5 border-2 border-gray-400 rounded-sm cursor-pointer flex items-center justify-center hover:border-gray-600"
                                    onClick={handleSelectAll}
                                >
                                    {selectedEmailIds.size > 0 && (
                                        <div className={`w-3 h-3 ${selectedEmailIds.size === emails.length ? 'bg-gray-600' : 'bg-gray-400'}`}></div>
                                    )}
                                </div>

                                <button title="Refresh" onClick={handleRefresh} className="hover:bg-gray-100 p-1 rounded">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                                </button>

                                {selectedEmailIds.size > 0 && (
                                    <button
                                        title="Delete Selected"
                                        onClick={handleDeleteSelected}
                                        className="hover:bg-gray-100 p-1 rounded text-red-600"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    </button>
                                )}

                                <button title="More" className="hover:bg-gray-100 p-1 rounded">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
                                </button>
                                <div className="ml-auto text-xs text-gray-500">
                                    {selectedEmailIds.size > 0 ? `${selectedEmailIds.size} selected` : `1-${emails.length} of ${emails.length}`}
                                </div>
                            </div>

                            {/* Trash Warning */}
                            {currentView === 'trash' && (
                                <div className="px-6 py-3 bg-gray-100 text-gray-600 text-sm text-center">
                                    Messages that have been in Trash for more than 30 days will be automatically deleted.
                                    <span className="ml-4 text-blue-600 font-medium cursor-pointer hover:underline" onClick={() => emails.forEach(e => handlePermanentDeleteRequest(e.id))}>Empty Trash now</span>
                                </div>
                            )}

                            {/* Email List */}
                            <div className="flex-1 overflow-y-auto">
                                {loading ? (
                                    <div className="flex items-center justify-center h-full">
                                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                                    </div>
                                ) : error ? (
                                    <div className="flex items-center justify-center h-full text-red-500 flex-col gap-2">
                                        <span className="text-2xl">⚠️</span>
                                        <span>{error}</span>
                                        <button onClick={handleRefresh} className="text-blue-600 hover:underline">Retry</button>
                                    </div>
                                ) : emails.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4">
                                        <div className="text-6xl opacity-20">
                                            {getViewIcon()}
                                        </div>
                                        <p className="font-medium">
                                            {currentView === 'inbox' ? 'Your inbox is empty' :
                                                currentView === 'sent' ? 'No sent messages' :
                                                    currentView === 'trash' ? 'Trash is empty' :
                                                        currentView === 'starred' ? 'No starred messages' :
                                                            'No messages found'}
                                        </p>
                                    </div>
                                ) : (
                                    emails.map((email) => (
                                        <EmailListItem
                                            key={email.id}
                                            email={email}
                                            onClick={() => handleEmailClick(email)}
                                            isSelected={selectedEmailIds.has(email.id)}
                                            onToggleSelection={() => handleToggleSelection(email.id)}
                                            currentView={currentView}
                                            onDelete={handleDelete}
                                            onRestore={handleRestore}
                                            // Duplicate props removed
                                            onPermanentDelete={handlePermanentDeleteRequest}
                                            onToggleStar={handleToggleStar}
                                        />
                                    ))
                                )}
                            </div>
                        </div>
                    ) : (
                        <EmailViewer
                            email={selectedEmail}
                            onClose={() => setSelectedEmail(null)}
                            onRefresh={handleRefresh}
                            currentView={currentView}
                            onDelete={handleDelete}
                            onRestore={handleRestore}
                            onPermanentDelete={handlePermanentDeleteRequest}
                        />
                    )}
                </div>
            </div>

            {/* Compose Modal */}
            <ComposeModal
                isOpen={showCompose}
                onClose={() => setShowCompose(false)}
                onSent={handleRefresh}
            />

            {/* Permanent Delete Confirmation Modal */}
            {confirmDelete && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fadeIn backdrop-blur-sm">
                    <div className="bg-white rounded-lg shadow-xl w-[400px] overflow-hidden">
                        <div className="p-6">
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Delete forever?</h3>
                            <p className="text-gray-600 mb-6">
                                "{confirmDelete.subject}" will be deleted forever and you won't be able to restore it.
                            </p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setConfirmDelete(null)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handlePermanentDeleteConfirm}
                                    className="px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition-colors shadow-sm"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Dashboard;
