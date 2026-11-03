"use client";

import { createContext, useContext } from "react";

/**
 * The link a shared dashboard was opened with, for the widgets on it that need to ask the server for more than was sent (a results map
 * opening a district or moving the time slider). Null on a signed-in dashboard: those widgets use the person's own session instead.
 */
const ShareLinkContext = createContext<{ token: string } | null>(null);
export const ShareLinkProvider = ShareLinkContext.Provider;
export const useShareLink = (): { token: string } | null => useContext(ShareLinkContext);
