let pendingPath: string | null = null;

const isWorthRestoring = (path: string) => {
  if (!path) return false;
  if (path === "/") return false;
  if (path.startsWith("/welcome")) return false;
  if (path.startsWith("/login")) return false;
  if (path.startsWith("/onboarding")) return false;
  return true;
};

export const setPendingDeepLink = (path: string) => {
  if (isWorthRestoring(path)) {
    pendingPath = path;
  }
};

export const consumePendingDeepLink = (): string | null => {
  const path = pendingPath;
  pendingPath = null;
  return path;
};
