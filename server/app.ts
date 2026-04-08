import express, { type Express, type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { createServer, type Server } from "http";
import { registerRoutes } from "./routes/index";

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

/**
 * Creates the Express app with API routes and error handler. Does not listen,
 * start cron, or attach Vite/static — suitable for integration tests (Supertest).
 */
export async function createApp(): Promise<{ app: Express; httpServer: Server }> {
  const app = express();
  const httpServer = createServer(app);

  // Behind nginx (or when TRUST_PROXY=1): trust X-Forwarded-* for req.secure / IP.
  if (process.env.NODE_ENV === "production" || process.env.TRUST_PROXY === "1") {
    app.set("trust proxy", 1);
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

  // Integration tests (Supertest) set NODE_ENV=test; per-request logs with full JSON
  // bodies flood CI and obscure Cucumber output.
  if (process.env.NODE_ENV !== "test") {
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
  }

  await registerRoutes(httpServer, app);

  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    console.error("Error:", err instanceof Error ? err.message : err);
    if (res && typeof res.status === "function") {
      res.status(500).json({ message: "Internal Server Error" });
    } else {
      next(err);
    }
  });

  return { app, httpServer };
}
