<script lang="ts">
	import '@fontsource-variable/archivo/wdth.css';
	import '@fontsource/ibm-plex-mono/400.css';
	import '@fontsource/ibm-plex-mono/500.css';
	import '../app.css';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link
		rel="icon"
		href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%23141413'/%3E%3Crect x='7' y='11' width='18' height='10' rx='4' fill='%23e9e7e1'/%3E%3Ccircle cx='16' cy='16' r='2' fill='%23e5461d'/%3E%3C/svg%3E"
	/>
</svelte:head>

{@render children()}
