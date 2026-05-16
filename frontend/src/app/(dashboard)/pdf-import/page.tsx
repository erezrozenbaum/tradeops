"use client";

import { useCallback, useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileUp, CheckCircle2, XCircle, RefreshCw, Info,
  FileText, Building2, AlertTriangle,
} from "lucide-react";

interface ParsedHolding {
  name: string;
  ticker: string | null;
  isin: string | null;
  asset_type: string;
  quantity: number;
  avg_buy_price: number;
  current_value: number | null;
  currency: string;
  notes: string | null;
}

interface PDFImportResult {
  broker_name: string | null;
  statement_date: string | null;
  currency: string | null;
  holdings: ParsedHolding[];
  raw_text_length: number;
  pages_parsed: number;
  parse_notes: string | null;
}

interface Account {
  id: string;
  provider_name: string;
  account_name: string | null;
  account_type: string;
  currency: string;
}

const ASSET_TYPE_COLORS: Record<string, string> = {
  stock:   "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200",
  etf:     "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200",
  bond:    "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200",
  fund:    "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200",
  crypto:  "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200",
  other:   "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-200",
};

function fmt(n: number | null, currency: string) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

export default function PDFImportPage() {
  const investorId = useInvestorId();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<PDFImportResult | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!investorId) return;
    fetch(`/api/v1/investors/${investorId}/holdings/accounts`)
      .then(r => r.ok ? r.json() : [])
      .then(setAccounts);
  }, [investorId]);

  const handleFile = useCallback((f: File) => {
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are accepted.");
      return;
    }
    setFile(f);
    setResult(null);
    setImportResult(null);
    setError(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  async function parsePDF() {
    if (!investorId || !file) return;
    setParsing(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch(`/api/v1/investors/${investorId}/pdf-import/parse`, {
        method: "POST",
        body: form,
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(d.detail ?? "Parse failed — check the PDF and try again.");
        return;
      }
      setResult(await r.json());
    } catch {
      setError("Network error — please try again.");
    } finally {
      setParsing(false);
    }
  }

  async function importHoldings() {
    if (!investorId || !file || !selectedAccount) return;
    setImporting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("account_id", selectedAccount);
      const r = await fetch(`/api/v1/investors/${investorId}/pdf-import/import`, {
        method: "POST",
        body: form,
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(d.detail ?? "Import failed.");
        return;
      }
      const data = await r.json();
      setImportResult({ imported: data.imported, skipped: data.skipped });
    } catch {
      setError("Network error during import.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <FileUp className="h-5 w-5 text-blue-500" />
          PDF Statement Import
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Upload any broker PDF statement — AI will extract your holdings automatically.
        </p>
      </div>

      {/* Info */}
      <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 p-3.5">
        <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
          Works with Interactive Brokers, eToro, Schwab, Fidelity, and most other brokers.
          The AI reads the PDF text to extract ticker, quantity, and value — review the results before importing.
          Scanned image PDFs are not supported (text-based PDFs only).
        </p>
      </div>

      {/* Upload */}
      <Card>
        <CardHeader><CardTitle className="text-base">Upload Statement</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div
            className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 transition-colors cursor-pointer
              ${dragOver ? "border-blue-400 bg-blue-50/50 dark:bg-blue-950/20" : "border-border hover:border-blue-300"}
            `}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById("pdf-input")?.click()}
          >
            <FileText className="h-8 w-8 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium">
                {file ? file.name : "Drag & drop your PDF here"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {file ? `${(file.size / 1024).toFixed(0)} KB` : "or click to browse — PDF only, max 10 MB"}
              </p>
            </div>
            <input
              id="pdf-input"
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>

          {file && !result && (
            <Button className="w-full" onClick={parsePDF} disabled={parsing}>
              {parsing
                ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Analyzing PDF…</>
                : <><FileUp className="h-4 w-4 mr-2" /> Extract Holdings</>
              }
            </Button>
          )}

          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5" /> {error}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* Statement metadata */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {result.broker_name ?? "Unknown Broker"}
                </CardTitle>
                <span className="text-sm text-muted-foreground">
                  {result.statement_date ?? "Date unknown"} · {result.pages_parsed} page{result.pages_parsed !== 1 ? "s" : ""}
                </span>
              </div>
            </CardHeader>
            {result.parse_notes && (
              <CardContent>
                <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  {result.parse_notes}
                </div>
              </CardContent>
            )}
          </Card>

          {/* Holdings table */}
          {result.holdings.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No holdings were extracted. The PDF may not contain a recognizable holdings table.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Extracted Holdings ({result.holdings.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Name</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Type</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Qty</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Avg Price</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Market Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.holdings.map((h, i) => (
                        <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-3">
                            <div className="font-medium truncate max-w-[200px]">{h.name}</div>
                            {(h.ticker || h.isin) && (
                              <div className="text-xs text-muted-foreground font-mono">
                                {h.ticker ?? h.isin}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-semibold ${ASSET_TYPE_COLORS[h.asset_type] ?? ASSET_TYPE_COLORS.other}`}>
                              {h.asset_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs">
                            {h.quantity > 0 ? h.quantity.toLocaleString() : "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs">
                            {h.avg_buy_price > 0 ? fmt(h.avg_buy_price, h.currency) : "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs">
                            {fmt(h.current_value, h.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Import section */}
          {result.holdings.length > 0 && !importResult && (
            <Card className="border-emerald-200 dark:border-emerald-900">
              <CardHeader><CardTitle className="text-base">Import to Account</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Destination account</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={selectedAccount}
                    onChange={e => setSelectedAccount(e.target.value)}
                  >
                    <option value="">Select an account…</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.provider_name}{a.account_name ? ` — ${a.account_name}` : ""} ({a.account_type}, {a.currency})
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-muted-foreground">
                  All {result.holdings.length} extracted holdings will be added to the selected account. Existing holdings are not modified.
                </p>
                <Button
                  className="w-full"
                  onClick={importHoldings}
                  disabled={importing || !selectedAccount}
                >
                  {importing
                    ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Importing…</>
                    : <>Import {result.holdings.length} holdings</>
                  }
                </Button>
              </CardContent>
            </Card>
          )}

          {importResult && (
            <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 p-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  Import complete — {importResult.imported} holdings added
                </p>
                {importResult.skipped > 0 && (
                  <p className="text-xs text-muted-foreground">{importResult.skipped} skipped (missing required fields)</p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
