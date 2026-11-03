<script lang="ts">
	/**
	 * Silkscreen-style chapter header: reference designator + via, org name, role, dates, place.
	 * `compact` is for use inside a pinned stage where space is tight.
	 */
	let {
		ref,
		org,
		role,
		when,
		where = '',
		compact = false
	}: { ref: string; org: string; role: string; when: string; where?: string; compact?: boolean } = $props();
</script>

<header class="head" class:compact>
	<p class="mono ref"><i class="via" aria-hidden="true"></i>{ref}</p>
	<h2>{org}</h2>
	<p class="role">{role}</p>
	<p class="mono meta">{when}{#if where}<span>·</span>{where}{/if}</p>
</header>

<style>
	.head {
		display: grid;
		gap: 2px;
	}
	.ref {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		color: var(--accent);
		margin-bottom: 10px;
	}
	.via {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		border: 3px solid var(--accent);
		background: var(--paper);
	}
	h2 {
		font-size: clamp(3rem, 8.5vw, 8rem);
		font-stretch: 62%;
		font-weight: 800;
		line-height: 0.84;
		letter-spacing: -0.01em;
		text-transform: uppercase;
	}
	.role {
		font-size: clamp(1.1rem, 1.8vw, 1.5rem);
		font-stretch: 85%;
		font-weight: 560;
		margin-top: 10px;
	}
	.meta {
		color: var(--ink-2);
		font-size: 11px;
	}
	.meta span {
		margin: 0 8px;
	}
	.compact h2 {
		font-size: clamp(2.4rem, 5.5vw, 5rem);
	}
	.compact .role {
		font-size: 1.05rem;
		margin-top: 6px;
	}
</style>
