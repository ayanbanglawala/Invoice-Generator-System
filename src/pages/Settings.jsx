import * as store from "../lib/storage";
import { useAuth } from "../context/AuthContext";
import { LogoutIcon, PhoneIcon } from "../components/Icons";

export default function Settings() {
  const { signOut } = useAuth();
  const business = store.getBusiness();

  return (
    <div className="min-h-dvh bg-ink-50 pb-28">
      <header className="bg-white px-5 pb-4 pt-6 shadow-card">
        <h1 className="text-xl font-bold text-ink-900">Settings</h1>
        <p className="mt-1 text-sm text-ink-500">
          Business details that appear on every invoice
        </p>
      </header>

      <main className="px-5 pt-4">
        <section className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-900 text-lg font-bold text-white">
              {business.logoInitial}
            </div>
            <div>
              <p className="text-[15px] font-bold text-ink-900">
                {business.name}
              </p>
              <p className="flex items-center gap-1.5 text-xs text-ink-500">
                <PhoneIcon width={12} height={12} /> {business.phone}
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm text-ink-600">{business.address}</p>

          <div className="mt-4 rounded-xl bg-ink-50 px-3.5 py-3 text-xs text-ink-500">
            This is fixed at the code level. To change it, edit{" "}
            <code className="rounded bg-white px-1.5 py-0.5 font-mono text-ink-700">
              src/config/business.js
            </code>{" "}
            and rebuild the app.
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
          <p className="text-sm font-semibold text-ink-700">Data storage</p>
          <p className="mt-1 text-sm text-ink-500">
            Bills and customers are currently stored on this device only
            (browser local storage). Connect a database later by editing{" "}
            <code className="rounded bg-ink-50 px-1.5 py-0.5 font-mono text-ink-700">
              src/lib/storage.js
            </code>{" "}
            — every screen reads and writes through that one file.
          </p>
        </section>

        <button
          onClick={signOut}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 text-base font-semibold text-red-600 active:scale-[0.98]"
        >
          <LogoutIcon width={18} height={18} /> Log Out
        </button>
      </main>
    </div>
  );
}
