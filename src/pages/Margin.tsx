import { WORK, PROJECTS } from '../data'
import { VariationNav } from '../components/VariationNav'
import '../styles/margin.css'

export function Margin() {
  return (
    <div className="v-margin">
      <div className="page">
        <header className="top">
          <span className="top-l">Specimen · Margin</span>
          <span className="top-c">Joseph · Gilley</span>
          <span className="top-r">jogly.dev · MMXXVI</span>
        </header>

        <main>
          <div className="hero-label">
            <span>Character</span>
            <span className="accent">Italic · WONK</span>
            <span>opsz 144</span>
          </div>

          <h1 className="hero-name">Joseph Gilley</h1>

          <p className="hero-desc">
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
        </main>

        <aside className="side" aria-label="specimen metadata">
          <section>
            <div className="side-h">Size Ramp · italic</div>
            <div className="ramp">
              <div className="ramp-row"><span className="ramp-k">144 pt</span><span className="ramp-v s-144">Jj</span></div>
              <div className="ramp-row"><span className="ramp-k">96 pt</span><span className="ramp-v s-96">Jj</span></div>
              <div className="ramp-row"><span className="ramp-k">48 pt</span><span className="ramp-v s-48">Joseph</span></div>
              <div className="ramp-row"><span className="ramp-k">24 pt</span><span className="ramp-v s-24">Joseph Gilley</span></div>
              <div className="ramp-row"><span className="ramp-k">12 pt</span><span className="ramp-v s-12">Joseph Gilley · jogly.dev</span></div>
            </div>
          </section>

          <section>
            <div className="side-h">Axis Readout</div>
            <div className="axis">
              <div className="axis-row"><span className="axis-k">opsz</span><span className="axis-bar" style={{ ['--p' as any]: '96%' }} /><span className="axis-v">144</span></div>
              <div className="axis-row"><span className="axis-k">wght</span><span className="axis-bar" style={{ ['--p' as any]: '22%' }} /><span className="axis-v">300</span></div>
              <div className="axis-row"><span className="axis-k">WONK</span><span className="axis-bar" style={{ ['--p' as any]: '100%' }} /><span className="axis-v">1</span></div>
              <div className="axis-row"><span className="axis-k">SOFT</span><span className="axis-bar" style={{ ['--p' as any]: '0%' }} /><span className="axis-v">0</span></div>
              <div className="axis-row"><span className="axis-k">ital</span><span className="axis-bar" style={{ ['--p' as any]: '100%' }} /><span className="axis-v">1</span></div>
            </div>
          </section>

          <section>
            <div className="side-h">Pangram</div>
            <p className="pangram">Jovial coders query the wax-faced zenith, packing six gilded boxes by moonlight.</p>
          </section>

          <section>
            <div className="side-h">Character Set</div>
            <p className="chars">A B C D E F G H I J K L M N O P Q R S T U V W X Y Z</p>
            <p className="chars chars-lo">a b c d e f g h i j k l m n o p q r s t u v w x y z</p>
            <p className="chars">0 1 2 3 4 5 6 7 8 9 &amp; ·</p>
          </section>

          <div className="side-foot">
            <span>Set in Fraunces</span>
            <span>DM Mono</span>
          </div>
        </aside>
      </div>

      <VariationNav />
    </div>
  )
}
