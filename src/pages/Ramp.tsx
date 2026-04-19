import { WORK, PROJECTS } from '../data'
import { VariationNav } from '../components/VariationNav'
import '../styles/ramp.css'

export function Ramp() {
  return (
    <div className="v-ramp">
      <div className="wrap">
        <header className="top">
          <span className="top-l">Specimen · Ramp</span>
          <span className="top-c">Fraunces · ital · WONK</span>
          <span className="top-r">jogly.dev · 2026</span>
        </header>

        <section aria-label="type ramp">
          <div className="ramp-row">
            <div className="ramp-meta">
              <span className="ramp-pt">240</span>
              <span className="ramp-axis accent">italic</span>
              <span className="ramp-axis">opsz 144</span>
              <span className="ramp-axis">WONK 1</span>
            </div>
            <div className="ramp-sample r-240">Joseph</div>
          </div>

          <div className="ramp-row">
            <div className="ramp-meta">
              <span className="ramp-pt">144</span>
              <span className="ramp-axis">roman</span>
              <span className="ramp-axis">wght 700</span>
              <span className="ramp-axis">WONK 0</span>
            </div>
            <div className="ramp-sample r-144">Gilley.</div>
          </div>

          <div className="ramp-row">
            <div className="ramp-meta">
              <span className="ramp-pt">96</span>
              <span className="ramp-axis accent">italic</span>
              <span className="ramp-axis">opsz 96</span>
              <span className="ramp-axis">SOFT 100</span>
            </div>
            <div className="ramp-sample r-96">aesthetic coder</div>
          </div>

          <div className="ramp-row">
            <div className="ramp-meta">
              <span className="ramp-pt">48</span>
              <span className="ramp-axis">roman</span>
              <span className="ramp-axis">opsz 30</span>
              <span className="ramp-axis">wght 300</span>
            </div>
            <div className="ramp-sample r-48">distributed systems · billing · bandits</div>
          </div>

          <div className="ramp-row">
            <div className="ramp-meta">
              <span className="ramp-pt">24</span>
              <span className="ramp-axis accent">italic</span>
              <span className="ramp-axis">opsz 14</span>
              <span className="ramp-axis">wght 500</span>
            </div>
            <div className="ramp-sample r-24">Uber · Bandit ML (YC S20) · Silo · AngelList</div>
          </div>

          <div className="ramp-row">
            <div className="ramp-meta">
              <span className="ramp-pt">12</span>
              <span className="ramp-axis">caption</span>
              <span className="ramp-axis">DM Mono</span>
            </div>
            <div className="ramp-sample r-12">jogly.dev · San Francisco · MMXXVI</div>
          </div>
        </section>

        <div className="body">
          <p className="lede">
            A type specimen is a demonstration. <em>These letterforms are the page.</em>
          </p>
          <p className="body-p">
            <strong>Co-founder and staff engineer</strong> with a deep interest in
            distributed systems. Built real-time billing at Uber scale, shipped a
            YC-backed ML startup from zero to acquisition, and led architecture
            reviews that turned months of launch time into days.
          </p>

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
        </div>
      </div>

      <VariationNav />
    </div>
  )
}
