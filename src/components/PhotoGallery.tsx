import {
	type MouseEvent,
	type CSSProperties,
	type ReactEventHandler,
	type RefObject,
	useEffect,
	useEffectEvent,
	useLayoutEffect,
	useRef,
	useState,
	memo,
} from "react";
import EmblaCarousel, { type EmblaCarouselType } from "embla-carousel";
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures";
import ScrollBooster from "scrollbooster";
import {
	type GalleryPhoto,
	photoSrcSet,
	photoUrl,
} from "../lib/photoUrl";
import { closeAfterPhotoTransition } from "../lib/photoTransition";
import { reflectionBlend } from "../lib/photoReflection";
import { PhotoRail } from "./PhotoRail";

type PhotoPictureProps = {
	photo: GalleryPhoto;
	alt: string;
	sizes: string;
	eager?: boolean;
	className?: string;
	onLoad?: ReactEventHandler<HTMLImageElement>;
};

const PhotoPicture = memo(function PhotoPicture({
	photo,
	alt,
	sizes,
	eager = false,
	className,
	onLoad,
}: PhotoPictureProps) {
	const fallbackWidth = Math.min(photo.width, 1600);
	return (
		<picture>
			<source
				type="image/avif"
				srcSet={photoSrcSet(photo, "avif")}
				sizes={sizes}
			/>
			<source
				type="image/webp"
				srcSet={photoSrcSet(photo, "webp")}
				sizes={sizes}
			/>
			<img
				draggable={false}
				className={className}
				src={photoUrl(photo, fallbackWidth, "jpeg")}
				srcSet={photoSrcSet(photo, "jpeg")}
				sizes={sizes}
				width={photo.width}
				height={photo.height}
				alt={alt}
				loading={eager ? "eager" : "lazy"}
				fetchPriority={eager ? "high" : "auto"}
				decoding="async"
				onLoad={onLoad}
			/>
		</picture>
	);
});

function ZoomedPhoto({ photo, previewSrc, flightRef, active }: {
	photo: GalleryPhoto;
	previewSrc: string;
	flightRef?: RefObject<HTMLDivElement | null>;
	active: boolean;
}) {
	const [loaded, setLoaded] = useState(false);
	return (
		<div className="photo-dialog-image-wrap">
			<div
				ref={flightRef}
				className="photo-flight"
				style={{
					"--photo-ratio": photo.width / photo.height,
					"--photo-glow": `url("${photo.blurSrc}")`,
				} as CSSProperties}
			>
				<div className="photo-image-layer" aria-hidden="true">
					<img
						draggable={false}
						src={previewSrc}
						width={photo.width}
						height={photo.height}
						alt=""
						className="photo-dialog-image"
					/>
				</div>
				{active && <div className={`photo-image-layer photo-image-full${loaded ? " is-loaded" : ""}`}>
					<PhotoPicture
						photo={photo}
						alt={photo.alt}
						sizes={`${photo.width}px`}
						eager
						className="photo-dialog-image"
						onLoad={async (event) => {
							const image = event.currentTarget;
							try {
								await image.decode();
								setLoaded(true);
							} catch {
								// Keep the preview if the full-size image cannot be decoded.
							}
						}}
					/>
				</div>}
			</div>
		</div>
	);
}

type PhotoGalleryProps = {
	photos: GalleryPhoto[];
	static?: boolean;
};

function transformToThumbnail(flight: HTMLElement, thumbnail: DOMRect) {
	const stage = flight.parentElement!.getBoundingClientRect();
	const style = getComputedStyle(flight);
	const width = parseFloat(style.width);
	const height = parseFloat(style.height);
	const left = stage.left + (stage.width - width) / 2;
	const top = stage.top + (stage.height - height) / 2;
	return `translate(${thumbnail.left - left}px, ${thumbnail.top - top}px) scale(${thumbnail.width / width}, ${thumbnail.height / height})`;
}

export function PhotoGallery({
	photos,
	static: isStatic = false,
}: PhotoGalleryProps) {
	const [selection, setSelection] = useState<{ index: number; previewSrc: string } | null>(null);
	const selectedIndex = selection?.index ?? null;
	const streamRef = useRef<HTMLOListElement>(null);
	const dialogRef = useRef<HTMLDialogElement>(null);
	const flightRef = useRef<HTMLDivElement>(null);
	const carouselNodeRef = useRef<HTMLDivElement>(null);
	const carouselRef = useRef<EmblaCarouselType | null>(null);
	const actionsRef = useRef<HTMLElement>(null);
	const dragScrollRef = useRef<ScrollBooster | null>(null);
	const originRectRef = useRef<DOMRect | null>(null);
	const closeButtonRef = useRef<HTMLButtonElement>(null);
	const openerRef = useRef<HTMLButtonElement | null>(null);
	const total = photos.length;
	const selectedPhoto = photos[selectedIndex ?? 0];
	const onCarouselSelect = useEffectEvent((carousel: EmblaCarouselType) => selectPhoto(carousel.selectedScrollSnap()));
	const onCarouselDrag = useEffectEvent(() => setExpanded(true));

	useEffect(() => {
		const viewport = streamRef.current!.closest<HTMLElement>(".photo-page-scroll")!;
		const content = viewport.querySelector<HTMLElement>(".v-cotswolds")!;
		const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
		const stop = () => {
			const top = viewport.scrollTop;
			viewport.scrollTo({ top, behavior: "instant" });
			dragScrollRef.current?.setPosition({ x: 0, y: top });
		};
		const onWheel = (event: WheelEvent) => {
			if (event.ctrlKey || dialogRef.current?.open) return;
			stop();
		};
		const onPointerDown = () => {
			content.dataset.pointerInput = "";
			stop();
		};
		const focusScrollSurface = (event: KeyboardEvent) => {
			if (event.metaKey || event.ctrlKey || event.altKey || ["Shift", "Meta", "Control", "Alt"].includes(event.key)) return;
			delete content.dataset.pointerInput;
			if (document.activeElement === document.body && ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) {
				viewport.focus({ preventScroll: true });
			}
		};
		const scroller = new ScrollBooster({
			viewport,
			content,
			direction: "vertical",
			pointerMode: "mouse",
			// Idle metric updates must not cancel browser-owned smooth scrolling.
			onUpdate: (state) => {
				if (state.isMoving) viewport.scrollTop = state.position.y;
			},
			bounce: false,
			inputsFocus: false,
			shouldScroll: () => !dialogRef.current?.open,
			onPointerDown: stop,
			onPointerMove: (state, event) => viewport.classList.toggle("is-dragging", event.buttons === 1 && state.isDragging && !dialogRef.current?.open),
			onPointerUp: () => {
				viewport.classList.remove("is-dragging");
				if (isStatic || reducedMotion.matches) stop();
			},
		});
		dragScrollRef.current = scroller;
		stop();
		viewport.addEventListener("wheel", onWheel, { passive: true });
		viewport.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });
		viewport.addEventListener("touchstart", stop, { passive: true });
		window.addEventListener("keydown", stop, true);
		window.addEventListener("blur", stop);
		window.addEventListener("keydown", focusScrollSurface);
		return () => {
			stop();
			scroller.destroy();
			dragScrollRef.current = null;
			viewport.removeEventListener("wheel", onWheel);
			viewport.removeEventListener("pointerdown", onPointerDown, true);
			viewport.removeEventListener("touchstart", stop);
			window.removeEventListener("keydown", stop, true);
			window.removeEventListener("blur", stop);
			window.removeEventListener("keydown", focusScrollSurface);
		};
	}, [isStatic]);

	useLayoutEffect(() => {
		if (selectedIndex === null) return;
		const dialog = dialogRef.current!;
		const flight = flightRef.current!;
		const thumbnail = streamRef.current!.children[selectedIndex].querySelector("button")!;
		if (!dialog.open) {
			dialog.showModal();
			document.documentElement.classList.add("has-photo-dialog");
			const carousel = EmblaCarousel(carouselNodeRef.current!, {
				startIndex: selectedIndex,
				containScroll: false,
				watchFocus: false,
				watchDrag: (carousel, event) => event.target === carousel.containerNode()
					|| event.target instanceof Element && !!event.target.closest(".photo-flight"),
				...(isStatic ? { duration: 0 } : {}),
				breakpoints: { "(prefers-reduced-motion: reduce)": { duration: 0 } },
			}, [WheelGesturesPlugin({ target: dialog })]);
			carouselRef.current = carousel;
			const reflectionLayers = [...actionsRef.current!.querySelectorAll<HTMLElement>(".photo-button-reflection > span")];
			let previousFrom = -1;
			const reflect = () => {
				const { from, to, mix } = reflectionBlend(carousel.scrollProgress(), photos.length);
				for (let i = 0; i < reflectionLayers.length; i++) {
					const layer = reflectionLayers[i];
					if (from !== previousFrom) layer.style.setProperty("--edge-reflection", `url("${photos[i % 2 ? to : from].blurSrc}")`);
					layer.style.opacity = String(i % 2 ? mix : 1 - mix);
				}
				previousFrom = from;
			};
			carousel.on("scroll", reflect).on("reInit", reflect);
			reflect();
			let dragging = false;
			carousel.on("select", onCarouselSelect);
			carousel.on("pointerDown", () => { dragging = true; });
			carousel.on("scroll", () => {
				if (dragging && !dialog.classList.contains("is-open")) onCarouselDrag();
			});
			carousel.on("pointerUp", () => {
				dragging = false;
				if (isStatic || matchMedia("(prefers-reduced-motion: reduce)").matches) {
					carousel.scrollTo(carousel.selectedScrollSnap(), true);
				}
			});
			const origin = originRectRef.current!;
			flight.style.transition = "none";
			flight.style.transform = transformToThumbnail(flight, origin);
			void flight.offsetWidth;
			dialog.classList.add("is-open");
			flight.style.removeProperty("transition");
			flight.style.removeProperty("transform");
			closeButtonRef.current?.focus({ preventScroll: true });
		}
		thumbnail.classList.add("is-zoomed");
		return () => thumbnail.classList.remove("is-zoomed");
	}, [selectedIndex, isStatic, photos]);

	useEffect(
		() => () => {
			carouselRef.current?.destroy();
			document.documentElement.classList.remove("has-photo-dialog");
		},
		[],
	);

	function openPhoto(index: number, event: MouseEvent<HTMLButtonElement>) {
		const viewport = streamRef.current!.closest<HTMLElement>(".photo-page-scroll")!;
		dragScrollRef.current?.setPosition({ x: 0, y: viewport.scrollTop });
		openerRef.current = event.currentTarget;
		originRectRef.current = event.currentTarget.querySelector("img")!.getBoundingClientRect();
		selectPhoto(index);
	}

	function selectPhoto(index: number) {
		const thumbnail = streamRef.current?.children[index].querySelector("img");
		const previewSrc = thumbnail?.complete && thumbnail.naturalWidth > 0
			? thumbnail.currentSrc
			: photoUrl(photos[index], 768, "jpeg");
		setSelection({ index, previewSrc });
	}

	function setExpanded(expanded: boolean) {
		const dialog = dialogRef.current;
		const flight = flightRef.current;
		if (!dialog?.open || !flight) return;
		dialog.classList.toggle("is-open", expanded);
		if (expanded) {
			flight.style.removeProperty("transform");
			return;
		}
		// Settle the carousel underneath the current visual position before the return flight.
		const visibleRect = flight.getBoundingClientRect();
		const stageLeft = flight.parentElement!.getBoundingClientRect().left;
		carouselRef.current?.scrollTo(selectedIndex!, true);
		if (flight.parentElement!.getBoundingClientRect().left !== stageLeft) {
			flight.style.transition = "none";
			flight.style.transform = transformToThumbnail(flight, visibleRect);
			void flight.offsetWidth;
			flight.style.removeProperty("transition");
		}
		const thumbnail = streamRef.current!.children[selectedIndex!].querySelector("img")!;
		flight.style.transform = transformToThumbnail(flight, thumbnail.getBoundingClientRect());
		void closeAfterPhotoTransition(dialog, flight);
	}

	function handleClosed() {
		if (dialogRef.current?.open) return;
		carouselRef.current?.destroy();
		carouselRef.current = null;
		dialogRef.current?.classList.remove("is-open");
		document.documentElement.classList.remove("has-photo-dialog");
		setSelection(null);
		requestAnimationFrame(() => {
			if (!dialogRef.current?.open) openerRef.current?.focus({ preventScroll: true });
		});
	}

	function moveSelection(direction: -1 | 1) {
		if (selectedIndex === null) return;
		setExpanded(true);
		if (direction === -1) carouselRef.current?.scrollPrev();
		else carouselRef.current?.scrollNext();
	}

	return (
		<>
			<PhotoRail photos={photos} streamRef={streamRef} onNavigate={(index) => {
				const viewport = streamRef.current!.closest<HTMLElement>(".photo-page-scroll")!;
				dragScrollRef.current?.setPosition({ x: 0, y: viewport.scrollTop });
				const photo = streamRef.current!.children[index];
				viewport.scrollTo({
					top: viewport.scrollTop + photo.getBoundingClientRect().top - 24,
					behavior: isStatic || matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
				});
			}} />
			<ol ref={streamRef} className="photo-stream" aria-label="Photographs" role="list">
				{photos.map((photo, index) => (
					<li key={photo.id}>
						<button
							type="button"
							className="photo-open"
							style={{ "--photo-glow": `url("${photo.blurSrc}")` } as CSSProperties}
							onClick={(event) => openPhoto(index, event)}
							onClickCapture={(event) => {
								// Native touch and keyboard activation must not inherit a previous mouse drag.
								if (event.detail === 0 || (event.nativeEvent instanceof PointerEvent && event.nativeEvent.pointerType === "touch")) {
									event.stopPropagation();
									openPhoto(index, event);
								}
							}}
							aria-label={`Open photo ${index + 1} of ${total}: ${photo.alt}`}
						>
							<PhotoPicture
								photo={photo}
								alt=""
								sizes="(min-width: 63rem) 60rem, calc(100vw - 3rem)"
								eager={index === 0}
								className="photo-stream-image"
							/>
						</button>
					</li>
				))}
			</ol>

			<dialog
				ref={dialogRef}
				className="photo-dialog"
				data-static={isStatic || undefined}
				aria-labelledby="photo-dialog-title"
				onClose={handleClosed}
				onCancel={(event) => {
					event.preventDefault();
					setExpanded(false);
				}}
				onClick={(event) => {
					if (event.target instanceof Element && !event.target.closest("button")) {
						setExpanded(!dialogRef.current!.classList.contains("is-open"));
					}
				}}
				onKeyDown={(event) => {
					if (event.key === "ArrowLeft") {
						event.preventDefault();
						moveSelection(-1);
					}
					if (event.key === "ArrowRight") {
						event.preventDefault();
						moveSelection(1);
					}
				}}
			>
				<div className="photo-dialog-panel">
					<header className="photo-dialog-header">
						<h2 id="photo-dialog-title">
							Photo {String((selectedIndex ?? 0) + 1).padStart(2, "0")} / {total}
						</h2>
						<button
							ref={closeButtonRef}
							type="button"
							className="photo-dialog-close"
							data-static={isStatic || undefined}
							onClick={() => setExpanded(false)}
						>
							Close
							<svg
								className="photo-control-icon"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								aria-hidden="true"
							>
								<path d="m6 6 12 12M18 6 6 18" />
							</svg>
						</button>
					</header>
					{selection && <div ref={carouselNodeRef} className="photo-carousel">
						<div className="photo-carousel-track">
							{photos.map((photo, index) => <div
								key={photo.id}
								className="photo-slide"
								aria-hidden={index !== selectedIndex}
							>
								{Math.abs(index - selection.index) <= 2 && <ZoomedPhoto
									photo={photo}
									previewSrc={index === selectedIndex ? selection.previewSrc : photoUrl(photo, 768, "jpeg")}
									flightRef={index === selectedIndex ? flightRef : undefined}
									active={index === selectedIndex}
								/>}
							</div>)}
						</div>
					</div>}
					<footer
						ref={actionsRef}
						className="photo-dialog-actions"
					>
						<button
							type="button"
							data-static={isStatic || undefined}
							onClick={() => moveSelection(-1)}
							disabled={selectedIndex === 0}
						>
							<span className="photo-button-reflection" aria-hidden="true"><span /><span /></span>
							<svg
								className="photo-control-icon"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
								aria-hidden="true"
							>
								<path d="M19 12H5m7-7-7 7 7 7" />
							</svg>
							Previous
						</button>
						<button
							type="button"
							data-static={isStatic || undefined}
							onClick={() => moveSelection(1)}
							disabled={selectedIndex === total - 1}
						>
							<span className="photo-button-reflection" aria-hidden="true"><span /><span /></span>
							Next
							<svg
								className="photo-control-icon"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
								aria-hidden="true"
							>
								<path d="M5 12h14m-7-7 7 7-7 7" />
							</svg>
						</button>
					</footer>
					<p className="sr-only" role="status" aria-live="polite">
						Photo {(selectedIndex ?? 0) + 1} of {total}: {selectedPhoto.alt}
					</p>
				</div>
			</dialog>
		</>
	);
}
