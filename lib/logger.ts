/**
 * Minimal structured logger.
 *
 * Writes one JSON object per line (level, time, msg, plus context), which log
 * platforms such as Vercel, Datadog or CloudWatch parse without extra config.
 * No dependencies, so it runs in both the Node and Edge runtimes (proxy.ts).
 *
 * Rules for callers:
 *  - Log ids (userId, consultationId, requestId), never names, emails or
 *    request bodies, to keep personal data out of logs.
 *  - Pass errors as `err`; they are serialised with name, message and stack.
 */

type Level = "debug" | "info" | "warn" | "error";
type Context = Record<string, unknown>;

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function threshold(): number {
  const configured = process.env.LOG_LEVEL as Level | undefined;
  if (configured && configured in LEVELS) return LEVELS[configured];
  return process.env.NODE_ENV === "production" ? LEVELS.info : LEVELS.debug;
}

function serialiseError(err: unknown): unknown {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      ...(err.cause !== undefined ? { cause: serialiseError(err.cause) } : {}),
    };
  }
  return err;
}

function write(level: Level, msg: string, context: Context) {
  if (LEVELS[level] < threshold()) return;

  const { err, ...rest } = context;
  const entry = {
    level,
    time: new Date().toISOString(),
    msg,
    ...rest,
    ...(err !== undefined ? { err: serialiseError(err) } : {}),
  };

  let line: string;
  try {
    line = JSON.stringify(entry);
  } catch {
    // Circular or otherwise unserialisable context: never let logging throw.
    line = JSON.stringify({ level, time: entry.time, msg, note: "context not serialisable" });
  }

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export type Logger = {
  debug: (msg: string, context?: Context) => void;
  info: (msg: string, context?: Context) => void;
  warn: (msg: string, context?: Context) => void;
  error: (msg: string, context?: Context) => void;
  /** A logger that adds `context` to every line, e.g. a request id. */
  child: (context: Context) => Logger;
};

function createLogger(base: Context = {}): Logger {
  return {
    debug: (msg, ctx = {}) => write("debug", msg, { ...base, ...ctx }),
    info: (msg, ctx = {}) => write("info", msg, { ...base, ...ctx }),
    warn: (msg, ctx = {}) => write("warn", msg, { ...base, ...ctx }),
    error: (msg, ctx = {}) => write("error", msg, { ...base, ...ctx }),
    child: (ctx) => createLogger({ ...base, ...ctx }),
  };
}

export const logger = createLogger({ service: "mini-lms" });
