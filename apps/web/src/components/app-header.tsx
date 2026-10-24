"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logout } from "../lib/api";
import { useSession } from "../hooks/use-session";
import {
  getNavigationContext,
  type NavigationContext,
} from "../services/navigation";

const projectViews = [
  { label: "Board", suffix: "" },
  { label: "Dashboard", suffix: "/dashboard" },
  { label: "Sprints", suffix: "/sprints" },
] as const;

export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, error, signedOutReason, refresh } = useSession();
  const [open, setOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const account = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const mobileMenuTrigger = useRef<HTMLButtonElement>(null);
  const mobileMenuPanel = useRef<HTMLDivElement>(null);
  const [navigation, setNavigation] = useState<{
    key: string;
    context: NavigationContext;
    error?: string;
  } | null>(null);
  const [navigationRetry, setNavigationRetry] = useState(0);
  const navigationKey = `${user?.id ?? ""}:${pathname}`;
  const currentNavigation =
    navigation?.key === navigationKey ? navigation : null;
  const { projectId, workspaceId } = currentNavigation?.context ?? {};
  const contextual = /^\/(projects|tasks|workspaces)\/[^/]+/.test(pathname);

  useEffect(() => {
    if (!user || !contextual) return;
    const controller = new AbortController();
    void getNavigationContext(pathname, controller.signal)
      .then((context) => {
        if (!controller.signal.aborted) {
          setNavigation({ key: navigationKey, context });
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setNavigation({
            key: navigationKey,
            context: {},
            error:
              cause instanceof Error
                ? cause.message
                : "Navigation unavailable.",
          });
        }
      });
    return () => controller.abort();
  }, [pathname, user, contextual, navigationKey, navigationRetry]);

  useEffect(() => {
    function dismiss(event: PointerEvent) {
      const target = event.target as Node;
      if (!account.current?.contains(target)) setOpen(false);
      if (
        !mobileMenuPanel.current?.contains(target) &&
        !mobileMenuTrigger.current?.contains(target)
      ) {
        setMobileMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);

  async function signOut() {
    setBusy(true);
    setLogoutError(null);
    try {
      await logout();
      setOpen(false);
      router.replace("/login");
      router.refresh();
    } catch (cause) {
      setLogoutError(
        cause instanceof Error
          ? cause.message
          : "Could not sign out. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  function toggleMobileMenu() {
    setOpen(false);
    setMobileMenuOpen((value) => !value);
  }

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  function retryNavigation() {
    setNavigation(null);
    setNavigationRetry((value) => value + 1);
  }

  function isProjectViewActive(suffix: string) {
    if (!projectId) return false;
    const href = `/projects/${projectId}${suffix}`;
    return pathname === href || (!suffix && pathname === `${href}/board`);
  }

  function renderNavigationStatus() {
    if (!currentNavigation) {
      return (
        <span role="status" className="tf-status-message">
          Loading navigation…
        </span>
      );
    }
    if (currentNavigation.error) {
      return (
        <button
          type="button"
          className="tf-status-message is-error"
          onClick={retryNavigation}
        >
          Navigation unavailable · Retry
        </button>
      );
    }
    return null;
  }

  function renderMobileProjectViews() {
    if (!user || !contextual) return null;

    return (
      <nav aria-label="Project views" className="tf-mobile-context">
        <p className="tf-context-label">Project views</p>
        {renderNavigationStatus()}
        {(workspaceId || projectId) && (
          <div className="tf-mobile-context-grid">
            {workspaceId && (
              <Link
                href={`/workspaces/${workspaceId}`}
                aria-current={
                  pathname === `/workspaces/${workspaceId}` ? "page" : undefined
                }
                onClick={closeMobileMenu}
                className={`tf-mobile-nav-link ${pathname === `/workspaces/${workspaceId}` ? "is-active" : ""}`}
              >
                Workspace
              </Link>
            )}
            {projectId &&
              projectViews.map(({ label, suffix }) => (
                <Link
                  key={label}
                  href={`/projects/${projectId}${suffix}`}
                  aria-current={
                    isProjectViewActive(suffix) ? "page" : undefined
                  }
                  onClick={closeMobileMenu}
                  className={`tf-mobile-nav-link ${isProjectViewActive(suffix) ? "is-active" : ""}`}
                >
                  {label}
                </Link>
              ))}
          </div>
        )}
      </nav>
    );
  }

  return (
    <header className="tf-site-header">
      <div className="tf-header-inner">
        <Link href="/" aria-label="TaskForge home" className="tf-brand">
          <span aria-hidden="true" className="tf-brand-mark">
            TF
          </span>
          <span className="tf-brand-name">TaskForge</span>
        </Link>

        <div className="tf-header-actions">
          <button
            ref={mobileMenuTrigger}
            type="button"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation-panel"
            aria-label={
              mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"
            }
            onClick={toggleMobileMenu}
            className="tf-mobile-menu-toggle"
          >
            <span
              aria-hidden="true"
              className={`tf-menu-icon ${mobileMenuOpen ? "is-open" : ""}`}
            >
              <span />
            </span>
          </button>

          {error && !user ? (
            <button
              type="button"
              onClick={() => void refresh()}
              className="tf-nav-link"
            >
              Session unavailable · Retry
            </button>
          ) : user ? (
            <div
              ref={account}
              className="tf-account"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setOpen(false);
                  trigger.current?.focus();
                }
              }}
            >
              <button
                ref={trigger}
                type="button"
                aria-expanded={open}
                aria-controls="account-panel"
                aria-label={`${user.name} ${user.email}`}
                onClick={() => {
                  setMobileMenuOpen(false);
                  setOpen(!open);
                }}
                className="tf-account-trigger"
              >
                <span aria-hidden="true" className="tf-avatar">
                  {(user.name.trim() || user.email).slice(0, 1).toUpperCase()}
                </span>
                <span className="tf-account-copy">
                  <span className="tf-account-name">{user.name}</span>
                  <span className="tf-account-email">{user.email}</span>
                </span>
              </button>

              {open && (
                <div id="account-panel" className="tf-account-panel">
                  <p className="tf-account-summary">
                    Signed in as {user.email}
                  </p>
                  {error && (
                    <button
                      type="button"
                      onClick={() => void refresh().catch(() => undefined)}
                      className="tf-status-message"
                    >
                      {error} Retry
                    </button>
                  )}
                  {logoutError && (
                    <p role="alert" className="tf-status-message is-error">
                      {logoutError}
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void signOut()}
                    className="tf-account-action"
                  >
                    {busy ? "Signing out…" : "Log out"}
                  </button>
                </div>
              )}
            </div>
          ) : loading ? (
            <span role="status" className="tf-status-message">
              Loading account…
            </span>
          ) : (
            <div className="flex items-center gap-1 sm:gap-2">
              {signedOutReason === "expired" && (
                <span
                  role="status"
                  className="hidden text-xs text-slate-500 sm:inline"
                >
                  Your session is missing or has expired. Please sign in.
                </span>
              )}
              <Link href="/login" className="tf-nav-link whitespace-nowrap">
                Sign in
              </Link>
              <Link
                href="/register"
                className="tf-nav-link is-active whitespace-nowrap"
              >
                Create account
              </Link>
            </div>
          )}
        </div>
      </div>

      {mobileMenuOpen && (
        <div
          ref={mobileMenuPanel}
          id="mobile-navigation-panel"
          className="tf-mobile-panel md:hidden"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setMobileMenuOpen(false);
              mobileMenuTrigger.current?.focus();
            }
          }}
        >
          {renderMobileProjectViews()}
        </div>
      )}

      {user && contextual && (
        <nav aria-label="Project views" className="tf-context-nav">
          {renderNavigationStatus()}
          {workspaceId && (
            <Link
              href={`/workspaces/${workspaceId}`}
              aria-current={
                pathname === `/workspaces/${workspaceId}` ? "page" : undefined
              }
              className={`tf-context-link ${pathname === `/workspaces/${workspaceId}` ? "is-active" : ""}`}
            >
              Workspace
            </Link>
          )}
          {projectId &&
            projectViews.map(({ label, suffix }) => (
              <Link
                key={label}
                href={`/projects/${projectId}${suffix}`}
                aria-current={isProjectViewActive(suffix) ? "page" : undefined}
                className={`tf-context-link ${isProjectViewActive(suffix) ? "is-active" : ""}`}
              >
                {label}
              </Link>
            ))}
        </nav>
      )}
    </header>
  );
}
