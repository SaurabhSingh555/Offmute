import { CheckCircle2, Download, Share, Smartphone } from "lucide-react";
import { useToast } from "@/context/AppProviders";
import { useInstallPrompt } from "@/lib/pwa";
import { Badge, Button } from "@/components/ui";
import { cn } from "@/utils/cn";

/**
 * "Install OFFMUTE" card. Shows a native install button when the browser
 * supports it, and short manual instructions otherwise (iOS especially).
 */
export default function InstallApp({ className }: { className?: string }) {
  const { canInstall, installed, isIos, install } = useInstallPrompt();
  const { toast } = useToast();

  async function handleInstall() {
    const result = await install();
    if (result === "accepted") {
      toast({ title: "App installed", desc: "OFFMUTE is now on your home screen.", variant: "ok" });
    }
  }

  return (
    <div className={cn("rounded-xl border border-line bg-surface p-4", className)}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand border border-brand/30">
          <Smartphone className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-display font-semibold text-sm">Install OFFMUTE</p>
            {installed && <Badge tone="ok">Installed</Badge>}
          </div>
          <p className="text-xs text-mute mt-1 leading-relaxed">
            {installed
              ? "You are already using the app version. It opens full-screen without the browser bar."
              : canInstall
                ? "Add OFFMUTE to your home screen for faster access and full-screen browsing."
                : isIos
                  ? "On iPhone: tap the Share icon, then choose “Add to Home Screen”."
                  : "Open this site in Chrome or Edge, then use “Install app” in the address bar."}
          </p>

          {!installed && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {canInstall ? (
                <Button size="sm" onClick={handleInstall}>
                  <Download className="size-4" /> Install app
                </Button>
              ) : isIos ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold font-mono uppercase tracking-wider text-mute">
                  <Share className="size-3.5" /> Share → Add to Home Screen
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold font-mono uppercase tracking-wider text-mute">
                  <Download className="size-3.5" /> Browser menu → Install app
                </span>
              )}
              {canInstall && (
                <span className="inline-flex items-center gap-1 text-[11px] text-ok">
                  <CheckCircle2 className="size-3.5" /> Works offline once opened
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
