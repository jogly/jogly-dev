import { latLngToCell } from "h3-js";
import { useState } from "react";
import { CityThumb } from "../components/CityThumb";
import { CityStage } from "../components/CityStage";
import { PROJECTS, WORK } from "../data";
import { hexToCharCode } from "../lib/h3Encoding";
import "../styles/anchor.css";

export function Anchor() {
	const [active, setActive] = useState<number | null>(0);
	const activeWork = active != null ? WORK[active] : null;

	return (
		<div className="v-anchor">
			<div className="stage">
				<div className="content">
					<header className="top">
						<a
							className="top-l"
							href="/resume.pdf"
							download="joseph-gilley-resume.pdf"
						>
							Résumé{" "}
							<span className="top-l-arrow" aria-hidden>
								↓
							</span>
						</a>
						<span className="top-r">jogly.dev · 2026</span>
					</header>

					<h1 className="hero-name">Joseph Gilley</h1>

					<p className="hero-desc">
						<strong>Co-founder and staff engineer</strong> with a deep interest
						in distributed systems. Built real-time billing at Uber scale,
						co-founded a YC-backed ML startup from zero to acquisition, and is a
						real human boy.
					</p>

					<div className="hero-contact">
						<a href="mailto:joe.gilley@gmail.com">joe.gilley@gmail.com</a>
						<a
							href="https://github.com/jogly"
							target="_blank"
							rel="noopener noreferrer"
						>
							github.com/jogly
						</a>
						<a
							href="https://linkedin.com/in/jogly"
							target="_blank"
							rel="noopener noreferrer"
						>
							linkedin.com/in/jogly
						</a>
						<a
							href="https://x.com/traderjoeski"
							target="_blank"
							rel="noopener noreferrer"
						>
							x.com/traderjoeski
						</a>
					</div>

					<section className="sec">
						<header className="sec-h">
							<span className="sec-num">§ 01</span>
							<h2 className="sec-title">Work</h2>
							<span className="sec-unit">fifteen yrs</span>
						</header>
						<div>
							{WORK.map((w, i) => {
								const code = w.coord
									? hexToCharCode(latLngToCell(w.coord[0], w.coord[1], 11))
									: null;
								return (
									<article
										id={w.slug}
										className="entry"
										key={w.company}
										data-entry-index={i}
									>
										<a
											className="entry-anchor"
											href={`#${w.slug}`}
											aria-label={`Link to ${w.company}`}
										>
											¶
										</a>
										<div>
											<div className="entry-co">
												{w.link ? (
													<a
														className="entry-co-link"
														href={w.link}
														target="_blank"
														rel="noopener noreferrer"
													>
														{w.company}
														<span className="entry-co-arrow" aria-hidden>
															↗
														</span>
													</a>
												) : (
													w.company
												)}
												{w.badge && (
													<span className="entry-badge">{w.badge}</span>
												)}
											</div>
											<div className="entry-role">{w.role}</div>
											<div
												className="entry-blurb"
												// biome-ignore lint/security/noDangerouslySetInnerHtml: compile-time markdown
												dangerouslySetInnerHTML={{ __html: w.html }}
											/>
										</div>
										<div className="entry-meta">
											<span className="entry-dates">{w.dates}</span>
											{w.coord && code && (
												<>
													<CityThumb lat={w.coord[0]} lng={w.coord[1]} />
													<button
														type="button"
														className={`entry-hex${active === i ? " is-active" : ""}`}
														data-entry-hex={i}
														onClick={() => setActive(active === i ? null : i)}
														aria-pressed={active === i}
														title={w.address}
													>
														{code}
													</button>
													<span className="entry-latlng">
														{w.coord[0].toFixed(5)}°, {w.coord[1].toFixed(5)}°
													</span>
												</>
											)}
										</div>
									</article>
								);
							})}
						</div>
					</section>

					<section className="sec">
						<header className="sec-h">
							<span className="sec-num">§ 02</span>
							<h2 className="sec-title">Projects</h2>
							<span className="sec-unit">on the web</span>
						</header>
						<div>
							{PROJECTS.map((p, i) => (
								<a
									className="project"
									key={p.name}
									href={p.href}
									target="_blank"
									rel="noopener noreferrer"
								>
									<span className="project-idx">
										{String(i + 1).padStart(2, "0")}
									</span>
									<span className="project-name">{p.name}</span>
									<span className="project-desc">{p.desc}</span>
								</a>
							))}
						</div>
					</section>
				</div>

				<aside className="anchor" aria-hidden="true">
					{activeWork?.coord && (
						<CityStage
							lat={activeWork.coord[0]}
							lng={activeWork.coord[1]}
							address={activeWork.address}
						/>
					)}
				</aside>
			</div>
		</div>
	);
}
