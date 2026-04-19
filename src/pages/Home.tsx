import { WORK, PROJECTS } from '../data'
import { VariationNav } from '../components/VariationNav'

export function Home() {
  return (
    <div className="page">
      <header className="nav">
        <span className="nav-mark">JG</span>
        <span className="nav-domain">jogly.dev</span>
      </header>

      <main>
        <section className="hero">
          <h1 className="hero-name">
            Joseph<br />Gilley
          </h1>
          <p className="hero-sub">
            <span>Aesthetic Coder</span>
            <span className="hero-sep">·</span>
            <span>Ex-YC S20</span>
            <span className="hero-sep">·</span>
            <span>Distributed Systems</span>
            <span className="hero-sep">·</span>
            <span>San Francisco</span>
          </p>
        </section>

        <section className="section" id="about">
          <div className="section-label">
            <span className="section-num">00</span>
            <span className="section-title">About</span>
          </div>
          <p className="about">
            Co-founder and team lead with a deep interest in distributed systems.
            Built real-time billing at Uber scale, shipped a YC-backed ML startup
            from zero to acquisition, and led architecture reviews that turned months
            of launch time into days. Creating for creation's sake.
          </p>
        </section>

        <section className="section" id="work">
          <div className="section-label">
            <span className="section-num">01</span>
            <span className="section-title">Work</span>
          </div>
          <div>
            {WORK.map((w) => (
              <div className="entry" key={w.company}>
                <div>
                  <div className="entry-company">
                    {w.company}
                    {w.badge && <span className="entry-badge">{w.badge}</span>}
                  </div>
                  <div className="entry-role">{w.role}</div>
                  <p className="entry-blurb">{w.blurb}</p>
                </div>
                <span className="entry-dates">{w.dates}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="section" id="projects">
          <div className="section-label">
            <span className="section-num">02</span>
            <span className="section-title">Projects</span>
          </div>
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

        <section className="section" id="connect">
          <div className="section-label">
            <span className="section-num">03</span>
            <span className="section-title">Connect</span>
          </div>
          <div className="connect">
            <div className="connect-row">
              <span className="connect-key">Email</span>
              <a className="connect-val" href="mailto:joe.gilley@gmail.com">joe.gilley@gmail.com</a>
            </div>
            <div className="connect-row">
              <span className="connect-key">GitHub</span>
              <a className="connect-val" href="https://github.com/jogly" target="_blank" rel="noopener noreferrer">github.com/jogly</a>
            </div>
            <div className="connect-row">
              <span className="connect-key">LinkedIn</span>
              <a className="connect-val" href="https://linkedin.com/in/jogly" target="_blank" rel="noopener noreferrer">linkedin.com/in/jogly</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <span>Joseph Gilley</span>
        <span>© {new Date().getFullYear()}</span>
      </footer>
      <VariationNav />
    </div>
  )
}
