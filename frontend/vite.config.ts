import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './', // Lệnh cốt lõi: Chuyển đổi đường dẫn tuyệt đối (/) thành tương đối (./)
  plugins: [react()],
})