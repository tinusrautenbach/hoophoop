"use client";

import { ReactNode } from "react";

export default function HasuraProvider({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
