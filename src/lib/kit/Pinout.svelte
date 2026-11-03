<script lang="ts">
	/**
	 * Skills drawn as a DIP package. Left bank: technical; right bank: people skills, padded with
	 * NC (no-connect) pins so both banks match. `lit` is 0..1: how many pins have "powered up".
	 */
	import { skills } from '../content';

	let { lit = 1 }: { lit?: number } = $props();

	const n = Math.max(skills.technical.length, skills.professional.length);
	const left = skills.technical;
	const right = [...skills.professional, ...Array(n - skills.professional.length).fill(null)] as (string | null)[];
	const on = (pin: number) => lit * n * 2 >= pin;
</script>

<figure class="pinout">
	<ol class="side l">
		{#each left as label, i}
			<li class:on={on(i + 1)}><span class="name">{label}</span><span class="num mono">{i + 1}</span><i></i></li>
		{/each}
	</ol>
	<div class="body">
		<span class="notch"></span>
		<span class="pin1"></span>
		<span class="part mono">SE-2030</span>
		<span class="desc mono">GT · CmpE<br />DIP-{n * 2}</span>
	</div>
	<ol class="side r">
		{#each right as label, i}
			<li class:on={on(n + i + 1)} class:nc={!label}>
				<i></i><span class="num mono">{n * 2 - i}</span><span class="name">{label ?? 'NC'}</span>
			</li>
		{/each}
	</ol>
	<figcaption class="mono">Left bank: technical. Right bank: people. NC = no connect, room to grow.</figcaption>
</figure>

<style>
	.pinout {
		margin: 0;
		display: grid;
		grid-template-columns: 1fr minmax(120px, 190px) 1fr;
		align-items: stretch;
		max-width: 820px;
		width: 100%;
	}
	.side {
		list-style: none;
		margin: 0;
		padding: 18px 0;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 2px;
	}
	.side li {
		display: flex;
		align-items: center;
		gap: 10px;
		height: 26px;
		color: var(--ink-2);
		transition: color 0.25s;
	}
	.l li {
		justify-content: flex-end;
	}
	.side i {
		width: 26px;
		height: 10px;
		background: var(--paper-2);
		border: 1px solid var(--ink);
		transition: background 0.25s;
	}
	.l i {
		border-right: 0;
	}
	.r i {
		border-left: 0;
	}
	.side li.on {
		color: var(--ink);
	}
	.side li.on i {
		background: var(--accent);
	}
	.side li.nc .name {
		color: var(--ink-2);
		opacity: 0.6;
		font-family: var(--mono);
		font-size: 11px;
	}
	.side li.nc.on i {
		background: var(--paper-2);
	}
	.num {
		color: var(--ink-2);
		width: 2ch;
		text-align: center;
		font-size: 11px;
	}
	.name {
		font-size: 15px;
		font-stretch: 85%;
		font-weight: 520;
		white-space: nowrap;
	}

	.body {
		position: relative;
		background: var(--ink);
		color: var(--paper);
		border-radius: 3px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 10px;
		writing-mode: vertical-rl;
	}
	.notch {
		position: absolute;
		top: -1px;
		left: 50%;
		width: 26px;
		height: 13px;
		translate: -50% 0;
		background: var(--paper);
		border-radius: 0 0 13px 13px;
	}
	.pin1 {
		position: absolute;
		top: 22px;
		left: 16px;
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--accent);
	}
	.part {
		font-size: 22px;
		font-weight: 500;
		letter-spacing: 0.18em;
	}
	.desc {
		font-size: 10px;
		opacity: 0.6;
	}
	figcaption {
		grid-column: 1 / -1;
		margin-top: 18px;
		color: var(--ink-2);
		font-size: 11px;
		text-align: center;
	}

	@media (max-width: 620px) {
		.pinout {
			grid-template-columns: 1fr 56px 1fr;
		}
		.name {
			font-size: 11.5px;
		}
		.side i {
			width: 12px;
		}
		.side li {
			gap: 4px;
			height: 22px;
		}
		.part {
			font-size: 14px;
		}
		.desc {
			display: none;
		}
	}
</style>
