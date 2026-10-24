"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { postAuth, type CurrentUser } from "../lib/api";
import { sessionStore } from "../lib/session-store";

type AuthFormProps = { mode: "login" | "register" };

export function AuthForm({ mode }: AuthFormProps) {
  const isRegister = mode === "register";
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await postAuth<{ user: CurrentUser }>(
        isRegister ? "/auth/register" : "/auth/login",
        {
          ...(isRegister ? { name } : {}),
          email,
          password,
        },
      );
      sessionStore.authenticated(result.data?.user);
      router.replace("/workspaces");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Something went wrong.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-busy={isSubmitting}
      className="space-y-6"
    >
      <fieldset disabled={isSubmitting} className="space-y-5">
        {isRegister && (
          <label className="block text-sm font-semibold text-slate-700">
            Name
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 block w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-3 outline-none ring-indigo-500 transition placeholder:text-slate-400 hover:bg-white focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              autoComplete="name"
            />
          </label>
        )}
        <label className="block text-sm font-semibold text-slate-700">
          Email
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-3 outline-none ring-indigo-500 transition placeholder:text-slate-400 hover:bg-white focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
            autoComplete="email"
          />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Password
          <input
            required
            minLength={8}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-3 outline-none ring-indigo-500 transition placeholder:text-slate-400 hover:bg-white focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
            autoComplete={isRegister ? "new-password" : "current-password"}
          />
        </label>
        {isRegister && (
          <p className="text-xs text-slate-500">
            Use at least 8 characters for your password.
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-700"
          >
            {error}
          </p>
        )}
        <button
          disabled={isSubmitting}
          className="group w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white shadow-lg shadow-slate-300 transition hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-200 focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
        >
          <span>
            {isSubmitting
              ? isRegister
                ? "Creating account…"
                : "Signing in…"
              : isRegister
                ? "Create account"
                : "Sign in"}
          </span>
          {!isSubmitting && (
            <span
              aria-hidden="true"
              className="ml-2 transition-transform group-hover:translate-x-0.5"
            >
              →
            </span>
          )}
        </button>
      </fieldset>
    </form>
  );
}
