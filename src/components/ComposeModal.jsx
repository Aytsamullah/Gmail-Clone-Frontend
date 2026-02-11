import { useState, useRef, useEffect } from 'react';
import { emailService, aiService } from '../services/api';

function ComposeModal({ isOpen, onClose, onSent }) {
    const [to, setTo] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState(''); // Stores HTML content
    const [cc, setCc] = useState('');
    const [bcc, setBcc] = useState('');
    const [showCc, setShowCc] = useState(false);
    const [showBcc, setShowBcc] = useState(false);
    const [loading, setLoading] = useState(false);
    const [savingDraft, setSavingDraft] = useState(false);
    const [attachments, setAttachments] = useState([]);
    const [isMinimized, setIsMinimized] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [uploadingFiles, setUploadingFiles] = useState({}); // { fileName: progress% }

    // AI Assistant State
    const [showAiModal, setShowAiModal] = useState(false);
    const [aiInstruction, setAiInstruction] = useState('');
    const [aiTone, setAiTone] = useState('Professional');
    const [isGeneratingAi, setIsGeneratingAi] = useState(false);

    // Voice Message State
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [voiceBlob, setVoiceBlob] = useState(null);
    const [voiceUrl, setVoiceUrl] = useState(null);
    const [isPlayingVoice, setIsPlayingVoice] = useState(false);
    const [voiceDuration, setVoiceDuration] = useState(0);

    const fileInputRef = useRef(null);
    const inlineImageInputRef = useRef(null);
    const editorRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recordingTimerRef = useRef(null);
    const voicePlayerRef = useRef(null);
    const recordingTimeRef = useRef(0);

    // Emoji list
    const emojis = ['😀', '😂', '😍', '🤔', '👍', '👎', '🎉', '🔥', '❤️', '📧', '👋', '✅', '❌', '☀️', '🌧️', '🍕', '☕'];

    if (!isOpen) return null;

    // Handle file selection (Attachments)

    // Handle file selection (Attachments)
    const handleFileSelect = async (e) => {
        const files = Array.from(e.target.files);
        const maxSize = 50 * 1024 * 1024; // 50MB (Backend limit)

        // Validate file sizes
        const invalidFiles = files.filter(file => file.size > maxSize);
        if (invalidFiles.length > 0) {
            alert(`Some files exceed the 50MB limit:\n${invalidFiles.map(f => f.name).join('\n')}`);
            return;
        }

        // Check total number of attachments
        if (attachments.length + files.length > 10) {
            alert('Maximum 10 attachments allowed');
            return;
        }

        // Initialize progress for new files
        const newUploads = {};
        files.forEach(file => {
            newUploads[file.name] = 0;
        });
        setUploadingFiles(prev => ({ ...prev, ...newUploads }));

        // Upload each file
        for (const file of files) {
            try {
                const response = await emailService.uploadAttachment(file, (percent) => {
                    setUploadingFiles(prev => ({
                        ...prev,
                        [file.name]: percent
                    }));
                });

                if (response.success) {
                    setAttachments(prev => [...prev, response.file]);
                    setUploadingFiles(prev => {
                        const newState = { ...prev };
                        delete newState[file.name];
                        return newState;
                    });
                }
            } catch (error) {
                console.error(`Failed to upload ${file.name}:`, error);
                alert(`Failed to upload ${file.name}`);
                setUploadingFiles(prev => {
                    const newState = { ...prev };
                    delete newState[file.name];
                    return newState;
                });
            }
        }

        e.target.value = ''; // Reset input
    };

    // Handle Inline Image Selection
    const handleInlineImageSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) { // 5MB limit for inline
            alert('Inline images must be under 5MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const imgUrl = event.target.result;
            if (editorRef.current) {
                editorRef.current.focus();
                document.execCommand('insertImage', false, imgUrl);
                setBody(editorRef.current.innerHTML);
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    // Remove attachment
    const removeAttachment = (index) => {
        setAttachments(attachments.filter((_, i) => i !== index));
    };

    // Format file size for display
    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    // Voice Recording Handlers
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const url = URL.createObjectURL(blob);
                setVoiceBlob(blob);
                setVoiceUrl(url);
                setVoiceDuration(recordingTimeRef.current);
                // Stop all mic tracks
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start(250); // Collect data every 250ms
            setIsRecording(true);
            setRecordingTime(0);
            recordingTimeRef.current = 0;

            // Start timer
            recordingTimerRef.current = setInterval(() => {
                recordingTimeRef.current += 1;
                setRecordingTime(recordingTimeRef.current);
            }, 1000);
        } catch (err) {
            console.error('Microphone access denied:', err);
            alert('Microphone access is required for voice messages. Please allow microphone access and try again.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        clearInterval(recordingTimerRef.current);
        setIsRecording(false);
    };

    const deleteVoiceMessage = () => {
        if (voiceUrl) URL.revokeObjectURL(voiceUrl);
        setVoiceBlob(null);
        setVoiceUrl(null);
        setVoiceDuration(0);
        setIsPlayingVoice(false);
        if (voicePlayerRef.current) {
            voicePlayerRef.current.pause();
            voicePlayerRef.current.currentTime = 0;
        }
    };

    const togglePlayVoice = () => {
        if (!voicePlayerRef.current) return;
        if (isPlayingVoice) {
            voicePlayerRef.current.pause();
            setIsPlayingVoice(false);
        } else {
            voicePlayerRef.current.play();
            setIsPlayingVoice(true);
        }
    };

    const handleSend = async (e) => {
        e.preventDefault();

        // Use editor content if body state hasn't updated yet (edge case)
        const currentBody = editorRef.current ? editorRef.current.innerHTML : body;

        if (!to.trim() || !subject.trim()) {
            alert('Please fill in To and Subject');
            return;
        }

        // Allow empty body if user wants, but warn? standard gmail allows empty body.
        // But let's check content length generally.
        // We'll trust currentBody.

        setLoading(true);
        try {
            const emailData = {
                to,
                subject,
                body: currentBody, // Already HTML
                cc: cc || undefined,
                bcc: bcc || undefined,
            };

            // Add voice message as attachment if recorded
            const allAttachments = [...attachments];
            if (voiceBlob) {
                const voiceFile = new File([voiceBlob], 'voice-message.webm', { type: 'audio/webm' });
                allAttachments.push(voiceFile);
            }

            // Add attachments if any
            if (allAttachments.length > 0) {
                emailData.attachments = allAttachments;
            }

            await emailService.sendEmail(emailData);

            // Success feedback
            const notification = document.createElement('div');
            notification.className = 'fixed bottom-4 left-4 bg-gray-900/90 text-white px-6 py-3 rounded shadow-lg z-50 animate-fade-in text-sm font-medium';
            notification.textContent = 'Message sent';
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 4000);

            onClose();
            onSent && onSent();

            // Reset form
            resetForm();
        } catch (error) {
            alert('Failed to send email: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveDraft = async () => {
        const currentBody = editorRef.current ? editorRef.current.innerHTML : body;

        if (!to && !subject && !currentBody) {
            alert('Draft is empty');
            return;
        }

        setSavingDraft(true);
        try {
            const draftData = {
                to,
                subject,
                body: currentBody,
                cc: cc || undefined,
                bcc: bcc || undefined,
            };

            // Add attachments if any
            if (attachments.length > 0) {
                draftData.attachments = attachments;
            }

            await emailService.saveDraft(draftData);

            const notification = document.createElement('div');
            notification.className = 'fixed bottom-4 left-4 bg-gray-900/90 text-white px-6 py-3 rounded shadow-lg z-50 text-sm font-medium';
            notification.textContent = 'Draft saved';
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 3000);
        } catch (error) {
            alert('Failed to save draft: ' + error.message);
        } finally {
            setSavingDraft(false);
        }
    };

    const handleAiGenerate = async () => {
        if (!aiInstruction.trim()) {
            alert('Please enter an instruction.');
            return;
        }

        setIsGeneratingAi(true);
        try {
            const response = await aiService.generateEmail({
                instruction: aiInstruction,
                tone: aiTone
            });

            if (response.success && response.email) {
                // Insert generated email into editor
                if (editorRef.current) {
                    editorRef.current.focus();

                    // Simple append approach:
                    const newContent = editorRef.current.innerHTML + (editorRef.current.innerHTML ? '<br><br>' : '') + response.email;
                    editorRef.current.innerHTML = newContent;
                    setBody(newContent);
                    setShowAiModal(false);
                    setAiInstruction('');
                }
            }
        } catch (error) {
            console.error(error);
            const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
            alert('AI Generation Error: ' + errorMsg);
        } finally {
            setIsGeneratingAi(false);
        }
    };

    const resetForm = () => {
        setTo('');
        setSubject('');
        setBody('');
        setCc('');
        setBcc('');
        setShowCc(false);
        setShowBcc(false);
        setAttachments([]);
        if (editorRef.current) editorRef.current.innerHTML = '';
        setShowEmojiPicker(false);
        setShowAiModal(false);
        setAiInstruction('');
        // Voice cleanup
        if (voiceUrl) URL.revokeObjectURL(voiceUrl);
        setVoiceBlob(null);
        setVoiceUrl(null);
        setVoiceDuration(0);
        setIsPlayingVoice(false);
        setIsRecording(false);
        clearInterval(recordingTimerRef.current);
    };

    // Editor Handlers
    const insertLink = () => {
        const url = prompt('Enter URL:');
        if (url) {
            if (editorRef.current) editorRef.current.focus();
            document.execCommand('createLink', false, url);
            setBody(editorRef.current.innerHTML);
        }
    };

    const insertEmoji = (emoji) => {
        if (editorRef.current) {
            editorRef.current.focus();
            document.execCommand('insertText', false, emoji);
            setBody(editorRef.current.innerHTML);
            setShowEmojiPicker(false);
        }
    };

    if (isMinimized) {
        return (
            <div className="fixed bottom-0 right-16 w-64 bg-white rounded-t-lg shadow-xl border border-gray-300 z-50 cursor-pointer hover:shadow-2xl transition-shadow" onClick={() => setIsMinimized(false)}>
                <div className="flex items-center justify-between p-2 bg-[#f2f6fc] border-b border-gray-200 rounded-t-lg">
                    <span className="text-sm font-medium text-[#202124] pl-2 truncate">{subject || 'New Message'}</span>
                    <div className="flex items-center gap-1">
                        <button className="p-1 hover:bg-gray-200 rounded text-gray-600" onClick={(e) => { e.stopPropagation(); setIsMinimized(false); }}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 4l-5-5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
                        </button>
                        <button className="p-1 hover:bg-gray-200 rounded text-gray-600" onClick={(e) => { e.stopPropagation(); onClose(); }}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-end justify-center md:justify-end md:pr-16 md:pb-0">
            {/* Backdrop for mobile only */}
            <div
                className="absolute inset-0 bg-black/50 md:hidden pointer-events-auto transition-opacity"
                onClick={onClose}
            ></div>

            <div className="bg-white md:rounded-t-lg shadow-2xl w-full h-full md:w-[560px] md:h-[600px] flex flex-col border border-gray-300 pointer-events-auto animate-slide-up relative z-10">

                {/* AI Modal Overlay */}
                {showAiModal && (
                    <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 rounded-t-lg animate-fade-in">
                        <div className="w-full max-w-sm">
                            {isGeneratingAi ? (
                                /* ── Generating State ── */
                                <div className="flex flex-col items-center justify-center py-8 animate-fade-in">
                                    {/* Animated sparkle icon */}
                                    <div className="relative mb-6">
                                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center ai-pulse-ring">
                                            <svg className="w-8 h-8 text-blue-600 ai-sparkle-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                            </svg>
                                        </div>
                                    </div>

                                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Generating your email</h3>
                                    <p className="text-sm text-gray-500 mb-5 text-center">Crafting a {aiTone.toLowerCase()} email with AI...</p>

                                    {/* Animated progress dots */}
                                    <div className="flex items-center gap-1.5 mb-6">
                                        <div className="w-2 h-2 rounded-full bg-blue-500 ai-bounce-dot" style={{ animationDelay: '0s' }}></div>
                                        <div className="w-2 h-2 rounded-full bg-blue-400 ai-bounce-dot" style={{ animationDelay: '0.15s' }}></div>
                                        <div className="w-2 h-2 rounded-full bg-blue-300 ai-bounce-dot" style={{ animationDelay: '0.3s' }}></div>
                                    </div>

                                    <p className="text-xs text-gray-400">This may take a few seconds...</p>
                                </div>
                            ) : (
                                /* ── Input Form State ── */
                                <>
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-medium text-gray-800 flex items-center gap-2">
                                            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                            </svg>
                                            AI Writing Assistant
                                        </h3>
                                        <button onClick={() => setShowAiModal(false)} className="text-gray-500 hover:text-gray-700">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>

                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Instruction</label>
                                        <textarea
                                            value={aiInstruction}
                                            onChange={(e) => setAiInstruction(e.target.value)}
                                            placeholder="E.g., Write a polite email asking for a sick leave for 2 days..."
                                            className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none h-24"
                                        />
                                    </div>

                                    <div className="mb-6">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
                                        <select
                                            value={aiTone}
                                            onChange={(e) => setAiTone(e.target.value)}
                                            className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                            <option value="Professional">Professional</option>
                                            <option value="Friendly">Friendly</option>
                                            <option value="Formal">Formal</option>
                                            <option value="Casual">Casual</option>
                                            <option value="Urgent">Urgent</option>
                                        </select>
                                    </div>

                                    <button
                                        onClick={handleAiGenerate}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                        Generate Draft
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2 bg-[#f2f6fc] border-b border-gray-200 rounded-t-lg cursor-pointer" onClick={() => setIsMinimized(true)}>
                    <h2 className="text-sm font-medium text-[#202124]">New Message</h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }}
                            className="text-gray-600 hover:bg-gray-200 rounded p-1"
                            title="Minimize"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"></path></svg>
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onClose(); }}
                            className="text-gray-600 hover:bg-gray-200 rounded p-1"
                            title="Save & Close"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSend} className="flex-1 flex flex-col overflow-hidden relative">
                    {/* To */}
                    <div className="flex items-center border-b border-gray-100 px-2 pt-1">
                        <div className="flex-1 flex items-center">
                            <span className="text-gray-500 text-sm py-2 pl-2">To</span>
                            <input
                                type="email"
                                value={to}
                                onChange={(e) => setTo(e.target.value)}
                                className="flex-1 outline-none text-sm p-2 w-full"
                                required
                                multiple
                            />
                        </div>
                        <div className="flex gap-2 pr-2">
                            {!showCc && <button type="button" onClick={() => setShowCc(true)} className="text-gray-500 hover:text-gray-800 text-sm hover:underline">Cc</button>}
                            {!showBcc && <button type="button" onClick={() => setShowBcc(true)} className="text-gray-500 hover:text-gray-800 text-sm hover:underline">Bcc</button>}
                        </div>
                    </div>

                    {/* Cc */}
                    {showCc && (
                        <div className="flex items-center border-b border-gray-100 px-2">
                            <span className="text-gray-500 text-sm py-2 pl-2">Cc</span>
                            <input
                                type="email"
                                value={cc}
                                onChange={(e) => setCc(e.target.value)}
                                className="flex-1 outline-none text-sm p-2"
                                multiple
                            />
                        </div>
                    )}

                    {/* Bcc */}
                    {showBcc && (
                        <div className="flex items-center border-b border-gray-100 px-2">
                            <span className="text-gray-500 text-sm py-2 pl-2">Bcc</span>
                            <input
                                type="email"
                                value={bcc}
                                onChange={(e) => setBcc(e.target.value)}
                                className="flex-1 outline-none text-sm p-2"
                                multiple
                            />
                        </div>
                    )}

                    {/* Subject */}
                    <div className="border-b border-gray-100 px-2">
                        <input
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="Subject"
                            className="w-full outline-none text-sm p-2"
                            required
                        />
                    </div>

                    {/* Rich Text Editor */}
                    <div className="flex-1 relative overflow-hidden flex flex-col">
                        <div
                            ref={editorRef}
                            className="flex-1 w-full outline-none text-base p-4 font-sans overflow-y-auto"
                            contentEditable={true}
                            onInput={(e) => setBody(e.currentTarget.innerHTML)}
                            style={{ minHeight: '200px' }}
                        />

                        {/* Emoji Picker Popup */}
                        {showEmojiPicker && (
                            <div className="absolute bottom-12 left-20 bg-white border border-gray-200 shadow-xl rounded-lg p-2 grid grid-cols-6 gap-2 z-50 w-64">
                                {emojis.map(emoji => (
                                    <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => insertEmoji(emoji)}
                                        className="text-2xl hover:bg-gray-100 p-1 rounded"
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Attachments Display */}
                    {(attachments.length > 0 || Object.keys(uploadingFiles).length > 0) && (
                        <div className="px-4 py-2 border-t border-gray-100 max-h-[100px] overflow-y-auto bg-gray-50">
                            <div className="flex flex-wrap gap-2">
                                {/* Uploading Files */}
                                {Object.entries(uploadingFiles).map(([name, progress]) => (
                                    <div
                                        key={name}
                                        className="flex items-center gap-2 bg-white border border-blue-200 rounded px-2 py-1 text-sm shadow-sm relative overflow-hidden"
                                    >
                                        {/* Progress Bar Background */}
                                        <div
                                            className="absolute left-0 top-0 bottom-0 bg-blue-50 transition-all duration-300 ease-out"
                                            style={{ width: `${progress}%`, zIndex: 0 }}
                                        ></div>

                                        <div className="relative z-10 flex items-center gap-2">
                                            <div className="text-gray-700 text-xs truncate max-w-[150px]">{name}</div>
                                            <span className="text-blue-600 text-[10px] font-medium">{progress}%</span>
                                            <div className="animate-spin h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                                        </div>
                                    </div>
                                ))}

                                {/* Completed Attachments */}
                                {attachments.map((file, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center gap-2 bg-white border border-gray-200 rounded px-2 py-1 text-sm shadow-sm"
                                    >
                                        <div className="text-gray-500 text-xs truncate max-w-[150px]">
                                            {file.originalname || file.name}
                                        </div>
                                        <span className="text-gray-400 text-[10px]">
                                            ({formatFileSize(file.size)})
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => removeAttachment(index)}
                                            className="text-gray-400 hover:text-red-500 ml-1"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Voice Message Preview */}
                    {voiceUrl && !isRecording && (
                        <div className="px-4 py-2 border-t border-gray-100 bg-gradient-to-r from-green-50 to-emerald-50 animate-fade-in">
                            <div className="flex items-center gap-3">
                                {/* Play/Pause Button */}
                                <button
                                    type="button"
                                    onClick={togglePlayVoice}
                                    className="w-9 h-9 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center flex-shrink-0 transition-colors shadow-sm"
                                >
                                    {isPlayingVoice ? (
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
                                    ) : (
                                        <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                    )}
                                </button>

                                {/* Waveform bars */}
                                <div className="flex items-center gap-[3px] flex-1 h-8 px-1">
                                    {Array.from({ length: 28 }).map((_, i) => (
                                        <div
                                            key={i}
                                            className={`w-[3px] rounded-full ${isPlayingVoice ? 'voice-wave-bar' : 'bg-green-300'}`}
                                            style={{
                                                height: `${Math.max(4, Math.random() * 24 + 4)}px`,
                                                animationDelay: isPlayingVoice ? `${i * 0.05}s` : undefined,
                                                backgroundColor: isPlayingVoice ? undefined : undefined,
                                            }}
                                        />
                                    ))}
                                </div>

                                {/* Duration */}
                                <span className="text-xs font-mono text-gray-500 flex-shrink-0 min-w-[40px]">{formatTime(voiceDuration)}</span>

                                {/* Delete button */}
                                <button
                                    type="button"
                                    onClick={deleteVoiceMessage}
                                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors flex-shrink-0"
                                    title="Delete voice message"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            </div>
                            {/* Hidden audio element */}
                            <audio
                                ref={voicePlayerRef}
                                src={voiceUrl}
                                onEnded={() => setIsPlayingVoice(false)}
                            />
                        </div>
                    )}

                    {/* Toolbar / Footer */}
                    {isRecording ? (
                        /* ── Recording Overlay ── */
                        <div className="p-3 flex items-center justify-between border-t border-gray-100 bg-gradient-to-r from-red-50 to-orange-50 animate-fade-in">
                            <div className="flex items-center gap-3">
                                {/* Pulsing red dot */}
                                <div className="w-3 h-3 rounded-full bg-red-500 recording-pulse flex-shrink-0"></div>
                                <span className="text-sm font-medium text-red-600">Recording</span>
                                <span className="text-sm font-mono text-red-500 bg-red-100 px-2 py-0.5 rounded">{formatTime(recordingTime)}</span>
                            </div>
                            <button
                                type="button"
                                onClick={stopRecording}
                                className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 rounded-full text-sm font-medium transition-colors shadow-sm"
                            >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                                Stop
                            </button>
                        </div>
                    ) : (
                        /* ── Normal Toolbar ── */
                        <div className="p-3 flex items-center justify-between border-t border-gray-100 relative">
                            <div className="flex items-center gap-2">
                                <button
                                    type="submit"
                                    disabled={loading || Object.keys(uploadingFiles).length > 0}
                                    className="bg-[#0b57d0] hover:bg-[#0b57d0] hover:shadow text-white px-6 py-2 rounded-full font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {Object.keys(uploadingFiles).length > 0 ? 'Uploading...' : (loading ? 'Sending...' : 'Send')}
                                </button>

                                <div className="h-6 w-px bg-gray-300 mx-2"></div>

                                {/* AI Button */}
                                <button
                                    type="button"
                                    onClick={() => setShowAiModal(true)}
                                    className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium rounded-full transition-colors flex items-center gap-2 text-sm shadow-sm border border-indigo-100 group"
                                    title="AI Writing Assistant"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    <span>AI Help</span>
                                </button>

                                <div className="h-6 w-px bg-gray-300 mx-2"></div>

                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                                    title="Attach files"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                                </button>

                                <button
                                    type="button"
                                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-full"
                                    title="Insert link"
                                    onClick={insertLink}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
                                </button>

                                <button
                                    type="button"
                                    className={`p-2 rounded-full ${showEmojiPicker ? 'bg-gray-200 text-gray-800' : 'text-gray-600 hover:bg-gray-100'}`}
                                    title="Insert Emoji"
                                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                </button>

                                <button
                                    type="button"
                                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-full"
                                    title="Insert Photo"
                                    onClick={() => inlineImageInputRef.current?.click()}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                </button>

                                {/* Voice Message / Mic Button */}
                                <button
                                    type="button"
                                    onClick={startRecording}
                                    className="p-2 text-gray-600 hover:bg-green-50 hover:text-green-600 rounded-full transition-colors"
                                    title="Record voice message"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                    </svg>
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={handleSaveDraft}
                                className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                                title="Save Draft"
                            >
                                {savingDraft ? <div className="animate-spin h-4 w-4 border-2 border-gray-600 border-t-transparent rounded-full"></div> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>}
                            </button>
                        </div>
                    )}

                    {/* Hidden file inputs */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                    <input
                        ref={inlineImageInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleInlineImageSelect}
                        className="hidden"
                    />
                </form>
            </div>

            <style>{`
                @keyframes slide-up {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-slide-up {
                    animation: slide-up 0.2s ease-out;
                }
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fade-in {
                    animation: fade-in 0.2s ease-out;
                }
                @keyframes ai-pulse {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
                    50% { box-shadow: 0 0 0 12px rgba(59, 130, 246, 0); }
                }
                .ai-pulse-ring {
                    animation: ai-pulse 2s ease-in-out infinite;
                }
                @keyframes ai-spin {
                    0% { transform: rotate(0deg) scale(1); }
                    25% { transform: rotate(10deg) scale(1.1); }
                    50% { transform: rotate(0deg) scale(1); }
                    75% { transform: rotate(-10deg) scale(1.1); }
                    100% { transform: rotate(0deg) scale(1); }
                }
                .ai-sparkle-spin {
                    animation: ai-spin 2s ease-in-out infinite;
                }
                @keyframes ai-bounce {
                    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
                    40% { transform: scale(1); opacity: 1; }
                }
                .ai-bounce-dot {
                    animation: ai-bounce 1.2s ease-in-out infinite;
                }
                @keyframes rec-pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.4; transform: scale(0.75); }
                }
                .recording-pulse {
                    animation: rec-pulse 1s ease-in-out infinite;
                }
                @keyframes voice-wave {
                    0%, 100% { height: 4px; background-color: #86efac; }
                    50% { height: 20px; background-color: #22c55e; }
                }
                .voice-wave-bar {
                    animation: voice-wave 0.8s ease-in-out infinite;
                    background-color: #22c55e;
                    border-radius: 999px;
                }
            `}</style>
        </div>
    );
}

export default ComposeModal;
