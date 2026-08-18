import { useState } from "react";

// Tries to load src/assets/logo.jpeg. If it doesn't exist (or fails to load),
// falls back to the circular initials badge that was there before.
// To add your logo: drop a file named exactly "logo.jpeg" into src/assets/.
// Square images work best (it's cropped into a circle).
let logoUrl;
try {
  // import.meta.glob lets this stay a no-op (no build error) when the file
  // is missing, instead of a hard `import logo from "../assets/logo.jpeg"`
  // which would fail the whole build if the file isn't there yet.
  const modules = import.meta.glob("../assets/logo.jpeg", {
    eager: true,
    import: "default",
  });
  logoUrl = modules["../assets/logo.jpeg"];
} catch {
  logoUrl = undefined;
}

function BusinessLogo({ business, size = 56, className = "" }) {
  const [imgFailed, setImgFailed] = useState(false);
  const px = `${size}px`;

  if (logoUrl && !imgFailed) {
    return (
      <img
        src={logoUrl}
        alt={business?.name || "Logo"}
        onError={() => setImgFailed(true)}
        style={{ width: px, height: px }}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      style={{ width: px, height: px }}
      className={`flex shrink-0 items-center justify-center rounded-full bg-ink-900 text-xl font-bold text-white ${className}`}
    >
      {business?.logoInitial || business?.name?.[0] || "B"}
    </div>
  );
}

export default BusinessLogo;
