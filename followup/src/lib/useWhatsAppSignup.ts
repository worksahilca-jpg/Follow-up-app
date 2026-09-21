"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Connecting a WhatsApp number, wherever the owner is standing.
 *
 * ## Why this is a hook and not a panel
 *
 * Every other lead source connects by leaving the app and coming back: a
 * link to Google or Meta, a callback, a redirect home. WhatsApp does not.
 * Meta's Embedded Signup runs in a popup driven by their JavaScript SDK,
 * and the finished connection arrives in two halves — a one-time `code`
 * from the login callback, and the phone number id from a `postMessage`
 * the popup sends back. Whichever lands second completes the connect.
 *
 * All of that used to live inside WhatsAppConfig, the Settings panel. It
 * worked, and it meant WhatsApp could only be connected from Settings.
 * When onboarding started asking "where do your leads come from?"
 * (2026-09-21), WhatsApp was the one answer with no button — a line of
 * text pointing at a screen the owner had not reached yet. For a business
 * that runs entirely on WhatsApp, which is squarely who that step was
 * rebuilt for, that is the worst possible place to send them away.
 *
 * So the mechanism moved here and the two surfaces share it. Settings
 * keeps everything this does not cover — the message template, the
 * webhook reference, the paste-a-token fallback, disconnecting.
 *
 * ## What callers get
 *
 * `available` is false when Meta signup is not configured for this
 * deployment; a caller that cannot connect should not offer a button that
 * cannot work. `connected` and `displayNumber` are read back from the
 * server, so they survive a reload and are not guessed from a local flag.
 */

type WhatsAppConfigResponse = {
  success: boolean;
  connected: boolean;
  displayNumber: string | null;
  signupAvailable: boolean;
  appId: string | null;
  configId: string | null;
};

type FbSdk = {
  init: (opts: { appId: string; autoLogAppEvents?: boolean; xfbml?: boolean; version: string }) => void;
  login: (
    cb: (response: { authResponse?: { code?: string } | null; status?: string }) => void,
    opts: Record<string, unknown>
  ) => void;
};

declare global {
  interface Window {
    FB?: FbSdk;
    fbAsyncInit?: () => void;
  }
}

const SDK_SRC = "https://connect.facebook.net/en_US/sdk.js";
const GRAPH_VERSION = "v21.0";

/** Meta posts the finished signup from its own origins and nowhere else. */
const META_ORIGINS = ["https://www.facebook.com", "https://web.facebook.com"];

export type WhatsAppSignup = {
  /** Null until the first config load finishes. */
  loaded: boolean;
  available: boolean;
  connected: boolean;
  displayNumber: string | null;
  connecting: boolean;
  justConnected: boolean;
  error: string | null;
  /** Opens Meta's popup. No-op when `available` is false. */
  start: () => void;
  /** Re-reads the server's view — for a caller that changed it another way. */
  reload: () => Promise<void>;
  setError: (message: string | null) => void;
};

export function useWhatsAppSignup(): WhatsAppSignup {
  const [loaded, setLoaded] = useState(false);
  const [available, setAvailable] = useState(false);
  const [connected, setConnected] = useState(false);
  const [displayNumber, setDisplayNumber] = useState<string | null>(null);
  const [appId, setAppId] = useState<string | null>(null);
  const [configId, setConfigId] = useState<string | null>(null);

  const [connecting, setConnecting] = useState(false);
  const [justConnected, setJustConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** The two halves of a finished signup, held until both are in hand. */
  const signupRef = useRef<{ code?: string; phoneNumberId?: string; wabaId?: string; event?: string }>({});

  /**
   * A promise chain rather than an `async` function, deliberately.
   *
   * Every setState below happens in a `.then`, so none of them runs
   * synchronously when the mount effect calls this. React's
   * no-setState-in-an-effect-body lint rule cannot see through an `async`
   * function to tell that its body starts with an `await`, and flags it.
   * This is the shape WhatsAppConfig's own loader already used.
   */
  const reload = useCallback(
    () =>
      fetch("/api/whatsapp/config")
        .then((res) => res.json() as Promise<WhatsAppConfigResponse>)
        .then((data) => {
          if (!data.success) return;
          setConnected(data.connected);
          setDisplayNumber(data.displayNumber);
          setAvailable(Boolean(data.signupAvailable && data.appId && data.configId));
          setAppId(data.appId);
          setConfigId(data.configId);
        })
        .catch(() => {
          // A failed read leaves `available` false, which hides the button
          // rather than offering one that cannot work.
        })
        .finally(() => setLoaded(true)),
    []
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  // Meta's SDK, loaded only once a caller knows it can use it. Readiness
  // is deliberately not state: `start` checks window.FB when pressed,
  // because the script can finish loading between render and click.
  useEffect(() => {
    if (!available || !appId || window.FB) return;
    const id = appId;
    window.fbAsyncInit = () => {
      window.FB?.init({ appId: id, autoLogAppEvents: false, xfbml: false, version: GRAPH_VERSION });
    };
    if (!document.querySelector(`script[src="${SDK_SRC}"]`)) {
      const script = document.createElement("script");
      script.src = SDK_SRC;
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, [available, appId]);

  const finishConnect = useCallback(async () => {
    const { code, phoneNumberId, wabaId, event } = signupRef.current;
    if (!code || !phoneNumberId || !wabaId) return;
    signupRef.current = {};
    try {
      const res = await fetch("/api/whatsapp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, phoneNumberId, wabaId, event }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string };
      if (!res.ok || !data.success) throw new Error(data.message || "Couldn't finish connecting — try again.");
      setJustConnected(true);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't finish connecting — try again.");
    } finally {
      setConnecting(false);
    }
  }, [reload]);

  // The popup posts the ids back to the page that opened it.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!META_ORIGINS.includes(event.origin)) return;
      let data: { type?: string; event?: string; data?: { phone_number_id?: string; waba_id?: string } };
      try {
        data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (data?.type !== "WA_EMBEDDED_SIGNUP") return;
      if (data.event === "FINISH" || data.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING") {
        signupRef.current = {
          ...signupRef.current,
          phoneNumberId: data.data?.phone_number_id,
          wabaId: data.data?.waba_id,
          event: data.event,
        };
        void finishConnect();
      } else if (data.event === "CANCEL") {
        signupRef.current = {};
        setConnecting(false);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [finishConnect]);

  const start = useCallback(() => {
    if (!configId) return;
    if (!window.FB) {
      setError("Meta's sign-in script hasn't loaded yet — give it a second and press again.");
      return;
    }
    setError(null);
    setJustConnected(false);
    setConnecting(true);
    signupRef.current = {};
    window.FB.login(
      (response) => {
        const code = response.authResponse?.code;
        if (!code) {
          setConnecting(false);
          // The popup closed without a code: the owner cancelled, or Meta
          // refused at the end ("FollowUp can't onboard customers right
          // now") — which is Meta's Business Verification gate, not
          // something the owner did wrong. Nothing here can tell the two
          // apart, so the sentence covers both without blaming anyone.
          setError(
            "Meta didn't finish the sign-in, so nothing was connected. If Meta's window said FollowUp can't onboard customers yet, that's Meta still verifying FollowUp's business — we'll tell you when it clears."
          );
          return;
        }
        signupRef.current = { ...signupRef.current, code };
        void finishConnect();
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        // The Coexistence flow: onboard the number already in the
        // WhatsApp Business app on the owner's phone.
        extras: { setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" },
      }
    );
  }, [configId, finishConnect]);

  return { loaded, available, connected, displayNumber, connecting, justConnected, error, start, reload, setError };
}
