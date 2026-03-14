import Link from 'next/link'

const platformLinks = [
  { href: '/matches', label: 'Live Matches' },
  { href: '/matches', label: 'Scorecards' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/teams', label: 'Teams' },
  { href: '/leaderboard', label: 'Players' },
]

const aboutLinks = [
  { href: '/', label: 'About CrickScore' },
  { href: '/', label: 'Features' },
  { href: '/profile', label: 'Contact' },
]

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[linear-gradient(180deg,rgba(8,10,18,0.98),rgba(6,8,16,1))]">
      <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-10 sm:px-6 lg:px-8 lg:pb-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <section>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
              Platform
            </h3>
            <ul className="mt-4 space-y-2.5">
              {platformLinks.map(link => (
                <li key={`${link.href}-${link.label}`}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-300 transition hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
              About
            </h3>
            <ul className="mt-4 space-y-2.5">
              {aboutLinks.map(link => (
                <li key={`${link.href}-${link.label}`}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-300 transition hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
              Developer
            </h3>
            <div className="mt-4 space-y-2.5">
              <p className="text-sm text-slate-300">
                Developed by:{' '}
                <span className="font-semibold text-white">MThe001</span>
              </p>
              <a
                href="mailto:mtheredwanulhaque@gmail.com"
                className="inline-flex text-sm text-slate-300 transition hover:text-white"
              >
                mtheredwanulhaque@gmail.com
              </a>
            </div>
          </section>
        </div>

        <div className="mt-8 border-t border-white/10 pt-4">
          <p className="text-center text-xs text-slate-400">
            © 2026 CrickScore. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
