<script lang="ts">
	import Pinned from '../kit/Pinned.svelte';
	import ChapterHead from '../kit/ChapterHead.svelte';
	import Pinout from '../kit/Pinout.svelte';
	import { seg } from '../kit/motion';
</script>

<div class="chapter" id="skills" data-chapter="skills">
	<Pinned length={110}>
		{#snippet children(p)}
			<div class="wrap">
				<ChapterHead ref="U7" org="Skills" role="Pin assignments" when="Powered up as you scroll" compact />
				<div class="chip">
					<Pinout lit={seg(p, 0.05, 0.8)} />
				</div>
			</div>
		{/snippet}
	</Pinned>
</div>

<style>
	.wrap {
		height: 100%;
		display: grid;
		grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.6fr);
		align-items: center;
		gap: 40px;
		padding: 80px var(--gutter) 40px var(--rail);
	}
	.chip {
		display: flex;
		justify-content: center;
	}
	@media (max-width: 980px) {
		.wrap {
			grid-template-columns: 1fr;
			align-content: center;
			gap: 24px;
			padding-top: 64px;
		}
	}
</style>
