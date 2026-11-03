/** Palettes defined in app.css as :root[data-palette=…]; hexes here are only for the swatch. */
export const palettes = [
	{ id: 'vermilion', label: 'Vermilion', paper: '#e9e7e1', accent: '#e5461d' },
	{ id: 'kraft', label: 'Kraft & copper', paper: '#d9cdb5', accent: '#a94e1c' },
	{ id: 'drafting', label: 'Drafting blue', paper: '#f2f1ec', accent: '#2347c9' },
	{ id: 'solder', label: 'Solder mask', paper: '#101712', accent: '#d5a347' },
	{ id: 'cyanotype', label: 'Cyanotype', paper: '#16385a', accent: '#f2c94c' }
] as const;

export type PaletteId = (typeof palettes)[number]['id'];

export function currentPalette(): PaletteId {
	return (document.documentElement.dataset.palette as PaletteId) || 'vermilion';
}

/** Switch palette and reload, since the 3D scene and canvases read colors at startup. */
export function setPalette(id: PaletteId) {
	try {
		localStorage.setItem('palette', id);
	} catch {}
	const url = new URL(location.href);
	url.searchParams.delete('palette');
	history.replaceState(null, '', url);
	location.reload();
}
