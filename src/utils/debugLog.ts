/**
 * Debug logging for renderer (camera / app lifecycle).
 * Enabled automatically in Vite DEV, or via localStorage DEBUG=1 / DEBUG=camera,app
 */
const isViteDev = Boolean(import.meta.env?.DEV);

const readFlags = (): Set<string> => {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage?.getItem('DEBUG') ?? '';
    if (!raw) return new Set();
    if (raw === '1' || raw === '*' || raw.toLowerCase() === 'true') {
      return new Set(['app', 'camera', 'goloom', 'react']);
    }
    return new Set(
      raw
        .split(/[,+\s]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    );
  } catch {
    return new Set();
  }
};

let flags = readFlags();

export const refreshDebugFlags = (): void => {
  flags = readFlags();
};

export const isDebugEnabled = (channel: string): boolean => {
  if (isViteDev) return true;
  return flags.has(channel.toLowerCase()) || flags.has('*');
};

const formatDebugArg = (arg: unknown): unknown => {
  if (arg !== null && typeof arg === 'object' && !(arg instanceof Error) && !(arg instanceof Event)) {
    try {
      return JSON.stringify(arg);
    } catch {
      return arg;
    }
  }
  return arg;
};

export const debugLog = (channel: string, ...args: unknown[]): void => {
  if (!isDebugEnabled(channel)) return;
  const tag = `[Debug:${channel}]`;
  console.log(tag, ...args.map(formatDebugArg));
};

export const debugWarn = (channel: string, ...args: unknown[]): void => {
  if (!isDebugEnabled(channel)) return;
  console.warn(`[Debug:${channel}]`, ...args);
};

export const debugError = (channel: string, ...args: unknown[]): void => {
  // Errors always surface in DEV; in prod only when DEBUG flags set
  if (!isViteDev && !isDebugEnabled(channel)) return;
  console.error(`[Debug:${channel}]`, ...args);
};
