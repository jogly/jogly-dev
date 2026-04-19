import { WORK, PROJECTS } from '../data'
import { VariationNav } from '../components/VariationNav'
import '../styles/watermark.css'

export function Watermark() {
  return (
    <div className="v-watermark">
      <div className="mark" aria-hidden="true">
        <span className="mark-letter">J</span>
      </div>

      <div className="wrap">
        <header className="top">
          <span className="top-l">Specimen · Watermark</span>
          <span className="top-c">J · G</span>
          <span className="top-r">jogly.dev · 2026</span>
        </header>

        <section className="hero">
          <div className="hero-eye">— Aesthetic Coder —</div>
          <h1 className="hero-name">Joseph Gilley</h1>
          <p className="hero-desc">
            <strong>Co-founder and staff engineer</strong> with a deep interest in
            distributed systems. Built real-time billing at Uber scale, shipped a
            YC-backed ML startup from zero to acquisition, and led architecture
            reviews that turned months of launch time into days.
          </p>
          <div className="hint">hover to collapse optical size</div>
        </section>

        <section className="sec">
          <header className="sec-h">
            <span className="sec-num">§ 01</span>
            <h2 className="sec-title">Work</h2>
            <span className="sec-unit">fifteen yrs</span>
          </header>
          <div className="sec-body">
            {WORK.map((w) => (
              <article className="entry" key={w.company}>
                <div>
                  <div className="entry-co">
                    {w.company}
                    {w.badge && <span className="entry-badge">{w.badge}</span>}
                  </div>
                  <div className="entry-role">{w.role}</div>
                  <p className="entry-blurb">{w.blurb}</p>
                </div>
                <span className="entry-dates">{w.dates}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="sec">
          <header className="sec-h">
            <span className="sec-num">§ 02</span>
            <h2 className="sec-title">Projects</h2>
            <span className="sec-unit">on the web</span>
          </header>
          <div className="sec-body">
            {PROJECTS.map((p, i) => (
              <a className="project" key={p.name} href={p.href} target="_blank" rel="noopener noreferrer">
                <span className="project-idx">{String(i + 1).padStart(2, '0')}</span>
                <span className="project-name">{p.name}</span>
                <span className="project-desc">{p.desc}</span>
              </a>
            ))}
          </div>
        </section>

        <section className="sec">
          <header className="sec-h">
            <span className="sec-num">§ 03</span>
            <h2 className="sec-title">Connect</h2>
            <span className="sec-unit">by wire</span>
          </header>
          <div className="sec-body">
            <div className="connect">
              <div className="connect-row">
                <span className="connect-k">Email</span>
                <a className="connect-v" href="mailto:joe.gilley@gmail.com">joe.gilley@gmail.com</a>
              </div>
              <div className="connect-row">
                <span className="connect-k">GitHub</span>
                <a className="connect-v" href="https://github.com/jogly" target="_blank" rel="noopener noreferrer">github.com/jogly</a>
              </div>
              <div className="connect-row">
                <span className="connect-k">LinkedIn</span>
                <a className="connect-v" href="https://linkedin.com/in/jogly" target="_blank" rel="noopener noreferrer">linkedin.com/in/jogly</a>
              </div>
            </div>
          </div>
        </section>
      </div>

      <VariationNav />
    </div>
  )
}
