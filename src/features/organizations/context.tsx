"use client";

import * as React from "react";

interface OrgContextValue {
  currentOrgId: string | null;
  setCurrentOrgId: (id: string | null) => void;
}

const OrgContext = React.createContext<OrgContextValue | null>(null);

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const [currentOrgId, setCurrentOrgId] = React.useState<string | null>(null);

  return (
    <OrgContext.Provider value={{ currentOrgId, setCurrentOrgId }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrgContext() {
  const context = React.useContext(OrgContext);
  if (!context) {
    throw new Error("useOrgContext must be used within an OrgProvider");
  }
  return context;
}

export function useCurrentOrgId(): string | null {
  const context = React.useContext(OrgContext);
  return context?.currentOrgId ?? null;
}