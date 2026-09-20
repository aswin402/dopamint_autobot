type LogLevel = "info" | "warn" | "error" | "debug"

const isDev = process.env.NODE_ENV !== "production"

const styles: Record<LogLevel, string> = {
  info: "color: #3b82f6; font-weight: 600;",
  warn: "color: #f59e0b; font-weight: 600;",
  error: "color: #ef4444; font-weight: 600;",
  debug: "color: #10b981; font-weight: 600;",
}

const formatMessage = (level: LogLevel, message: string) => {
  const prefix = `[APP] ${level.toUpperCase()}`
  const isBrowser = typeof window !== 'undefined'
  if (isBrowser) {
    return [`%c${prefix} %c${message}`, styles[level], "color: inherit; font-weight: normal;"]
  }
  // Server-side terminal color logging
  const colors: Record<LogLevel, string> = {
    info: "\x1b[36m", // Cyan
    warn: "\x1b[33m", // Yellow
    error: "\x1b[31m", // Red
    debug: "\x1b[32m", // Green
  }
  const reset = "\x1b[0m"
  return [`${colors[level]}${prefix}${reset} ${message}`]
}

function log(level: LogLevel, message: string, data?: unknown) {
  if (!isDev && level === "debug") return

  const formatted = formatMessage(level, message)

  if (data === undefined) {
    if (typeof window !== 'undefined') {
      const [prompt, style, reset] = formatted
      if (level === "error") console.error(prompt, style, reset)
      else if (level === "warn") console.warn(prompt, style, reset)
      else console.log(prompt, style, reset)
    } else {
      const [prompt] = formatted
      if (level === "error") console.error(prompt)
      else if (level === "warn") console.warn(prompt)
      else console.log(prompt)
    }
    return
  }

  // Handle data with grouping for a cleaner console
  if (typeof window !== 'undefined') {
    const [prompt, style, reset] = formatted
    console.groupCollapsed(prompt, style, reset)
    if (data instanceof Error) {
      console.error(data.message)
      if (data.stack) console.debug(data.stack)
    } else {
      console.dir(data)
    }
    console.groupEnd()
  } else {
    const [prompt] = formatted
    console.log(prompt, data)
  }
}

export const logger = {
  info: (msg: string, data?: unknown) => log("info", msg, data),
  warn: (msg: string, data?: unknown) => log("warn", msg, data),
  error: (msg: string, data?: unknown) => log("error", msg, data),
  debug: (msg: string, data?: unknown) => log("debug", msg, data),
}
