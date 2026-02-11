import axios from 'axios';

const API_URL = 'http://localhost:5000';

// Create axios instance
const api = axios.create({
    baseURL: API_URL,
    withCredentials: true, // Send cookies with requests
});

// Add token to requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle token expiration
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export const authService = {
    // Get OAuth URL
    getGoogleAuthUrl: async () => {
        const response = await api.get('/auth/google');
        return response.data;
    },

    // Get current user
    getCurrentUser: async () => {
        const response = await api.get('/auth/me');
        return response.data;
    },

    // Logout
    logout: async () => {
        const response = await api.post('/auth/logout');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        return response.data;
    },
};

export const emailService = {
    // Get inbox
    getInbox: async (maxResults = 50, pageToken = null) => {
        const params = { maxResults };
        if (pageToken) params.pageToken = pageToken;
        const response = await api.get('/api/emails/inbox', { params });
        return response.data;
    },

    // Get sent
    getSent: async (maxResults = 50, pageToken = null) => {
        const params = { maxResults };
        if (pageToken) params.pageToken = pageToken;
        const response = await api.get('/api/emails/sent', { params });
        return response.data;
    },

    // Get single message
    getMessage: async (id) => {
        const response = await api.get(`/api/emails/${id}`);
        return response.data;
    },

    // Send email
    sendEmail: async (emailData) => {
        // Check if there are attachments (new metadata format or old file objects)
        if (emailData.attachments && emailData.attachments.length > 0) {
            const formData = new FormData();
            formData.append('to', emailData.to);
            formData.append('subject', emailData.subject);
            formData.append('body', emailData.body);
            if (emailData.cc) formData.append('cc', emailData.cc);
            if (emailData.bcc) formData.append('bcc', emailData.bcc);

            // Separate new metadata attachments from potential direct file uploads (voice messages)
            const metadataAttachments = [];

            emailData.attachments.forEach((item) => {
                if (item instanceof File || item instanceof Blob) {
                    // Direct file/blob (e.g. voice message)
                    formData.append('attachments', item);
                } else {
                    // Pre-uploaded metadata
                    metadataAttachments.push(item);
                }
            });

            if (metadataAttachments.length > 0) {
                formData.append('attachments', JSON.stringify(metadataAttachments));
            }

            const response = await api.post('/api/emails/send', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            return response.data;
        } else {
            // No attachments, send as JSON
            const response = await api.post('/api/emails/send', emailData);
            return response.data;
        }
    },

    // Upload temporary attachment
    uploadAttachment: async (file, onProgress) => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await api.post('/api/emails/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            onUploadProgress: (progressEvent) => {
                if (onProgress) {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    onProgress(percentCompleted);
                }
            },
        });
        return response.data;
    },

    // Reply to email
    replyToEmail: async (id, body) => {
        const response = await api.post(`/api/emails/${id}/reply`, { body });
        return response.data;
    },

    // Forward email
    forwardEmail: async (id, to, body) => {
        const response = await api.post(`/api/emails/${id}/forward`, { to, body });
        return response.data;
    },

    // Mark as read
    markAsRead: async (id) => {
        const response = await api.patch(`/api/emails/${id}/read`);
        return response.data;
    },

    // Mark as unread
    markAsUnread: async (id) => {
        const response = await api.patch(`/api/emails/${id}/unread`);
        return response.data;
    },

    // Delete message (move to trash)
    deleteMessage: async (id) => {
        const response = await api.delete(`/api/emails/${id}`);
        return response.data;
    },

    // Star message
    starMessage: async (id) => {
        const response = await api.patch(`/api/emails/${id}/star`);
        return response.data;
    },

    // Unstar message
    unstarMessage: async (id) => {
        const response = await api.patch(`/api/emails/${id}/unstar`);
        return response.data;
    },

    // Get starred
    getStarred: async (maxResults = 50, pageToken = null) => {
        const params = { maxResults };
        if (pageToken) params.pageToken = pageToken;
        const response = await api.get('/api/emails/starred', { params });
        return response.data;
    },

    // Summarize email
    summarizeEmail: async (id) => {
        const response = await api.post(`/api/emails/${id}/summarize`);
        return response.data;
    },

    // Get trash
    getTrash: async (maxResults = 50, pageToken = null) => {
        const params = { maxResults };
        if (pageToken) params.pageToken = pageToken;
        const response = await api.get('/api/emails/trash', { params });
        return response.data;
    },

    // Restore message from trash
    restoreMessage: async (id) => {
        const response = await api.post(`/api/emails/${id}/untrash`);
        return response.data;
    },

    // Permanently delete message
    permanentDeleteMessage: async (id) => {
        const response = await api.delete(`/api/emails/${id}/permanent`);
        return response.data;
    },




    // Search messages
    searchMessages: async (query, maxResults = 50) => {
        const response = await api.get('/api/emails/search', {
            params: { q: query, maxResults },
        });
        return response.data;
    },

    // Get drafts
    getDrafts: async () => {
        const response = await api.get('/api/emails/drafts');
        return response.data;
    },

    // Save draft
    saveDraft: async (draftData) => {
        // Check if there are attachments
        if (draftData.attachments && draftData.attachments.length > 0) {
            const formData = new FormData();
            if (draftData.to) formData.append('to', draftData.to);
            if (draftData.subject) formData.append('subject', draftData.subject);
            if (draftData.body) formData.append('body', draftData.body);
            if (draftData.cc) formData.append('cc', draftData.cc);
            if (draftData.bcc) formData.append('bcc', draftData.bcc);

            // Append all attachments
            draftData.attachments.forEach((file) => {
                formData.append('attachments', file);
            });

            const response = await api.post('/api/emails/draft', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            return response.data;
        } else {
            // No attachments, send as JSON
            const response = await api.post('/api/emails/draft', draftData);
            return response.data;
        }
    },
};

export const aiService = {
    generateEmail: async (data) => {
        const response = await api.post('/api/ai/generate', data);
        return response.data;
    }
};

export default api;
