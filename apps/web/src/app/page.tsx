import Link from "next/link";

export default function HomePage() {
  return (
    <main className="relative overflow-hidden bg-slate-950 px-4 py-10 text-white sm:px-6 sm:py-14 lg:py-20">
      <div
        aria-hidden="true"
        className="tf-hero-orb tf-hero-orb--primary absolute -left-32 top-10 h-80 w-80 rounded-full bg-indigo-500/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="tf-hero-orb tf-hero-orb--secondary absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-cyan-400/15 blur-3xl"
      />
      <div aria-hidden="true" className="tf-hero-grid absolute inset-0" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <section className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-indigo-300">
            The focused workspace for teams
          </p>
          <h1 className="mt-5 max-w-3xl text-5xl font-bold tracking-[-0.045em] sm:text-6xl lg:text-7xl">
            Build work that moves forward.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
            Plan projects, organize tasks, and keep every sprint moving from one
            calm, focused workspace.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/workspaces"
              className="rounded-xl bg-white px-5 py-3 font-semibold text-indigo-950 shadow-lg shadow-indigo-950/30 transition hover:bg-indigo-50"
            >
              Open workspaces
            </Link>
            <Link
              href="/register"
              className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 font-semibold text-white transition hover:bg-white/15"
            >
              Create an account
            </Link>
          </div>
          <div className="mt-10 grid max-w-2xl gap-3 sm:mt-12 sm:grid-cols-3">
            {[
              ["01", "Workspaces", "A shared home for every team."],
              ["02", "Boards", "Make priorities visible."],
              ["03", "Sprints", "Turn focus into momentum."],
            ].map(([number, title, text]) => (
              <div
                key={number}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
              >
                <p className="text-xs font-bold text-indigo-300">{number}</p>
                <p className="mt-3 font-semibold">{title}</p>
                <p className="mt-1 text-sm leading-5 text-slate-400">{text}</p>
              </div>
            ))}
          </div>
        </section>
        <section
          aria-label="TaskForge preview"
          className="rounded-[2rem] border border-white/15 bg-white/[0.08] p-2.5 shadow-2xl shadow-indigo-950/40 backdrop-blur-sm sm:p-3"
        >
          <div className="rounded-[1.5rem] bg-slate-100 p-4 text-slate-900 shadow-inner sm:p-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">
                  Project board
                </p>
                <p className="mt-1 text-lg font-bold">Product launch</p>
              </div>
              <span className="rounded-lg bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">
                3 active
              </span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                [
                  "To do",
                  "bg-slate-200",
                  ["Define launch scope", "Review onboarding"],
                ],
                [
                  "In progress",
                  "bg-indigo-100",
                  ["Build dashboard", "Write release notes"],
                ],
                [
                  "Done",
                  "bg-emerald-100",
                  ["Set up workspace", "Create project"],
                ],
              ].map(([title, surface, items]) => (
                <div
                  key={String(title)}
                  className={`rounded-xl p-3 ${surface}`}
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>{title}</span>
                    <span>{(items as string[]).length}</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {(items as string[]).map((item) => (
                      <div
                        key={item}
                        className="rounded-lg bg-white p-3 text-xs font-semibold shadow-sm"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
      <section className="relative mx-auto mt-14 grid max-w-7xl gap-3 border-t border-white/10 pt-6 text-sm text-slate-400 sm:grid-cols-3 lg:mt-20">
        <p>
          <span className="font-semibold text-white">One calm home.</span> Keep
          the team aligned without adding process.
        </p>
        <p>
          <span className="font-semibold text-white">Visible progress.</span>{" "}
          Make priorities and ownership easy to scan.
        </p>
        <p>
          <span className="font-semibold text-white">Built for momentum.</span>{" "}
          Move from idea to done with less friction.
        </p>
      </section>
    </main>
  );
}
