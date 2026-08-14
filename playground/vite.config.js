import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [svelte(), tailwindcss()],
	// relative assets, so the build works both at the site root and under a path
	base: './',
	build: {
		// keep the icon set as files instead of inlining hundreds of
		// data urls into the bundle, only rendered icons get fetched
		assetsInlineLimit: 0,
	},
	server: {
		fs: { allow: ['..'] },
	},
});
