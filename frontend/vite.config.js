import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 개발 서버에서 /api 요청을 백엔드(Express, :4000)로 프록시
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
