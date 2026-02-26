"use client";

import { ReactNode, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { registerTokenGetter } from "@/lib/hasura/client";

export default function HasuraProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { getToken } = useAuth();

  useEffect(() => {
    // Register Clerk's getToken so the Hasura client can attach
    // the user's JWT to every request and WebSocket connection.
    // This runs once on mount and whenever the auth state changes.
    registerTokenGetter(() => getToken());
  }, [getToken]);

  return <>{children}</>;
}
