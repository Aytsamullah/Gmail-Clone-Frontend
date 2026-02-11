import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/api';

function AuthCallback() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { login } = useAuth();

    useEffect(() => {
        const handleCallback = async () => {
            const token = searchParams.get('token');
            const error = searchParams.get('message');

            if (error) {
                alert(`Authentication failed: ${error}`);
                navigate('/login');
                return;
            }

            if (token) {
                try {
                    // Get user info
                    localStorage.setItem('token', token);
                    const response = await authService.getCurrentUser();
                    login(token, response.user);
                    navigate('/inbox');
                } catch (err) {
                    console.error('Failed to get user info:', err);
                    navigate('/login');
                }
            } else {
                navigate('/login');
            }
        };

        handleCallback();
    }, [searchParams, navigate, login]);

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Completing authentication...</p>
            </div>
        </div>
    );
}

export default AuthCallback;
