export async function closeAfterPhotoTransition(dialog: HTMLDialogElement, flight: HTMLElement) {
	try {
		await Promise.all(flight.getAnimations().map((animation) => animation.finished));
	} catch {
		// Reversing a CSS transition cancels its superseded completion.
		return;
	}
	if (dialog.open && !dialog.classList.contains("is-open")) dialog.close();
}
