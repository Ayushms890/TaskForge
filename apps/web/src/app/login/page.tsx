import { AuthForm } from "../../components/auth-form";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-[calc(100dvh-73px)] items-center overflow-hidden bg-slate-950 px-4 py-6 sm:px-6 sm:py-10 lg:py-12">
      <div
        aria-hidden="true"
        className="absolute -left-24 top-12 h-72 w-72 rounded-full bg-indigo-500/30 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-cyan-400/20 blur-3xl"
      />
      <div className="relative mx-auto grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/15 bg-slate-100 shadow-2xl shadow-indigo-950/40 lg:grid-cols-[1.02fr_0.98fr]">
        <aside className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-700 to-violet-800 p-10 text-white lg:flex lg:flex-col lg:justify-between lg:p-14">
          <div
            aria-hidden="true"
            className="absolute -right-24 -top-24 h-72 w-72 rounded-full border-[32px] border-white/10"
          />
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-bold tracking-tight">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white text-xs font-black text-indigo-700">
                T
              </span>
              TaskForge
            </div>
            <h2 className="mt-20 max-w-md text-5xl font-bold leading-[1.05] tracking-tight">
              Turn busy work into clear momentum.
            </h2>
            <p className="mt-6 max-w-sm text-lg leading-8 text-indigo-100">
              Bring projects, ownership, and progress into one focused
              workspace.
            </p>
          </div>
          <p className="text-sm font-medium text-indigo-200">
            Plan clearly. Ship confidently.
          </p>
        </aside>
        <section className="bg-slate-50 p-6 sm:p-10 lg:p-14">
          <div className="mb-10 lg:hidden">
            <div className="inline-flex items-center gap-2 text-sm font-bold tracking-tight text-slate-950">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-black text-white">
                T
              </span>
              TaskForge
            </div>
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">
            Your workspace awaits
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Welcome back
          </h1>
          <p className="mt-3 text-slate-600">
            Sign in to continue to your workspace.
          </p>
          <div className="mt-8 rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm sm:p-6">
            <AuthForm mode="login" />
          </div>
        </section>
      </div>
    </main>
  );
}
