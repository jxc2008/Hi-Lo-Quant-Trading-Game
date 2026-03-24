const isDev = typeof window !== 'undefined' && window.location?.hostname === 'localhost';

export const API_BASE_URL = isDev ? "http://localhost:5000" : "https://hi-lo-backend.onrender.com";
export const WS_URL = isDev ? "ws://localhost:5000" : "wss://hi-lo-backend.onrender.com";
