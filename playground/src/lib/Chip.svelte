<script>
	let { copy, icon, children } = $props();

	let copied = $state(false);
	let timer;

	async function doCopy() {
		try {
			await navigator.clipboard.writeText(copy);
		} catch {
			// clipboard api needs a focused document, fall back to the
			// selection based approach
			const helper = document.body.appendChild(Object.assign(document.createElement('textarea'), { value: copy }));
			helper.select();
			document.execCommand('copy');
			helper.remove();
		}
		copied = true;
		clearTimeout(timer);
		timer = setTimeout(() => copied = false, 1000);
	}
</script>

<button
	type="button"
	title="Copy"
	aria-label="Copy {copy}"
	onclick={doCopy}
	class="mx-1 inline-flex cursor-pointer items-center gap-1 rounded border bg-page px-1 py-px whitespace-nowrap {copied ? 'border-accent text-accent' : 'border-line text-ink'}"
>
	{#if icon}
		<img class="size-3 shrink-0" src={icon} alt="">
	{/if}
	{@render children?.()}
</button>
