"use client";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { sessionStore } from "../lib/session-store";

export function useSession() {
  const pathname = usePathname();
  const session = useSyncExternalStore(
    sessionStore.subscribe,
    sessionStore.getSnapshot,
    sessionStore.getServerSnapshot,
  );
  useEffect(() => {
    void sessionStore.refresh().catch(() => undefined);
  }, [pathname]);
  return { ...session, refresh: sessionStore.refresh };
}
