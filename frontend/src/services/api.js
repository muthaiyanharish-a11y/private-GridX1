// simple axios wrapper - baseURL points to your backend hub
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 5000,
});

// If a protect key is provided via Vite env, attach it to sensitive requests by default
const PROTECT_KEY = import.meta.env.VITE_PROTECT_KEY || null;
if (PROTECT_KEY) {
  api.interceptors.request.use(config => {
    // only attach when not already present
    config.headers = config.headers || {};
    if (!config.headers['x-api-key'] && !config.headers['authorization']) {
      config.headers['x-api-key'] = PROTECT_KEY;
    }
    return config;
  }, err => Promise.reject(err));
}

export default api;
