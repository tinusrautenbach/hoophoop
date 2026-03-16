"use client";

import { ReactNode, useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { registerTokenGetter } from "@/lib/hasura/client";

export default function HasuraProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { getToken } = useAuth();

  useEffect(() => {
    registerTokenGetter(() => getToken());
  }, [getToken]);

  return <>{children}</>;
}
