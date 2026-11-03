import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// Static site for GitHub Pages. 404.html is an SPA shell, so the client-only /lab debug route
			// still works there.
			adapter: adapter({ fallback: '404.html' }),
			// GitHub Pages serves this project from /portfolio; CI sets BASE_PATH, local dev runs at /.
			paths: { base: (process.env.BASE_PATH ?? '') as '' | `/${string}` }
		})
	]
});
