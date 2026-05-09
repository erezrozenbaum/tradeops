"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Newspaper, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NewsItem {
  ticker: string;
  title: string;
  publisher: string;
  url: string;
  published_at: string | null;
  source: string;
}

interface NewsFeedResult {
  items: NewsItem[];
  tickers_checked: number;
}

export default function NewsPage() {
  const investorId = useInvestorId();
  const [data, setData] = useState<NewsFeedResult | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    if (!investorId) return;
    setLoading(true);
    fetch(`/api/v1/investors/${investorId}/news?limit=50`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [investorId]);

  const grouped = data?.items.reduce<Record<string, NewsItem[]>>((acc, item) => {
    (acc[item.ticker] = acc[item.ticker] || []).push(item);
    return acc;
  }, {}) ?? {};

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Newspaper className="h-6 w-6" />
            Holdings News
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Latest news for your holdings and watchlist
            {data && ` · ${data.tickers_checked} tickers tracked`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Fetching news…
        </div>
      )}

      {!loading && (!data || data.items.length === 0) && (
        <Card>
          <CardContent className="py-16 text-center">
            <Newspaper className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">No news found</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add holdings or watchlist items with valid tickers to see news.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && data && Object.entries(grouped).map(([ticker, items]) => (
        <Card key={ticker}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <span className="font-mono text-primary">{ticker}</span>
              <Badge variant="muted" className="text-[10px] py-0">{items[0]?.source}</Badge>
              <span className="text-xs font-normal text-muted-foreground ml-auto">{items.length} article{items.length !== 1 ? "s" : ""}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 divide-y divide-border">
              {items.map((item, i) => (
                <div key={i} className={`${i > 0 ? "pt-4" : ""} space-y-1`}>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2 group"
                  >
                    <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors leading-snug">{item.title}</span>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                  <p className="text-xs text-muted-foreground">
                    {item.publisher}
                    {item.published_at && ` · ${new Date(item.published_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
