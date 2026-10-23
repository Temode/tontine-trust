import { Link } from "react-router-dom";
import { XCircle } from "lucide-react";

export default function PaymentCancel() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-5 py-10 text-center">
      <XCircle className="mb-4 h-12 w-12 text-muted-foreground" />
      <h1 className="font-display text-xl font-bold text-foreground">Paiement annulé</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Aucun montant n'a été débité. Vous pouvez réessayer à tout moment.
      </p>
      <Link
        to="/cotisations"
        className="mt-6 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-700"
      >
        Retour à mes cotisations
      </Link>
    </div>
  );
}