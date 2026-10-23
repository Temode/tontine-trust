import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { TermsAcceptStep } from "./TermsAcceptStep";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groupId: string;
  onAccepted?: () => void;
  ctaLabel?: string;
}

/** Modale autonome d'acceptation des conditions générales. */
export function TermsAcceptDialog({ open, onOpenChange, groupId, onAccepted, ctaLabel }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Conditions générales et protection des données</DialogTitle>
          <DialogDescription>
            Acceptez les conditions pour participer au cycle. Une simple case à cocher suffit.
          </DialogDescription>
        </DialogHeader>
        <TermsAcceptStep
          groupId={groupId}
          ctaLabel={ctaLabel}
          onAccepted={() => {
            onOpenChange(false);
            onAccepted?.();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
