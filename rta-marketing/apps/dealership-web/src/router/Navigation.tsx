import { createContext, useContext, useEffect, useMemo, useState, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from "react";

interface NavigationValue { path: string; navigate(path: string, options?: { replace?: boolean }): void }
const NavigationContext = createContext<NavigationValue | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
  const value = useMemo<NavigationValue>(() => ({
    path,
    navigate(nextPath, options) {
      window.history[options?.replace ? "replaceState" : "pushState"]({}, "", nextPath);
      setPath(nextPath);
      window.scrollTo({ top: 0, behavior: "instant" });
    },
  }), [path]);
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation(): NavigationValue {
  const value = useContext(NavigationContext);
  if (!value) throw new Error("useNavigation must be used inside NavigationProvider");
  return value;
}

export function Link({ to, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  const { navigate } = useNavigation();
  function follow(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(to);
  }
  return <a {...props} href={to} onClick={follow} />;
}

export function NavLink({ to, className, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  const { path } = useNavigation();
  const classes = [typeof className === "string" ? className : "", path === to ? "active" : ""].filter(Boolean).join(" ");
  return <Link {...props} to={to} className={classes} aria-current={path === to ? "page" : undefined} />;
}

export function Redirect({ to }: { to: string }) {
  const { navigate } = useNavigation();
  useEffect(() => navigate(to, { replace: true }), [navigate, to]);
  return null;
}
