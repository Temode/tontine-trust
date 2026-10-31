import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Eye, Loader2, X, ShieldCheck } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  listKycAdminQueue, adminValidateKyc, getKycDocumentSignedUrl,
  DOC_TYPE_LABEL, KYC_LEVEL_LABEL, type KycQueueRow,
} from "@/lib/api/kyc";

export default function KycReview() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pending" | "verified" | "rejected">("pending");
  const [activeDoc, setActiveDoc] = useState<KycQueueRow | null>(null);
  const [note, setNote] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["kyc-admin", tab],
    queryFn: () => listKycAdminQueue(tab),
  });

  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      adminValidateKyc(id, approve, note || undefined),
    onSuccess: (_d, vars) => {
      toast.success(vars.approve ? "Document validé" : "Document refusé");
      setActiveDoc(null); setNote(""); setPreviewUrl(null);
      qc.invalidateQueries({ queryKey: ["kyc-admin"] });
    },
    onError: (e: Error) => toast.error("Action impossible", { description: e.message }),
  });

  const openDoc = async (row: KycQueueRow) => {
    setActiveDoc(row); setNote(""); setPreviewUrl(null);
    try {
      const url = await getKycDocumentSignedUrl(row.storage_path, 300);
      setPreviewUrl(url);
    } catch (e) {
      toast.error("Aperçu indisponible", { description: (e as Error).message });
    }
  };

  return (
    <div className="animate-fade-in">
      <TopBar title="Vérifications KYC" subtitle="File d'attente des pièces d'identité." />
      <div className="space-y-4 px-5 py-6 lg:px-8 lg:py-8">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="pending">À traiter</TabsTrigger>
            <TabsTrigger value="verified">Validés</TabsTrigger>
            <TabsTrigger value="rejected">Refusés</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="mt-4">
            {q.isLoading ? (
              <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (q.data ?? []).length === 0 ? (
              <p className="text-center text-muted-foreground py-12">Aucun document dans cette file.</p>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {q.data!.map((row) => (
                  <Card key={row.document_id} className="cursor-pointer hover:bg-secondary/30"
                    onClick={() => openDoc(row)}>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center justify-between text-base">
                        <span>{row.full_name ?? "Sans nom"}</span>
                        <span className="text-xs font-normal text-muted-foreground">
                          Palier actuel : {KYC_LEVEL_LABEL[row.current_level]}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <p>📄 {DOC_TYPE_LABEL[row.doc_type] ?? row.doc_type}
                        {row.document_number && <span className="text-muted-foreground"> · n° {row.document_number}</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">📞 {row.phone_number ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        Soumis le {new Date(row.created_at).toLocaleString("fr-FR")}
                      </p>
                      {row.review_note && <p className="text-xs text-rose-700">Motif : {row.review_note}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {activeDoc && (
          <Card className="border-primary/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" /> Décision — {activeDoc.full_name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {previewUrl ? (
                previewUrl.match(/\.(pdf)(\?|$)/i) ? (
                  <iframe src={previewUrl} className="h-[500px] w-full rounded border" title="Document" />
                ) : (
                  <img src={previewUrl} alt="Document KYC" className="max-h-[500px] rounded border" />
                )
              ) : (
                <p className="text-sm text-muted-foreground"><Eye className="inline h-4 w-4" /> Chargement de l'aperçu…</p>
              )}
              {activeDoc.status === "pending" && (
                <>
                  <Textarea placeholder="Motif (obligatoire en cas de refus)"
                    value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
                  <div className="flex gap-2">
                    <Button onClick={() => decide.mutate({ id: activeDoc.document_id, approve: true })}
                      disabled={decide.isPending}>
                      <Check className="h-4 w-4 mr-1" /> Valider (Palier {activeDoc.target_level})
                    </Button>
                    <Button variant="destructive"
                      onClick={() => decide.mutate({ id: activeDoc.document_id, approve: false })}
                      disabled={decide.isPending || !note.trim()}>
                      <X className="h-4 w-4 mr-1" /> Refuser
                    </Button>
                    <Button variant="ghost" onClick={() => setActiveDoc(null)}>Fermer</Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}