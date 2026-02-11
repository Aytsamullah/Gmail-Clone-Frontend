import { useState, useEffect } from 'react';
import { emailService, API_URL } from '../services/api';

function EmailViewer({ email, onClose, onRefresh, currentView, onDelete, onRestore, onPermanentDelete }) {
    const [showReply, setShowReply] = useState(false);
    const [showForward, setShowForward] = useState(false);
    const [replyBody, setReplyBody] = useState('');
    const [forwardTo, setForwardTo] = useState('');
    const [forwardBody, setForwardBody] = useState('');
    const [loading, setLoading] = useState(false);
    const [downloadingAttachment, setDownloadingAttachment] = useState(null);
    const [summary, setSummary] = useState(null);
    const [summarizing, setSummarizing] = useState(false);

    // Reset state when email changes
    useEffect(() => {
        setShowReply(false);
        setShowForward(false);
        setReplyBody('');
        setForwardTo('');
        setForwardBody('');
        setSummary(null);
        setSummarizing(false);
    }, [email?.id]);

    if (!email) return null;

    const isTrash = currentView === 'trash';
    const isSent = currentView === 'sent';


    const getRenderedBody = () => {
        return email?.bodyHtml || null;
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    };

    const handleDownloadAttachment = async (attachment) => {
        try {
            setDownloadingAttachment(attachment.attachmentId);

            const response = await fetch(
                `${API_URL}/api/emails/${email.id}/attachments/${attachment.attachmentId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    },
                }
            );

            if (!response.ok) throw new Error('Failed to download attachment');

            const data = await response.json();

            // Convert base64 to blob and download
            const byteCharacters = atob(data.data.replace(/-/g, '+').replace(/_/g, '/'));
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: attachment.mimeType || 'application/octet-stream' });

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = attachment.filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

        } catch (error) {
            console.error('Download error:', error);
            alert('Failed to download attachment');
        } finally {
            setDownloadingAttachment(null);
        }
    };

    const handleReply = async () => {
        if (!replyBody.trim()) return;

        setLoading(true);
        try {
            await emailService.replyToEmail(email.id, replyBody);
            alert('Reply sent successfully!');
            setShowReply(false);
            setReplyBody('');
            onRefresh && onRefresh();
        } catch (error) {
            alert('Failed to send reply: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleForward = async () => {
        if (!forwardTo.trim() || !forwardBody.trim()) return;

        setLoading(true);
        try {
            await emailService.forwardEmail(email.id, forwardTo, forwardBody);
            alert('Email forwarded successfully!');
            setShowForward(false);
            setForwardTo('');
            setForwardBody('');
            onRefresh && onRefresh();
        } catch (error) {
            alert('Failed to forward email: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleMarkAsRead = async () => {
        try {
            if (email.isUnread) {
                await emailService.markAsRead(email.id);
            } else {
                await emailService.markAsUnread(email.id);
            }
            onRefresh && onRefresh();
        } catch (error) {
            alert('Failed to update read status');
        }
    };

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const handleSummarize = async () => {
        setSummarizing(true);
        try {
            const result = await emailService.summarizeEmail(email.id);
            setSummary(result.summary);
        } catch (error) {
            console.error('Failed to summarize email:', error);
            alert('Failed to summarize email. Please try again.');
        } finally {
            setSummarizing(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col bg-white overflow-hidden h-full">
            {/* Header / Actions Toolbar */}
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors"
                        title="Back to list"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                    </button>

                    {isTrash ? (
                        <>
                            <div className="h-4 w-px bg-gray-300 mx-1"></div>
                            <button onClick={() => onRestore && onRestore(email.id)} className="p-2 hover:bg-gray-100 rounded-full text-gray-600" title="Restore"><span className="text-lg">↩️</span></button>
                            <button onClick={() => onPermanentDelete && onPermanentDelete(email.id)} className="p-2 hover:bg-gray-100 rounded-full text-red-600" title="Delete Forever"><span className="text-lg">🗑️</span></button>
                        </>
                    ) : (
                        <>
                            <div className="h-4 w-px bg-gray-300 mx-1"></div>
                            <button className="p-2 hover:bg-gray-100 rounded-full text-gray-600" title="Archive (Not Implemented)">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8m-5 5h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293h3.172a1 1 0 00.707-.293l2.414-2.414a1 1 0 01.707-.293H20"></path></svg>
                            </button>
                            <button className="p-2 hover:bg-gray-100 rounded-full text-gray-600" title="Report Spam (Not Implemented)">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                            </button>

                            {/* Summarize Button */}
                            <button
                                onClick={handleSummarize}
                                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium rounded-full transition-colors flex items-center gap-2 text-sm shadow-sm border border-indigo-100 disabled:opacity-50"
                                title="Summarize this email with AI"
                                disabled={summarizing}
                            >
                                {summarizing ? (
                                    <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <span className="text-lg">✨</span>
                                )}
                                <span>Summarize AI</span>
                            </button>

                            <button
                                onClick={() => onDelete && onDelete(email.id)}
                                className="p-2 hover:bg-gray-100 rounded-full text-gray-600"
                                title="Delete"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                            <div className="h-4 w-px bg-gray-300 mx-1"></div>
                            <button
                                onClick={handleMarkAsRead}
                                className="p-2 hover:bg-gray-100 rounded-full text-gray-600"
                                title={email.isUnread ? "Mark as read" : "Mark as unread"}
                            >
                                {email.isUnread ? (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76"></path></svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Trash Banner */}
            {isTrash && (
                <div className="bg-gray-100 p-4 text-center">
                    <p className="text-gray-600 text-sm">
                        This message is in Trash because you deleted it.
                        <button onClick={() => onRestore && onRestore(email.id)} className="ml-2 text-blue-600 font-medium hover:underline">Restore to Inbox</button>
                    </p>
                </div>
            )}


            {/* Content Scroll Area */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-[1000px] mx-auto p-4 sm:p-8">
                    {/* Subject Header */}
                    <div className="flex items-start justify-between mb-6">
                        <h1 className="text-[22px] leading-tight font-normal text-[#202124]">
                            {email.subject || '(no subject)'}
                        </h1>
                        <div className="flex items-center gap-2">
                            <div className="px-2 py-0.5 bg-gray-200 rounded text-xs text-gray-600 font-medium">Inbox</div>
                        </div>
                    </div>

                    {/* Sender Info Row */}
                    <div className="flex items-start gap-4 mb-6 group">
                        <div className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center text-lg font-medium select-none">
                            {(isSent || isTrash && email.labelIds.includes('SENT'))
                                ? (email.to?.charAt(0).toUpperCase() || '?')
                                : (email.from?.charAt(0).toUpperCase() || '?')}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 mb-0.5">
                                <span className="font-bold text-[#202124]">
                                    {(isSent || isTrash && email.labelIds.includes('SENT'))
                                        ? 'me'
                                        : email.from.split('<')[0].trim()}
                                </span>
                                <span className="text-sm text-[#5f6368] truncate">
                                    {(isSent || isTrash && email.labelIds.includes('SENT'))
                                        ? ''
                                        : (email.from.includes('<') ? `<${email.from.split('<')[1]}` : '')}
                                </span>
                            </div>
                            <div className="text-xs text-[#5f6368]">
                                to <span className="text-[#202124]">
                                    {(isSent || isTrash && email.labelIds.includes('SENT'))
                                        ? email.to
                                        : 'me'}
                                </span> {email.cc && `, ${email.cc}`}
                            </div>
                        </div>
                        <div className="text-xs text-[#5f6368] whitespace-nowrap pt-1">
                            {formatDate(email.date || email.internalDate)}
                            <button className="ml-4 p-2 hover:bg-gray-100 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
                            </button>
                        </div>
                    </div>

                    {/* AI Summary Section */}
                    {summary && (
                        <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-lg relative group">
                            <div className="flex items-center gap-2 mb-2 text-blue-800 font-medium">
                                <span>✨ AI Summary</span>
                            </div>
                            <p className="text-gray-800 text-sm leading-relaxed">{summary}</p>
                            <button
                                onClick={() => setSummary(null)}
                                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 p-1"
                            >
                                ✕
                            </button>
                        </div>
                    )}

                    {/* Email Body */}
                    <div className="text-[#202124] text-sm leading-relaxed mb-8 select-text">
                        {email.bodyHtml ? (
                            <div dangerouslySetInnerHTML={{ __html: getRenderedBody() }} className="prose max-w-none" />
                        ) : (
                            <pre className="whitespace-pre-wrap font-sans">{email.bodyText || email.body}</pre>
                        )}
                    </div>

                    {/* Attachments */}
                    {email.attachments && email.attachments.length > 0 && (
                        <div className="mb-8 pt-4 border-t border-gray-100">
                            <h4 className="text-sm font-medium text-[#5f6368] mb-3">{email.attachments.length} Attachments</h4>
                            <div className="flex flex-wrap gap-4">
                                {email.attachments.map((attachment, idx) => (
                                    <div key={idx} className="group relative w-48 bg-[#f5f5f5] border border-gray-200 rounded-md overflow-hidden hover:shadow-md transition-shadow cursor-default">
                                        <div className="h-32 bg-[#e0e0e0] flex items-center justify-center text-4xl select-none">
                                            {attachment.mimeType?.includes('image') ? '🖼️' : '📄'}
                                        </div>
                                        <div className="p-2 bg-white border-t border-gray-200">
                                            <div className="text-sm font-medium text-[#202124] truncate" title={attachment.filename}>{attachment.filename}</div>
                                            <div className="text-xs text-[#5f6368]">{formatFileSize(attachment.size)}</div>
                                        </div>

                                        {/* Overlay Actions */}
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                            <button
                                                onClick={() => handleDownloadAttachment(attachment)}
                                                className="p-2 bg-white/90 rounded-full hover:bg-white text-gray-700 transition-colors"
                                                title="Download"
                                            >
                                                {downloadingAttachment === attachment.attachmentId ? (
                                                    <div className="animate-spin h-5 w-5 border-2 border-gray-600 border-t-transparent rounded-full"></div>
                                                ) : (
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Reply/Forward Buttons */}
                    {!isTrash && !showReply && !showForward && (
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowReply(true)}
                                className="px-6 py-2 border border-gray-300 rounded-full text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition-colors flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
                                Reply
                            </button>
                            <button
                                onClick={() => setShowForward(true)}
                                className="px-6 py-2 border border-gray-300 rounded-full text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition-colors flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                                Forward
                            </button>
                        </div>
                    )}

                    {/* Reply Form */}
                    {showReply && (
                        <div className="flex gap-4 items-start mt-6">
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0"></div>
                            <div className="flex-1 border border-gray-200 rounded-lg shadow-sm bg-white overflow-hidden">
                                <div className="p-1 flex gap-2 border-b border-gray-100">
                                    <div className="px-2 py-1 text-sm text-gray-500 flex items-center gap-1">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
                                        <span className="font-medium text-gray-700">{email.from}</span>
                                    </div>
                                </div>
                                <textarea
                                    value={replyBody}
                                    onChange={(e) => setReplyBody(e.target.value)}
                                    className="w-full p-4 min-h-[150px] outline-none text-sm resize-none"
                                    placeholder="Type your reply here..."
                                    autoFocus
                                />
                                <div className="p-3 bg-gray-50 flex items-center justify-between border-t border-gray-100">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handleReply}
                                            disabled={loading}
                                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded hover:shadow-md transition-all disabled:opacity-50"
                                        >
                                            {loading ? 'Sending...' : 'Send'}
                                        </button>
                                        <span className="text-gray-400">|</span>
                                        <button className="p-2 text-gray-500 hover:bg-gray-200 rounded">
                                            <span className="font-bold font-serif">A</span>
                                        </button>
                                        <button className="p-2 text-gray-500 hover:bg-gray-200 rounded">
                                            📎
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => setShowReply(false)}
                                        className="p-2 text-gray-500 hover:bg-gray-200 rounded"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Forward Form */}
                    {showForward && (
                        <div className="flex gap-4 items-start mt-6">
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0"></div>
                            <div className="flex-1 border border-gray-200 rounded-lg shadow-sm bg-white overflow-hidden">
                                <div className="p-2 border-b border-gray-100 flex items-center gap-2">
                                    <span className="text-sm text-gray-500">To:</span>
                                    <input
                                        type="email"
                                        value={forwardTo}
                                        onChange={(e) => setForwardTo(e.target.value)}
                                        className="flex-1 outline-none text-sm"
                                        placeholder="Recipient"
                                        autoFocus
                                    />
                                </div>
                                <textarea
                                    value={forwardBody}
                                    onChange={(e) => setForwardBody(e.target.value)}
                                    className="w-full p-4 min-h-[150px] outline-none text-sm resize-none"
                                    placeholder="Add a message..."
                                />
                                <div className="p-3 bg-gray-50 flex items-center justify-between border-t border-gray-100">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handleForward}
                                            disabled={loading}
                                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded hover:shadow-md transition-all disabled:opacity-50"
                                        >
                                            {loading ? 'Sending...' : 'Send'}
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => setShowForward(false)}
                                        className="p-2 text-gray-500 hover:bg-gray-200 rounded"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}

export default EmailViewer;
