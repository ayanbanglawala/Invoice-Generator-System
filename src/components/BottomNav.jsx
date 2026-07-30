import { NavLink } from "react-router-dom";
import { HomeIcon, PlusIcon, UsersIcon, SettingsIcon } from "./Icons";

const tabs = [
  { to: "/", label: "Bills", Icon: HomeIcon, end: true },
  { to: "/customers", label: "Customers", Icon: UsersIcon },
  { to: "/settings", label: "Settings", Icon: SettingsIcon },
];

export default function BottomNav() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {tabs.slice(0, 1).map((t) => (
          <TabLink key={t.to} {...t} />
        ))}

        <NavLink
          to="/bills/new"
          className="relative -mt-5 flex flex-col items-center justify-center"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-pop transition-transform active:scale-95">
            <PlusIcon width={26} height={26} />
          </span>
          <span className="mt-1 text-[11px] font-medium text-ink-500">
            New Bill
          </span>
        </NavLink>

        {tabs.slice(1).map((t) => (
          <TabLink key={t.to} {...t} />
        ))}
      </div>
    </div>
  );
}

function TabLink({ to, label, Icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex min-w-[64px] flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
          isActive ? "text-brand-600" : "text-ink-400"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            width={22}
            height={22}
            strokeWidth={isActive ? 2.2 : 1.8}
          />
          {label}
        </>
      )}
    </NavLink>
  );
}
