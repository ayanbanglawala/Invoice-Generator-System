import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ReceiptIcon } from "../components/Icons";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    const ok = signIn(username.trim(), password);
    if (ok) {
      navigate("/", { replace: true });
    } else {
      setError("Invalid user ID or password.");
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-brand-50 to-white px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-pop">
            <ReceiptIcon width={30} height={30} />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-ink-900 dark:text-white">
            Invoice Manager
          </h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
            Sign in to create and manage bills
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 p-5 shadow-card"
        >
          <div className="space-y-4">
            <div>
              <label
                htmlFor="username"
                className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200"
              >
                User ID
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="h-12 w-full rounded-xl border border-ink-200 dark:border-ink-700 px-4 text-base text-ink-900 dark:text-white outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                required
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="admin"
                className="h-12 w-full rounded-xl border border-ink-200 dark:border-ink-700 px-4 text-base text-ink-900 dark:text-white outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                required
              />
            </div>

            {error && (
              <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="h-12 w-full rounded-xl bg-brand-500 text-base font-semibold text-white shadow-card transition-transform active:scale-[0.98]"
            >
              Sign In
            </button>
          </div>
        </form>

        <p className="mt-5 text-center text-xs text-ink-400 dark:text-ink-500">
          Default login — User ID: admin · Password: admin
        </p>
      </div>
    </div>
  );
}
