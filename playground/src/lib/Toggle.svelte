<script>
	let { checked = $bindable(), label } = $props();
</script>

<button
	type="button"
	role="switch"
	aria-checked={checked}
	class="group flex cursor-pointer items-center gap-2 text-[13px] text-ink-dim select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
	onclick={() => checked = !checked}
>
	<span class="h-4 w-7 rounded-full bg-line p-0.5 group-aria-checked:bg-ink-strong">
		<span class="block size-3 rounded-full bg-page group-aria-checked:translate-x-3"></span>
	</span>
	{label}
</button>
