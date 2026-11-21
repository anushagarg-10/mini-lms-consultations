"use client";

/**
 * Last-resort boundary for errors in the root layout itself. It replaces the
 * whole document, so it renders its own <html> and <body> and uses inline
 * styles (the app's CSS may not have loaded).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          margin: 0,
          textAlign: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: 20 }}>Something went wrong</h1>
          <p style={{ color: "#666" }}>Please refresh the page or try again shortly.</p>
          {error.digest && <p style={{ color: "#999", fontSize: 12 }}>Reference: {error.digest}</p>}
          <button onClick={reset} style={{ marginTop: 12, padding: "8px 16px", cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
