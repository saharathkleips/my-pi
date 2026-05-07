import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

type SupportedProvider = "openai-codex";

type UsageWindow = {
  usedPercent: number | null;
  limitWindowSeconds: number | null;
  resetAfterSeconds: number | null;
  resetAt: number | null;
};

type NormalizedUsage = {
  provider: SupportedProvider;
  allowed: boolean | null;
  limitReached: boolean | null;
  rateLimitReachedType: string | null;
  shortWindow: UsageWindow | null;
  longWindow: UsageWindow | null;
  raw: unknown;
  fetchedAt: number;
};

type CacheEntry = {
  data: NormalizedUsage | null;
  error: string | null;
  fetchedAt: number;
  inFlight?: Promise<NormalizedUsage | null>;
};

const STATUS_KEY = "usage-limits";
const COMMAND_NAME = "usage-limits";
const CACHE_TTL_MS = 5 * 60 * 1000;
const OPENAI_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
const FALLBACK_STATUS = "usage unavailable";

/**
 * Registers a lightweight subscription-usage integration for supported providers.
 *
 * Current implementation only supports OpenAI Codex subscription models, but the
 * fetch/normalize/cache flow is intentionally split up so additional providers can
 * be added later without rewriting the UI pieces.
 */
export default function (pi: ExtensionAPI) {
  const cache = new Map<string, CacheEntry>();

  pi.registerCommand(COMMAND_NAME, {
    description: "Fetch and show current subscription usage limits for supported providers",
    handler: async (_args, ctx) => {
      const usage = await maybeFetchForCurrentModel(ctx, cache, {
        forceRefresh: true,
        reason: "command",
      });

      if (!usage) {
        if (!isSupportedUsageProvider(ctx)) {
          ctx.ui.notify(
            "Current model does not use a supported subscription usage endpoint",
            "info",
          );
          return;
        }

        const error = getCacheEntry(cache, getProviderKey(ctx))?.error;
        ctx.ui.notify(error ?? "Could not fetch usage limits", "warning");
        return;
      }

      const lines = formatUsageDetails(usage);
      ctx.ui.setStatus(STATUS_KEY, formatStatusUsage(usage, null, ctx));
      ctx.ui.notify(lines.join("\n"), usage.limitReached ? "warning" : "info");
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    await refreshStatus(ctx, cache, { forceRefresh: false, reason: "session_start" });
  });

  pi.on("model_select", async (_event, ctx) => {
    await refreshStatus(ctx, cache, { forceRefresh: false, reason: "model_select" });
  });

  pi.on("agent_end", async (_event, ctx) => {
    await refreshStatus(ctx, cache, { forceRefresh: false, reason: "agent_end", staleOnly: true });
  });
}

/**
 * Refreshes the footer status text for the active model.
 *
 * This is the main UI entry point. If we later want to experiment with widgets or
 * a custom footer, this is the best place to swap rendering behavior.
 */
async function refreshStatus(
  ctx: ExtensionContext,
  cache: Map<string, CacheEntry>,
  options: { forceRefresh: boolean; reason: string; staleOnly?: boolean },
): Promise<void> {
  if (!isSupportedUsageProvider(ctx)) {
    ctx.ui.setStatus(STATUS_KEY, undefined);
    return;
  }

  const providerKey = getProviderKey(ctx);
  const cached = getCacheEntry(cache, providerKey);
  if (options.staleOnly && cached && !isCacheStale(cached)) {
    ctx.ui.setStatus(STATUS_KEY, formatStatusUsage(cached.data, cached.error, ctx));
    return;
  }

  const usage = await maybeFetchForCurrentModel(ctx, cache, options);
  const nextCached = getCacheEntry(cache, providerKey);
  ctx.ui.setStatus(STATUS_KEY, formatStatusUsage(usage, nextCached?.error ?? null, ctx));
}

/**
 * Returns cached usage data for the current provider when possible and performs a
 * network fetch only when forced or stale.
 *
 * The per-provider cache and in-flight deduplication are here so we do not spam
 * the backend during model switches, command runs, or repeated turns.
 */
async function maybeFetchForCurrentModel(
  ctx: ExtensionContext,
  cache: Map<string, CacheEntry>,
  options: { forceRefresh: boolean; reason: string },
): Promise<NormalizedUsage | null> {
  if (!isSupportedUsageProvider(ctx)) return null;

  const provider = ctx.model!.provider as SupportedProvider;
  const providerKey = getProviderKey(ctx);
  const existing = getCacheEntry(cache, providerKey);
  if (!options.forceRefresh && existing && !isCacheStale(existing)) {
    return existing.data;
  }
  if (!options.forceRefresh && existing?.inFlight) {
    return existing.inFlight;
  }

  const inFlight = fetchUsage(ctx, provider)
    .then((data) => {
      cache.set(providerKey, {
        data,
        error: null,
        fetchedAt: Date.now(),
      });
      return data;
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      cache.set(providerKey, {
        data: existing?.data ?? null,
        error: message,
        fetchedAt: Date.now(),
      });
      return existing?.data ?? null;
    });

  cache.set(providerKey, {
    data: existing?.data ?? null,
    error: existing?.error ?? null,
    fetchedAt: existing?.fetchedAt ?? 0,
    inFlight,
  });

  return inFlight;
}

/**
 * Fetches raw usage data for a supported provider and normalizes it into the
 * provider-agnostic shape used by the rest of the extension.
 *
 * If another subscription provider is added later, this is a natural place to
 * branch to provider-specific fetchers.
 */
async function fetchUsage(
  ctx: ExtensionContext,
  provider: SupportedProvider,
): Promise<NormalizedUsage> {
  const token = await getProviderAuthToken(ctx, provider);
  const response = await fetch(OPENAI_USAGE_URL, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
    },
    signal: ctx.signal,
  });

  if (!response.ok) {
    throw new Error(`Usage request failed: ${response.status} ${response.statusText}`);
  }

  const raw = (await response.json()) as OpenAiUsageResponse;
  return normalizeOpenAiUsage(raw);
}

/**
 * Resolves the bearer token for the provider from pi's model registry.
 *
 * We prefer pi-managed auth over reading auth.json directly so OAuth refresh and
 * any future auth changes stay centralized inside pi.
 */
async function getProviderAuthToken(
  ctx: ExtensionContext,
  provider: SupportedProvider,
): Promise<string> {
  if (ctx.model?.provider === provider) {
    const auth = await ctx.modelRegistry.getApiKeyAndHeaders(ctx.model);
    if (!auth.ok) throw new Error(auth.error);
    if (!auth.apiKey) throw new Error(`No API key available for ${provider}`);
    return auth.apiKey;
  }

  const token = await ctx.modelRegistry.getApiKeyForProvider(provider);
  if (!token) throw new Error(`No API key available for ${provider}`);
  return token;
}

/**
 * Maps the current OpenAI `/wham/usage` response into the normalized internal
 * model used by the status line and command output.
 *
 * The `shortWindow` / `longWindow` names are deliberately neutral because the
 * API semantics may evolve and other providers may expose similar rolling windows.
 */
function normalizeOpenAiUsage(raw: OpenAiUsageResponse): NormalizedUsage {
  return {
    provider: "openai-codex",
    allowed: raw.rate_limit?.allowed ?? null,
    limitReached: raw.rate_limit?.limit_reached ?? null,
    rateLimitReachedType: raw.rate_limit_reached_type ?? null,
    shortWindow: normalizeWindow(raw.rate_limit?.primary_window),
    longWindow: normalizeWindow(raw.rate_limit?.secondary_window),
    raw,
    fetchedAt: Date.now(),
  };
}

function normalizeWindow(window: OpenAiUsageWindow | null | undefined): UsageWindow | null {
  if (!window) return null;
  return {
    usedPercent: numberOrNull(window.used_percent),
    limitWindowSeconds: numberOrNull(window.limit_window_seconds),
    resetAfterSeconds: numberOrNull(window.reset_after_seconds),
    resetAt: numberOrNull(window.reset_at),
  };
}

/**
 * Formats the compact status-line summary.
 *
 * This is where to tweak separators, warning prefixes, or the overall density of
 * the status text if the current presentation feels too noisy or too terse.
 */
function formatStatusUsage(
  usage: NormalizedUsage | null,
  error: string | null,
  ctx: ExtensionContext,
): string {
  const theme = ctx.ui.theme;
  if (!usage) {
    return error ? theme.fg("warning", FALLBACK_STATUS) : theme.fg("dim", FALLBACK_STATUS);
  }

  const parts = [
    formatShortStatusWindow(usage.shortWindow, theme),
    formatLongStatusWindow(usage.longWindow, theme),
  ].filter(Boolean);

  if (parts.length === 0) {
    return theme.fg("dim", FALLBACK_STATUS);
  }

  const prefix = usage.limitReached ? theme.fg("warning", "limit") + theme.fg("dim", " • ") : "";
  return prefix + parts.join(theme.fg("dim", " • "));
}

function formatShortStatusWindow(
  window: UsageWindow | null,
  theme: ExtensionContext["ui"]["theme"],
): string {
  if (!window) return "";
  const percent = window.usedPercent != null ? `${window.usedPercent}%` : "?%";
  const reset = formatResetTime(window.resetAt);
  return theme.fg("dim", "◷ ") + theme.fg("accent", percent) + theme.fg("dim", ` ${reset}`);
}

function formatLongStatusWindow(
  window: UsageWindow | null,
  theme: ExtensionContext["ui"]["theme"],
): string {
  if (!window) return "";
  const percent = window.usedPercent != null ? `${window.usedPercent}%` : "?%";
  const reset = formatResetTime(window.resetAt);
  const daySymbol = formatWeekdaySymbol(window.resetAt);
  return (
    theme.fg("dim", `${daySymbol} `) + theme.fg("accent", percent) + theme.fg("dim", ` ${reset}`)
  );
}

/**
 * Formats the more verbose `/usage-limits` command output.
 *
 * Keep this richer than the status line so the command remains useful for manual
 * inspection and debugging without making the persistent UI too busy.
 */
function formatUsageDetails(usage: NormalizedUsage): string[] {
  const lines = ["Usage limits"];
  if (usage.shortWindow) {
    lines.push(`short: ${formatWindowDetails(usage.shortWindow)}`);
  }
  if (usage.longWindow) {
    lines.push(`long: ${formatWindowDetails(usage.longWindow)}`);
  }
  if (usage.allowed != null) {
    lines.push(`allowed: ${usage.allowed ? "yes" : "no"}`);
  }
  if (usage.limitReached != null) {
    lines.push(`limit reached: ${usage.limitReached ? "yes" : "no"}`);
  }
  if (usage.rateLimitReachedType) {
    lines.push(`limit type: ${usage.rateLimitReachedType}`);
  }
  return lines;
}

function formatWindowDetails(window: UsageWindow): string {
  const percent = window.usedPercent != null ? `${window.usedPercent}% used` : "usage unknown";
  const reset = formatDetailedReset(window.resetAt, window.resetAfterSeconds);
  return `${percent}, resets ${reset}`;
}

function formatDetailedReset(
  resetAtSeconds: number | null,
  resetAfterSeconds: number | null,
): string {
  const pieces: string[] = [];
  if (resetAtSeconds != null) {
    pieces.push(formatResetTime(resetAtSeconds));
  }
  if (resetAfterSeconds != null) {
    pieces.push(`in ${formatDuration(resetAfterSeconds)}`);
  }
  return pieces.join(" ") || "unknown";
}

/**
 * Formats a reset timestamp for compact human-readable display.
 *
 * Current rules:
 * - same day: local time, e.g. `4:31 PM`
 * - next few days: weekday, e.g. `Mon`
 * - farther out: compact date/time fallback
 *
 * If you later want stricter timezone control, this is the function to update.
 */
function formatResetTime(unixSeconds: number | null): string {
  if (unixSeconds == null) return "unknown";
  const target = new Date(unixSeconds * 1000);
  if (Number.isNaN(target.getTime())) return "unknown";

  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  if (diffMs >= 0 && diffMs < 24 * 60 * 60 * 1000) {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(target);
  }

  const diffDays = localDayDiff(now, target);
  if (diffDays >= 1 && diffDays <= 6) {
    return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(target);
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(target);
}

/**
 * Returns the circled weekday ideograph used for the long-window indicator.
 *
 * This is purely presentational. If terminal rendering turns out to be unreliable
 * anywhere, replace the symbols here without touching the rest of the formatter.
 */
function formatWeekdaySymbol(unixSeconds: number | null): string {
  if (unixSeconds == null) return "◌";
  const target = new Date(unixSeconds * 1000);
  if (Number.isNaN(target.getTime())) return "◌";

  const symbols = ["㊐", "㊊", "㊋", "㊌", "㊍", "㊎", "㊏"];
  return symbols[target.getDay()] ?? "◌";
}

function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "unknown time";
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${Math.max(1, minutes)}m`;
}

function localDayDiff(a: Date, b: Date): number {
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const end = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((end - start) / 86400000);
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Central provider gate for the extension.
 *
 * Extend this when adding new subscription-backed providers so command handling,
 * status refresh, and fetch logic all stay in sync.
 */
function isSupportedUsageProvider(ctx: ExtensionContext): boolean {
  return ctx.model?.provider === "openai-codex";
}

function getProviderKey(ctx: ExtensionContext): string {
  return ctx.model?.provider ?? "unknown";
}

function getCacheEntry(cache: Map<string, CacheEntry>, key: string): CacheEntry | undefined {
  return cache.get(key);
}

function isCacheStale(entry: CacheEntry): boolean {
  return Date.now() - entry.fetchedAt >= CACHE_TTL_MS;
}

type OpenAiUsageWindow = {
  used_percent?: number;
  limit_window_seconds?: number;
  reset_after_seconds?: number;
  reset_at?: number;
};

type OpenAiUsageResponse = {
  rate_limit?: {
    allowed?: boolean;
    limit_reached?: boolean;
    primary_window?: OpenAiUsageWindow | null;
    secondary_window?: OpenAiUsageWindow | null;
  } | null;
  rate_limit_reached_type?: string | null;
};
