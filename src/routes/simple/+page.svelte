<script lang="ts">
	/**
	 * Simple version: the whole resume as one calm, readable column. No motion, no canvas.
	 * Same facts as the full page (all from content.ts); prints to a clean one or two pages.
	 */
	import {
		activities,
		cfa,
		chapters,
		frc,
		gatech,
		leadership,
		otsego,
		person,
		questnav,
		resumePdf,
		skills,
		speechify
	} from '../../lib/content';

	const ref = Object.fromEntries(chapters.map((c) => [c.id, c.ref])) as Record<string, string>;

	const jobs = [
		{ id: 'speechify', ...speechify },
		{ id: 'questnav', ...questnav },
		{ id: 'frc', ...frc },
		{ id: 'cfa', ...cfa },
		{ id: 'otsego', ...otsego }
	];

	const strip = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '');
</script>

<svelte:head>
	<title>Sean Ernstes · Résumé</title>
	<meta
		name="description"
		content="Sean Ernstes: software engineer at Speechify, lead maintainer of QuestNav, and computer engineering student at Georgia Tech. Plain-text résumé."
	/>
</svelte:head>

<div class="page">
	<nav class="chrome top mono" aria-label="Version">
		<span>Simple version</span>
		<a href="/">Open the full version</a>
	</nav>

	<header class="head">
		<h1>{person.name}</h1>
		<p class="headline">{person.headline}</p>
		<p class="mono meta">{person.location}</p>
		<p class="seeking">Seeking {person.seeking}.</p>

		<ul class="contact" aria-label="Contact">
			<li><a href="mailto:{person.email}">{person.email}</a></li>
			<li><a href="{person.github}">{strip(person.github)}</a></li>
			<li><a href="{person.linkedin}">{strip(person.linkedin)}</a></li>
		</ul>

		<p class="chrome pdf">
			<a class="download" href={resumePdf} download>Download résumé (PDF)</a>
			<span class="note">The PDF predates the Speechify role.</span>
		</p>
	</header>

	<main>
		<section aria-labelledby="h-experience">
			<h2 id="h-experience">Experience</h2>
			{#each jobs as job (job.id)}
				<article class="entry">
					<h3>{job.role} <span class="org">· {job.org}</span></h3>
					<p class="mono when">
						<span class="tag">{ref[job.id]}</span>
						<span>{job.when}</span><span aria-hidden="true"> · </span><span>{job.where}</span>
					</p>
					<ul class="notes">
						{#each job.notes as note}
							<li>{note}</li>
						{/each}
					</ul>
				</article>
			{/each}
		</section>

		<section aria-labelledby="h-education">
			<h2 id="h-education">Education</h2>
			<article class="entry">
				<h3>{gatech.degree} <span class="org">· {gatech.org}</span></h3>
				<p class="mono when">
					<span class="tag">{ref.gatech}</span>
					<span>{gatech.when}</span><span aria-hidden="true"> · </span><span>GPA {gatech.gpa}</span>
				</p>
				<dl class="facts">
					<dt>Coursework</dt>
					<dd>{gatech.coursework.join(', ')}</dd>
					<dt>Teams</dt>
					<dd>{gatech.teams.join(', ')}</dd>
				</dl>
			</article>
		</section>

		<section aria-labelledby="h-skills">
			<div class="section-head">
				<h2 id="h-skills">Skills</h2>
				<span class="mono tag">{ref.skills}</span>
			</div>
			<h3 class="sub">Technical</h3>
			<ul class="inline">
				{#each skills.technical as s}<li>{s}</li>{/each}
			</ul>
			<h3 class="sub">Professional</h3>
			<ul class="inline">
				{#each skills.professional as s}<li>{s}</li>{/each}
			</ul>
		</section>

		<section aria-labelledby="h-leadership">
			<div class="section-head">
				<h2 id="h-leadership">Leadership</h2>
				<span class="mono tag">{ref.bom}</span>
			</div>
			<ul class="bom">
				{#each leadership as l}
					<li><span class="mono qty">{l.qty}</span><span>{l.item}</span></li>
				{/each}
			</ul>
		</section>

		<section aria-labelledby="h-activities">
			<h2 id="h-activities">Activities</h2>
			<ul class="inline spaced">
				{#each activities as a}<li>{a}</li>{/each}
			</ul>
		</section>

		<section class="contact-section" aria-labelledby="h-contact">
			<div class="section-head">
				<h2 id="h-contact">Contact</h2>
				<span class="mono tag">{ref.contact}</span>
			</div>
			<dl class="facts">
				<dt>Email</dt>
				<dd><a href="mailto:{person.email}">{person.email}</a></dd>
				<dt>GitHub</dt>
				<dd><a href={person.github}>{strip(person.github)}</a></dd>
				<dt>LinkedIn</dt>
				<dd><a href={person.linkedin}>{strip(person.linkedin)}</a></dd>
			</dl>
		</section>
	</main>

	<footer class="chrome foot mono">
		<a href="/">Open the full version</a>
		<a href={resumePdf} download>Résumé PDF</a>
	</footer>
</div>

<style>
	.page {
		max-width: calc(68ch + 2 * var(--gutter));
		margin: 0 auto;
		padding: 0 var(--gutter) 72px;
		font-size: 17px;
		line-height: 1.55;
		color: var(--ink);
	}

	/* ---- chrome ---- */
	.top {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 16px;
		padding: 18px 0 14px;
		border-bottom: 1px solid var(--rule);
		color: var(--ink-2);
	}
	.mono a {
		color: var(--ink);
		text-decoration: none;
		border-bottom: 1px solid var(--accent);
		padding-bottom: 1px;
	}
	.mono a:hover {
		color: var(--accent);
	}

	a:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 3px;
		border-radius: 1px;
	}

	/* ---- header ---- */
	.head {
		padding: 56px 0 8px;
	}
	h1 {
		font-size: clamp(3.4rem, 11vw, 5.6rem);
		font-stretch: 62%;
		font-weight: 820;
		line-height: 0.86;
		letter-spacing: -0.01em;
		text-transform: uppercase;
		margin-left: -0.03em;
	}
	.headline {
		margin-top: 18px;
		font-size: 1.3rem;
		line-height: 1.3;
		font-weight: 500;
		font-stretch: 88%;
	}
	.meta {
		margin-top: 8px;
		color: var(--ink-2);
	}
	.seeking {
		margin-top: 18px;
		max-width: 52ch;
	}

	.contact {
		list-style: none;
		margin: 22px 0 0;
		padding: 14px 0 0;
		border-top: 1px solid var(--ink);
		display: flex;
		flex-wrap: wrap;
		gap: 6px 28px;
		font-family: var(--mono);
		font-size: 13px;
	}
	.contact a,
	.facts a {
		color: var(--ink);
		text-decoration: none;
		border-bottom: 1px solid var(--rule);
	}
	.contact a:hover,
	.facts a:hover {
		border-bottom-color: var(--accent);
	}

	.pdf {
		margin-top: 28px;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 8px 18px;
	}
	.download {
		display: inline-block;
		padding: 10px 16px;
		border: 1px solid var(--ink);
		color: var(--ink);
		text-decoration: none;
		font-family: var(--mono);
		font-size: 13px;
		font-weight: 500;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.download:hover {
		background: var(--ink);
		color: var(--paper);
	}
	.note {
		font-size: 14px;
		color: var(--ink-2);
	}

	/* ---- sections ---- */
	section {
		margin-top: 56px;
		padding-top: 12px;
		border-top: 1px solid var(--ink);
	}
	.section-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 16px;
	}
	h2 {
		font-size: 1.75rem;
		font-stretch: 68%;
		font-weight: 760;
		line-height: 1.1;
		text-transform: uppercase;
		letter-spacing: 0.01em;
	}

	.tag {
		display: inline-block;
		min-width: 3.4em;
		padding: 1px 6px;
		border: 1px solid var(--rule);
		color: var(--accent);
		font-size: 11px;
		text-align: center;
		line-height: 1.6;
	}

	.entry {
		margin-top: 30px;
	}
	.entry + .entry {
		padding-top: 26px;
		border-top: 1px solid var(--rule);
	}
	h3 {
		font-size: 1.2rem;
		font-weight: 650;
		font-stretch: 90%;
		line-height: 1.25;
	}
	.org {
		font-weight: 450;
		color: var(--ink-2);
	}
	.when .tag {
		margin-right: 0.4em;
	}
	.when {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		column-gap: 0.6em;
		margin-top: 6px;
		color: var(--ink-2);
		font-variant-numeric: tabular-nums;
	}

	.notes {
		margin: 12px 0 0;
		padding: 0 0 0 1.1em;
	}
	.notes li {
		margin-top: 6px;
		padding-left: 0.2em;
	}
	.notes li::marker {
		color: var(--ink-2);
	}

	.facts {
		margin: 14px 0 0;
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 6px 20px;
	}
	.facts dt {
		font-family: var(--mono);
		font-size: 12px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--ink-2);
		padding-top: 0.3em;
	}
	.facts dd {
		margin: 0;
	}

	.sub {
		margin-top: 22px;
		font-family: var(--mono);
		font-size: 12px;
		font-weight: 500;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--ink-2);
	}
	.inline {
		list-style: none;
		margin: 8px 0 0;
		padding: 0;
	}
	.inline li {
		display: inline;
		white-space: nowrap;
	}
	.inline li:not(:last-child)::after {
		/* no-break before the dot, breakable space after it: lines wrap between items only */
		content: '\00a0· ';
		color: var(--ink-2);
		white-space: normal;
	}
	.spaced {
		margin-top: 16px;
	}

	.bom {
		list-style: none;
		margin: 16px 0 0;
		padding: 0;
	}
	.bom li {
		display: grid;
		grid-template-columns: 6ch 1fr;
		gap: 16px;
		align-items: baseline;
		padding: 7px 0;
		border-bottom: 1px solid var(--rule);
	}
	.bom li:first-child {
		border-top: 1px solid var(--rule);
	}
	.qty {
		color: var(--ink-2);
		font-variant-numeric: tabular-nums;
	}

	.foot {
		margin-top: 64px;
		padding-top: 14px;
		border-top: 1px solid var(--rule);
		display: flex;
		flex-wrap: wrap;
		gap: 10px 28px;
	}

	@media (max-width: 520px) {
		.page {
			font-size: 16px;
		}
		.head {
			padding-top: 40px;
		}
		.headline {
			font-size: 1.15rem;
		}
		section {
			margin-top: 44px;
		}
		.facts {
			grid-template-columns: 1fr;
			gap: 0;
		}
		.facts dd + dt {
			margin-top: 10px;
		}
	}

	/* ---- print: black on white, no chrome, one or two pages ---- */
	@media print {
		@page {
			margin: 14mm 15mm;
		}
		:global(html),
		:global(body) {
			background: #fff !important;
		}
		.page {
			--paper: #fff;
			--ink: #000;
			--ink-2: #333;
			--rule: #bbb;
			--accent: #000;
			max-width: none;
			padding: 0;
			font-size: 9.75pt;
			line-height: 1.38;
			color: #000;
		}
		/* contact is already in the header on paper */
		.chrome,
		.contact-section {
			display: none !important;
		}
		.head {
			padding: 0;
		}
		h1 {
			font-size: 30pt;
			line-height: 0.9;
		}
		.headline {
			margin-top: 6pt;
			font-size: 12pt;
		}
		.meta {
			margin-top: 2pt;
		}
		.seeking {
			margin-top: 4pt;
			max-width: none;
		}
		.contact {
			margin-top: 8pt;
			padding-top: 6pt;
			font-size: 9pt;
		}
		.contact a,
		.facts a {
			border: 0;
		}
		section {
			margin-top: 11pt;
			padding-top: 4pt;
			break-inside: auto;
		}
		h2 {
			font-size: 14pt;
			break-after: avoid;
		}
		h3 {
			font-size: 10.5pt;
		}
		.tag {
			font-size: 8pt;
			border-color: #999;
		}
		.mono,
		.facts dt,
		.sub {
			font-size: 8pt;
		}
		.entry {
			margin-top: 8pt;
			break-inside: avoid;
		}
		.entry + .entry {
			padding-top: 7pt;
		}
		.when {
			margin-top: 1pt;
		}
		.notes {
			margin-top: 3pt;
		}
		.notes li {
			margin-top: 1pt;
		}
		.sub {
			margin-top: 6pt;
		}
		.inline {
			margin-top: 2pt;
		}
		.facts {
			margin-top: 4pt;
			gap: 2pt 12pt;
		}
		.bom {
			margin-top: 6pt;
		}
		.bom li {
			padding: 1pt 0;
		}
		.bom li,
		.facts {
			break-inside: avoid;
		}
	}
</style>
