<script lang="ts">
	/**
	 * BOM — leadership and activities as a bill of materials. Rows are "placed" as they scroll up
	 * through the lower part of the viewport (pick-and-place: a dashed courtyard, then the part drops in).
	 * Placement is a pure function of scroll position; under /lab the forced progress places rows instead.
	 */
	import { getContext, onMount } from 'svelte';
	import ChapterHead from '../kit/ChapterHead.svelte';
	import { FORCED_PROGRESS, clamp } from '../kit/motion';
	import { chapters, leadership, activities, questnav } from '../content';

	const refOf = (id: string) => chapters.find((c) => c.id === id)?.ref ?? '';

	type Row = { qty: string; unit: string; ref: string; desc: string; note: string };

	// cross-references to the other parts on this board
	const leadNotes: Record<string, string> = {
		'FIRST Robotics Programming Team Captain': `see ${refOf('frc')}`,
		'Chick-fil-A Shift Leader': `see ${refOf('cfa')}`,
		'QuestNav Core Maintainer': `${questnav.when} · see ${refOf('questnav')}`
	};
	const lead: Row[] = leadership.map((l, i) => {
		const [n, unit = ''] = l.qty.split(' ');
		return { qty: n, unit, ref: `L${i + 1}`, desc: l.item, note: leadNotes[l.item] ?? '' };
	});

	const studentCouncil = lead.find((r) => r.desc.startsWith('Student Council'))?.ref;
	const actNotes: Record<string, string> = {
		'FIRST Robotics': `see ${refOf('frc')}`,
		'Student Council': studentCouncil ? `see ${studentCouncil}` : '',
		'Chi Phi Fraternity': `see ${refOf('gatech')}`
	};
	const acts: Row[] = activities.map((a, i) => {
		// "Boy Scouts: Eagle Scout, 2025" → description + note; "…Landers, avionics" likewise
		let desc = a;
		let note = '';
		const colon = a.indexOf(': ');
		if (colon > 0) [desc, note] = [a.slice(0, colon), a.slice(colon + 2)];
		else if (a.includes(', ')) {
			const k = a.lastIndexOf(', ');
			[desc, note] = [a.slice(0, k), a.slice(k + 2)];
		}
		if (/Georgia Tech/.test(desc)) note = [note, `see ${refOf('gatech')}`].filter(Boolean).join(' · ');
		note ||= actNotes[a] ?? '';
		return { qty: '1', unit: '', ref: `A${i + 1}`, desc, note };
	});

	const sections = [
		{ title: 'Leadership', rows: lead, from: 0 },
		{ title: 'Activities', rows: acts, from: lead.length }
	];
	const N = lead.length + acts.length;

	const forced = getContext<number | undefined>(FORCED_PROGRESS);
	let rowEls: HTMLElement[] = $state([]);
	let place = $state<number[]>(
		Array.from({ length: N }, (_, i) => (forced !== undefined ? clamp(forced * (N + 1) - i - 0.5) : 0))
	);
	const placed = $derived(place.filter((r) => r >= 1).length);

	onMount(() => {
		if (forced !== undefined) return;
		const update = () => {
			const line = innerHeight * 0.84;
			const span = Math.max(60, innerHeight * 0.16);
			place = rowEls.map((el) => clamp((line - el.getBoundingClientRect().top) / span));
		};
		update();
		addEventListener('scroll', update, { passive: true });
		addEventListener('resize', update);
		return () => {
			removeEventListener('scroll', update);
			removeEventListener('resize', update);
		};
	});

	const two = (n: number) => String(n).padStart(2, '0');
</script>

<div class="chapter" id="bom" data-chapter="bom">
	<ChapterHead
		ref="BOM"
		org="Leadership"
		role="And activities, itemized as a bill of materials"
		when="{N} line items"
		where="Sheet 1 of 1"
	/>

	<table class="bom">
		<colgroup>
			<col class="c-item" />
			<col class="c-qty" />
			<col class="c-ref" />
			<col class="c-desc" />
			<col class="c-note" />
		</colgroup>
		<thead>
			<tr class="mono">
				<th>Item</th>
				<th>Qty</th>
				<th>Ref des</th>
				<th>Description</th>
				<th class="hn">Notes</th>
			</tr>
		</thead>
		{#each sections as s}
			<tbody>
				<tr class="sec">
					<th colspan="5" class="mono">
						{s.title}<span>{s.rows[0].ref}–{s.rows[s.rows.length - 1].ref}</span>
					</th>
				</tr>
				{#each s.rows as r, j}
					{@const i = s.from + j}
					{@const v = place[i] ?? 0}
					<tr
						bind:this={rowEls[i]}
						class:placing={v > 0 && v < 1}
						class:placed={v >= 1}
						style:--r={v}
					>
						<td class="item mono"><i class="pad" aria-hidden="true"></i>{two(i + 1)}</td>
						<td class="qty"><b>{r.qty}</b>{#if r.unit}<small class="mono">{r.unit}</small>{/if}</td>
						<td class="ref mono">{r.ref}</td>
						<td class="desc">
							<span class="part">{r.desc}</span>
							{#if r.note}<span class="sub">{r.note}</span>{/if}
						</td>
						<td class="note">{r.note || '—'}</td>
					</tr>
				{/each}
			</tbody>
		{/each}
	</table>

	<dl class="block mono">
		<div><dt>Dwg</dt><dd>SE-BOM</dd></div>
		<div><dt>Placed</dt><dd class:done={placed === N}>{two(placed)} / {two(N)}</dd></div>
		<div><dt>Qty</dt><dd>Leadership in years</dd></div>
		<div><dt>Ref</dt><dd>U2, U3, U6, Y4 = parts on this board</dd></div>
	</dl>
</div>

<style>
	.chapter {
		padding: 120px var(--gutter) 140px var(--rail);
	}
	.bom {
		width: 100%;
		max-width: 1180px;
		margin-top: 48px;
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
	}
	.c-item {
		width: 76px;
	}
	.c-qty {
		width: 92px;
	}
	.c-ref {
		width: 96px;
	}
	.c-note {
		width: 32%;
	}
	thead th {
		text-align: left;
		font-weight: 500;
		font-size: 10.5px;
		color: var(--ink-2);
		padding: 0 12px 8px 0;
		border-bottom: 1.5px solid var(--ink);
	}
	.sec th {
		text-align: left;
		font-weight: 500;
		font-size: 10.5px;
		color: var(--ink);
		padding: 22px 0 8px;
		border-bottom: 1px solid var(--ink);
	}
	.sec span {
		color: var(--ink-2);
		margin-left: 14px;
	}
	tbody tr:not(.sec) {
		border-bottom: 1px solid var(--rule);
	}
	td {
		padding: 11px 12px 11px 0;
		vertical-align: baseline;
	}

	/* placement: everything but the courtyard fades in with --r (no movement: scroll-linked motion jitters in Firefox) */
	td > * {
		display: inline-block;
	}
	td {
		color: var(--ink);
	}
	.qty b,
	.qty small,
	.ref,
	.part,
	td.note {
		opacity: calc(0.1 + 0.9 * var(--r));
	}
	.item {
		font-size: 11px;
		color: var(--ink-2);
		white-space: nowrap;
	}
	.pad {
		width: 9px;
		height: 9px;
		margin-right: 12px;
		border: 1px dashed var(--ink-2);
		vertical-align: -1px;
	}
	.placing .pad {
		border: 1px solid var(--accent);
		background: var(--accent);
	}
	.placed .pad {
		border: 1px solid var(--ink);
		background: var(--ink);
	}
	.placing .ref {
		color: var(--accent);
	}
	.qty b {
		font-stretch: 62%;
		font-weight: 760;
		font-size: 1.6rem;
		line-height: 1;
	}
	.qty small {
		margin-left: 4px;
		font-size: 10px;
		color: var(--ink-2);
	}
	.ref {
		font-size: 12px;
	}
	.part {
		font-size: clamp(1.05rem, 1.5vw, 1.3rem);
		font-stretch: 85%;
		font-weight: 600;
		line-height: 1.2;
	}
	.sub {
		display: none;
	}
	td.note {
		font-size: 15px;
		font-stretch: 90%;
		color: var(--ink-2);
	}

	.block {
		display: grid;
		grid-template-columns: auto auto 1fr auto;
		max-width: 1180px;
		margin: 28px 0 0;
		border: 1px solid var(--ink);
		font-size: 10.5px;
	}
	.block > div {
		padding: 8px 12px;
		border-right: 1px solid var(--ink);
	}
	.block > div:last-child {
		border-right: 0;
	}
	.block dt {
		color: var(--ink-2);
		font-size: 9.5px;
	}
	.block dd {
		margin: 2px 0 0;
		font-variant-numeric: tabular-nums;
	}
	.block dd.done {
		color: var(--accent);
	}

	@media (max-width: 720px) {
		.chapter {
			padding-top: 96px;
			padding-bottom: 96px;
		}
		.bom {
			margin-top: 32px;
		}
		.c-item {
			width: 44px;
		}
		.c-qty {
			width: 52px;
		}
		.c-ref {
			width: 40px;
		}
		.c-note,
		.hn,
		td.note {
			display: none;
		}
		.pad {
			display: none;
		}
		.item {
			font-size: 10px;
		}
		.placing .item {
			color: var(--accent);
		}
		.placed .item {
			color: var(--ink);
		}
		td {
			padding: 9px 8px 9px 0;
		}
		.qty b {
			font-size: 1.3rem;
		}
		.qty small {
			margin-left: 2px;
			font-size: 9px;
		}
		.ref {
			font-size: 10.5px;
		}
		.part {
			font-size: 1rem;
		}
		.sub {
			display: block;
			margin-top: 2px;
			font-size: 13px;
			color: var(--ink-2);
			opacity: calc(0.1 + 0.9 * var(--r));
		}
		thead th {
			font-size: 9.5px;
			padding-right: 6px;
		}
		.block {
			grid-template-columns: 1fr 1fr;
		}
		.block > div:nth-child(2) {
			border-right: 0;
		}
		.block > div:nth-child(-n + 2) {
			border-bottom: 1px solid var(--ink);
		}
	}
</style>
