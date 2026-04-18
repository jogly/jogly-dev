const WORK = [
  {
    company: 'AngelList',
    role: 'Software Engineer',
    dates: '2025 — 26',
    badge: null,
  },
  {
    company: 'Silo',
    role: 'Lead Architect',
    dates: '2022 — 23',
    badge: null,
  },
  {
    company: 'Bandit ML',
    role: 'Co-Founder',
    dates: '2020 — 22',
    badge: 'YC S20 · acq.',
  },
  {
    company: 'Uber',
    role: 'Staff Software Engineer',
    dates: '2014 — 20',
    badge: null,
  },
  {
    company: 'IBM Global Business Services',
    role: 'Systems Engineer',
    dates: '2011 — 14',
    badge: null,
  },
]

const PROJECTS = [
  {
    name: 'h3-go',
    desc: 'hexagonal geospatial grid · go',
    href: 'https://github.com/uber/h3-go',
  },
  {
    name: 'slashtable',
    desc: 'discord slash command platform',
    href: 'https://github.com/jogly/slashtable-web',
  },
  {
    name: 'oar',
    desc: 'oauth2 callback re-router · go',
    href: 'https://github.com/jogly/oar',
  },
  {
    name: 'gofig',
    desc: 'composable config for go',
    href: 'https://github.com/jogly/gofig',
  },
  {
    name: 'mktoast',
    desc: 'toast notification toolkit',
    href: 'https://github.com/jogly/mktoast-web',
  },
]

export function Home() {
  return (
    <div className="page">
      <header className="nav">
        <span className="nav-mark">JG</span>
        <nav className="nav-links">
          <a href="#work">Work</a>
          <a href="#projects">Projects</a>
          <a href="#connect">Connect</a>
        </nav>
      </header>

      <main>
        <section className="hero">
          <p className="hero-eyebrow">jogly.dev — San Francisco, CA</p>
          <h1 className="hero-name">
            Joseph<br />Gilley<span className="hero-cursor" aria-hidden="true" />
          </h1>
          <div className="hero-prompt">
            <span className="hero-prompt-char">$</span>
            <span className="hero-tagline">aesthetic coder · ex-YC S20 · distributed systems</span>
          </div>
          <div className="hero-meta">
            <span className="hero-meta-item">creating for creation's sake</span>
            <span className="hero-meta-sep">/</span>
            <span className="hero-meta-item">Binghamton CS Eng. '11</span>
          </div>
        </section>

        <section className="section" id="about">
          <p className="section-label">§ 01 — About</p>
          <p className="about-text">
            Co-founder and team lead with a deep interest in{' '}
            <em>distributed systems</em>. I've built real-time billing
            platforms at Uber scale, shipped a YC-backed ML startup from zero
            to acquisition, and led architecture working groups that turned
            months of launch time into days. I care about things that are{' '}
            <em>well-designed and fast</em>.
          </p>
        </section>

        <section className="section" id="work">
          <p className="section-label">§ 02 — Work</p>
          <div>
            {WORK.map((w) => (
              <div className="entry" key={w.company}>
                <div className="entry-left">
                  <span className="entry-company">
                    {w.company}
                    {w.badge && (
                      <span className="entry-badge">{w.badge}</span>
                    )}
                  </span>
                  <span className="entry-role">{w.role}</span>
                </div>
                <span className="entry-dates">{w.dates}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="section" id="projects">
          <p className="section-label">§ 03 — Projects</p>
          <div>
            {PROJECTS.map((p) => (
              <a
                className="project"
                key={p.name}
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="project-arrow">→</span>
                <span className="project-name">{p.name}</span>
                <span className="project-dots" aria-hidden="true" />
                <span className="project-desc">{p.desc}</span>
              </a>
            ))}
          </div>
        </section>

        <section className="section" id="connect">
          <p className="section-label">§ 04 — Connect</p>
          <div className="connect-grid">
            <div className="connect-item">
              <span className="connect-label">Email</span>
              <a className="connect-value" href="mailto:joe.gilley@gmail.com">
                joe.gilley@gmail.com
              </a>
            </div>
            <div className="connect-item">
              <span className="connect-label">GitHub</span>
              <a
                className="connect-value"
                href="https://github.com/jogly"
                target="_blank"
                rel="noopener noreferrer"
              >
                github.com/jogly
              </a>
            </div>
            <div className="connect-item">
              <span className="connect-label">LinkedIn</span>
              <a
                className="connect-value"
                href="https://linkedin.com/in/jogly"
                target="_blank"
                rel="noopener noreferrer"
              >
                linkedin.com/in/jogly
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <span>jogly.dev</span>
        <span>© {new Date().getFullYear()}</span>
      </footer>
    </div>
  )
}
