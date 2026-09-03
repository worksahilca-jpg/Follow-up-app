"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Mic, Square } from "lucide-react";

const inputClass = "w-full rounded-lg border border-line bg-card px-3 py-2 text-sm";

// Chrome/Edge (webkitSpeechRecognition) and standards-track browsers that
// ship SpeechRecognition — Safari and Firefox don't, so this is a
// progressive enhancement: the mic button just doesn't render for them,
// typing the note still works exactly the same.
type SpeechRecognitionCtor = new () => SpeechRecognition;
function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Quick call logging — fewer fields than the full "Add lead" form, and a
 * mic button that dictates straight into the notes field using the
 * browser's free built-in speech recognition (no Twilio/paid transcription
 * needed). Built for the moment right after you hang up: name, number,
 * talk for ten seconds about what was said, done.
 */
export default function LogCallForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [recording, setRecording] = useState(false);
  // This component only ever mounts client-side (shown after a button
  // click, never part of the server-rendered HTML), so reading the
  // feature-detect straight into the initializer is safe — no SSR/
  // hydration mismatch to worry about, and no effect needed just to set it.
  const [micSupported] = useState(() => getSpeechRecognitionCtor() !== null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const notesAtStartRef = useRef("");

  useEffect(() => () => recognitionRef.current?.stop(), []);

  function toggleRecording() {
    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
      return;
    }

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    notesAtStartRef.current = notes;
    let finalTranscript = "";

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += chunk + " ";
        else interim += chunk;
      }
      const prefix = notesAtStartRef.current ? notesAtStartRef.current.trim() + " " : "";
      setNotes(prefix + finalTranscript + interim);
    };
    recognition.onerror = () => setRecording(false);
    recognition.onend = () => setRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give this lead a name to continue.");
      return;
    }
    recognitionRef.current?.stop();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, notes, source: "Phone call" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? "Couldn't save — try again.");
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save — try again.");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-line bg-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl">Log a call</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-xs text-ink-soft -mt-2 mb-4">
          For leads that called instead of emailed — this doesn&apos;t get synced automatically, so log it
          here right after you hang up.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1.5">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Who called" autoFocus />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} placeholder="Optional" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium">What was the call about?</label>
              {micSupported && (
                <button
                  type="button"
                  onClick={toggleRecording}
                  className="inline-flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-1"
                  style={{
                    backgroundColor: recording ? "var(--rust)" : "var(--slate-soft)",
                    color: recording ? "white" : "var(--slate)",
                  }}
                >
                  {recording ? <Square className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                  {recording ? "Stop" : "Dictate"}
                </button>
              )}
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={inputClass}
              rows={4}
              placeholder={micSupported ? "Type, or hit Dictate and just talk" : "e.g. asked about the 4br on Maple St, wants a showing Saturday"}
            />
            {recording && (
              <p className="text-xs mt-1 flex items-center gap-1.5" style={{ color: "var(--rust)" }}>
                <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: "var(--rust)" }} />
                Listening…
              </p>
            )}
          </div>

          {error && (
            <p className="text-sm" style={{ color: "var(--rust)" }}>
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium border border-line"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-60"
              style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
            >
              {saving ? "Saving…" : "Log call"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
