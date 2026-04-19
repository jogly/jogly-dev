import { WORK, PROJECTS } from '../data'
import { VariationNav } from '../components/VariationNav'
import '../styles/specimen.css'

export function Specimen() {
  return (
    <div className="v-specimen">
      <div className="big" aria-hidden="true">
        <span className="big-letter">J</span>
      </div>

      <div className="wrap">
        <header className="top">
          <span className="top-l">Type Specimen № 07</span>
          <span className="top-c">Joseph · Gilley</span>
          <span className="top-r">jogly.dev · 2026</span>
        </header>

        <section className="hero">
          <div className="hero-label">
            <span>Character</span>
            <span className="hero-label-accent">Italic · WONK</span>
            <span>opsz 144</span>
          </div>
          <h1 className="hero-name">Joseph Gilley</h1>
          <p className="hero-desc">
            <strong>Co-founder and staff engineer</strong> with a deep interest in
            distributed systems. Built real-time billing at Uber scale, shipped a
            YC-backed ML startup from zero to acquisition, and led architecture
            reviews that turned months of launch time into days.
          </p>
        </section>

        <section className="specimen">
          <div className="specimen-h">Specimen · Vital Statistics</div>
          <div className="specimen-row"><span className="specimen-k">ROLE</span><span className="specimen-v">Staff engineer, builder</span></div>
          <div className="specimen-row"><span className="specimen-k">FOCUS</span><span className="specimen-v">Distributed systems</span></div>
          <div className="specimen-row"><span className="specimen-k">EST.</span><span className="specimen-v">Uber · Bandit · Silo · AngelList</span></div>
          <div className="specimen-row"><span className="specimen-k">SCHOOL</span><span className="specimen-v">Binghamton CS Eng. '11</span></div>
          <div className="specimen-row"><span className="specimen-k">CITY</span><span className="specimen-v">San Francisco, California</span></div>
        </section>

        <section className="sec">
          <header className="sec-h">
            <span className="sec-num">§ 01</span>
            <h2 className="sec-title">Work</h2>
            <span className="sec-unit">fifteen yrs</span>
          </header>
          <div>
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
          <div>
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
        </section>

        <VariationNav />
      </div>
    </div>
  )
}
