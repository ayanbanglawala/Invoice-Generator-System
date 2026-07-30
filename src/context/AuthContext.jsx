import { createContext, useContext, useState } from "react";
import * as store from "../lib/storage";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [loggedIn, setLoggedIn] = useState(store.isLoggedIn());

  function signIn(username, password) {
    const ok = store.login(username, password);
    if (ok) setLoggedIn(true);
    return ok;
  }

  function signOut() {
    store.logout();
    setLoggedIn(false);
  }

  return (
    <AuthContext.Provider value={{ loggedIn, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
