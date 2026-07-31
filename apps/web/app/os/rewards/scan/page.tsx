"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle, QrCode, XCircle } from "lucide-react";

import { Button, Panel } from "@fliptrybe/ui";

import { scanQrCode } from "../../../rewards/api";
import { PageHeader } from "../../../campaigns/components";

type ScanState = "idle" | "scanning" | "success" | "error";

export default function ScanQrPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<ScanState>("idle");
  const [message, setMessage] = useState<string>();
  const [manualToken, setManualToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setState("idle");
  }, []);

  const startCamera = useCallback(async () => {
    setState("scanning");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setState("error");
      setMessage("Could not access camera. Try entering the code manually below.");
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  async function handleManualSubmit() {
    if (!manualToken.trim()) return;
    setSubmitting(true);
    try {
      await scanQrCode(manualToken.trim());
      setState("success");
      setMessage("QR code scanned successfully! Your task has been submitted.");
      setManualToken("");
    } catch (err: unknown) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Invalid QR code. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Scan QR Code"
        eyebrow={<><QrCode className="h-4 w-4" /><span>Rewards</span></>}
      />

      {state === "success" && (
        <Panel>
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <p className="font-semibold text-green-600">{message}</p>
            <Button variant="secondary" onClick={() => { setState("idle"); setMessage(undefined); }}>
              Scan Another
            </Button>
          </div>
        </Panel>
      )}

      {state !== "success" && (
        <>
          <Panel>
            {state === "scanning" ? (
              <div className="space-y-4">
                <div className="relative aspect-square w-full max-w-sm mx-auto overflow-hidden rounded-lg bg-black">
                  <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-48 w-48 rounded-lg border-2 border-white/70 shadow-lg" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Point your camera at a QR code</p>
                  <Button variant="secondary" className="mt-2" onClick={stopCamera}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <QrCode className="h-16 w-16 text-muted-foreground opacity-40" />
                <div>
                  <p className="font-medium">Ready to scan</p>
                  <p className="text-sm text-muted-foreground">Use your camera or enter a code manually</p>
                </div>
                <Button onClick={startCamera}>Open Camera</Button>
              </div>
            )}
          </Panel>

          {state === "error" && message && (
            <Panel>
              <div className="flex items-center gap-3 text-destructive">
                <XCircle className="h-5 w-5 shrink-0" />
                <p className="text-sm">{message}</p>
              </div>
            </Panel>
          )}

          <Panel>
            <h3 className="mb-3 font-medium text-sm">Enter code manually</h3>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter QR token..."
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handleManualSubmit()}
              />
              <Button
                onClick={() => void handleManualSubmit()}
                disabled={!manualToken.trim() || submitting}
              >
                {submitting ? "Submitting…" : "Submit"}
              </Button>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
