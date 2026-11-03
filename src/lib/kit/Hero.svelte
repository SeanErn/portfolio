<script lang="ts">
	/** Title block: name, one-line pitch, and a board map of every chapter as component footprints. */
	import { chapters, person } from '../content';
</script>

<header class="hero">
	<p class="mono kicker">
		<span>{person.headline}</span>
		<span>{person.location}</span>
	</p>
	<h1>Sean<br />Ernstes</h1>

	<div class="foot">
		<p class="lede">
			I build software for machines that need to know where they are, and I'm heading for the silicon
			underneath. Currently a software engineer at Speechify and studying computer engineering at
			Georgia Tech.
		</p>

		<nav class="board" aria-label="Chapters">
			<p class="mono title">Board map <span>· {chapters.length} parts</span></p>
			<ol>
				{#each chapters as c, i}
					<li style:--i={i}>
						<a href="#{c.id}">
							<span class="pad" aria-hidden="true"></span>
							<span class="mono ref">{c.ref}</span>
							<span class="name">{c.label}</span>
						</a>
					</li>
				{/each}
			</ol>
		</nav>
	</div>
	<p class="mono tp" aria-hidden="true"><i></i>TP1 · signal in</p>
</header>

<style>
	.hero {
		position: relative;
		min-height: 100vh;
		min-height: 100svh;
		padding: 96px var(--gutter) 64px var(--rail);
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
	}
	.kicker {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 28px;
		color: var(--ink-2);
		margin-bottom: 16px;
	}
	h1 {
		font-size: clamp(5rem, 19vw, 21rem);
		font-stretch: 62%;
		font-weight: 820;
		line-height: 0.79;
		letter-spacing: -0.02em;
		text-transform: uppercase;
		margin-left: -0.04em;
	}
	.foot {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr);
		gap: 40px;
		margin-top: 26px;
		padding-top: 16px;
		border-top: 1px solid var(--ink);
	}
	.lede {
		max-width: 40ch;
		font-size: 1.15rem;
		line-height: 1.38;
	}
	.title {
		color: var(--ink-2);
		font-size: 11px;
		margin-bottom: 10px;
	}
	.title span {
		opacity: 0.7;
	}
	.board ol {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 8px;
	}
	.board a {
		position: relative;
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: baseline;
		column-gap: 10px;
		padding: 9px 12px 9px 22px;
		border: 1px solid var(--ink);
		text-decoration: none;
		background: var(--paper);
		animation: plot 0.5s calc(var(--i) * 70ms + 200ms) both cubic-bezier(0.2, 0.7, 0.2, 1);
	}
	.pad {
		position: absolute;
		left: 7px;
		top: 50%;
		width: 7px;
		height: 7px;
		translate: 0 -50%;
		background: var(--ink-2);
		transition: background 0.2s;
	}
	.ref {
		font-size: 10px;
		color: var(--accent);
	}
	.name {
		font-size: 15px;
		font-stretch: 85%;
		font-weight: 560;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.board a:hover,
	.board a:focus-visible {
		background: var(--ink);
		color: var(--paper);
		outline: none;
	}
	.board a:hover .pad,
	.board a:focus-visible .pad {
		background: var(--accent);
	}
	@keyframes plot {
		from {
			opacity: 0;
			clip-path: inset(0 100% 0 0);
		}
		to {
			opacity: 1;
			clip-path: inset(0 0 0 0);
		}
	}

	.tp {
		position: absolute;
		left: 18px;
		top: calc(90svh - 6px);
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 9px;
		color: var(--accent);
	}
	.tp i {
		width: 24px;
		height: 24px;
		border: 3.5px solid var(--accent);
		border-radius: 50%;
		background: var(--paper);
		margin-left: 0;
	}

	@media (max-width: 820px) {
		.hero {
			padding-top: 72px;
		}
		.foot {
			grid-template-columns: 1fr;
			gap: 24px;
		}
		.board ol {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.tp {
			display: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.board a {
			animation: none;
		}
	}
</style>
