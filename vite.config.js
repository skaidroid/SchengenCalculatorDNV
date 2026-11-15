import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// base: './' makes the build work at any GitHub Pages path (https://<user>.github.io/<repo>/)
export default defineConfig({
  plugins: [vue()],
  base: './',
})
