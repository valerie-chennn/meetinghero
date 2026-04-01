import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite 配置：开发服务器代理到后端
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: ['.ngrok-free.dev', '.ngrok.io', '.trycloudflare.com', '.loca.lt'],
    proxy: {
      // 将 /api 路径代理到后端服务
      '/api': 'http://localhost:3001'
    }
  }
});
