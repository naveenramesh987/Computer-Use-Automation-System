import type { Request, Response, NextFunction } from "express";
import { nanoid } from "nanoid";

export type Session = { operatorName: string; loggedInAt: string };

const COOKIE_NAME = "session_id";
const sessions = new Map<string, Session>();

// Runs after a successful login. Makes a random session id, remembers who it
// belongs to, and tells the browser to hang onto that id as a cookie.
export function createSession(res: Response, operatorName: string): void {
  const id = nanoid();
  sessions.set(id, { operatorName, loggedInAt: new Date().toISOString() });

  // httpOnly means client-side JavaScript can't read this cookie — only the
  // browser can send it back to us automatically on future requests.
  res.cookie(COOKIE_NAME, id, { httpOnly: true });
}

// Runs on logout. Forgets the session server-side and tells the browser to
// drop the cookie too.
export function destroySession(req: Request, res: Response): void {
  const id = req.cookies?.[COOKIE_NAME];
  if (id) {
    sessions.delete(id);
  }

  res.clearCookie(COOKIE_NAME);
}

// Middleware: runs before any page that requires a logged-in operator.
// If there's no valid session, go to the login page instead of
// letting the request reach the actual route handler.
export function requireSession(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const id = req.cookies?.[COOKIE_NAME];
  const session = id ? sessions.get(id) : undefined;

  if (!session) {
    res.redirect("/login?reason=session_expired");
    return;
  }

  req.session = session;
  next();
}

declare global {
  namespace Express {
    interface Request {
      session?: Session;
    }
  }
}
