import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { markMicAsked, micAlreadyAsked, requestMicPermission, shouldPromptMic } from "@/lib/micPermission";

/** Demande unique du micro au premier lancement de l'app après connexion. */
export function MicPermissionPrompt() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (
      shouldPromptMic({
        native: Capacitor.isNativePlatform(),
        signedIn: !!user,
        alreadyAsked: micAlreadyAsked(),
        path: pathname,
      })
    ) {
      setOpen(true);
    }
  }, [user, pathname]);

  if (!open) return null;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Micro</AlertDialogTitle>
          <AlertDialogDescription className="text-body">
            Pour parler dans vos tontines, autorisez le micro.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => {
              markMicAsked();
              setOpen(false);
            }}
          >
            Plus tard
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setOpen(false);
              void requestMicPermission();
            }}
          >
            Autoriser
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
