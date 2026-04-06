import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes/index";
import { serveStatic } from "./static";
import { createServer } from "http";
import { debtCalculationService } from "./cron-jobs";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(cookieParser());
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: unknown = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  // Start the cron job service for automatic debt calculations
  debtCalculationService.startMonthlyCalculationCron();

  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    console.error("Error:", err instanceof Error ? err.message : err);
    if (res && typeof res.status === "function") {
      res.status(500).json({ message: "Internal Server Error" });
    } else {
      next(err);
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // PORT / HOST: default all interfaces for Docker/Replit; set HOST=127.0.0.1 if listen fails (some sandboxes).
  const port = parseInt(process.env.PORT || "5000", 10);
  const host = process.env.HOST ?? "0.0.0.0";

  // reusePort is not supported on macOS and throws ENOTSUP; only enable when explicitly requested (e.g. Linux + multi-process).
  const listenOptions: { port: number; host: string; reusePort?: boolean } = { port, host };
  if (process.env.REUSE_PORT === "true" || process.env.SO_REUSEPORT === "1") {
    listenOptions.reusePort = true;
  }

  httpServer.on("error", (err: Error & { code?: string }) => {
    if (err.code === "EADDRINUSE") {
      log(
        `port ${port} is already in use — stop the other process (e.g. another pnpm dev), or set PORT=5001 in .env. Hint: lsof -i :${port} | grep LISTEN`,
        "express"
      );
      if (process.platform === "darwin" && port === 5000) {
        log(
          "on macOS, port 5000 is often taken by AirPlay Receiver (Control Center). Disable: System Settings → General → AirDrop & Handoff → AirPlay Receiver → Off",
          "express"
        );
      }
      process.exit(1);
    }
    console.error(err);
    process.exit(1);
  });

  const server = httpServer.listen(listenOptions, () => {
    log(`serving on http://${host}:${port}`);
    // Run catch-up calculation after server starts
    debtCalculationService.checkAndRunCatchupCalculation();
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    log("SIGTERM received, shutting down gracefully");
    debtCalculationService.stopCronJobs();
    server.close(() => {
      log("Server closed");
      process.exit(0);
    });
  });

  process.on("SIGINT", () => {
    log("SIGINT received, shutting down gracefully");
    debtCalculationService.stopCronJobs();
    server.close(() => {
      log("Server closed");
      process.exit(0);
    });
  });
})();
