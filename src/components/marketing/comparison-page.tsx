import * as React from "react";
import { Check, X, Minus, ExternalLink } from "lucide-react";

type CellValue = boolean | string;

interface ComparisonRow {
  feature?: string;
  stackivo?: CellValue;
  competitor?: CellValue;
  category?: string;
}

interface CompetitorConfig {
  id: string;
  name: string;
  logo?: string;
  website: string;
  tagline: string;
  pricing: {
    free?: string;
    starter?: string;
    pro?: string;
    business?: string;
  };
  targetAudience: string;
  strengths: string[];
  weaknesses: string[];
}

interface ComparisonPageData {
  competitor: CompetitorConfig;
  rows: ComparisonRow[];
  summary: {
    stackivoWins: string[];
    competitorWins: string[];
    neutral: string[];
  };
  verdict: string;
}

function Cell({ value, highlight = false }: { value: CellValue; highlight?: boolean }) {
  if (value === true) {
    return (
      <td className={`px-4 py-3 ${highlight ? "bg-success-subtle font-medium text-success-strong" : "text-foreground"}`}>
        <Check className="h-4 w-4 mx-auto" />
      </td>
    );
  }
  if (value === false) {
    return (
      <td className="px-4 py-3 text-muted-foreground">
        <X className="h-4 w-4 mx-auto opacity-50" />
      </td>
    );
  }
  if (typeof value === "string" && (value === "5 clients" || value === "Limited" || value === "Mobile only" || value === "14-day trial")) {
    return (
      <td className={`px-4 py-3 text-xs ${highlight ? "bg-success-subtle font-medium text-success-strong" : "text-muted-foreground"}`}>
        {value}
      </td>
    );
  }
  return (
    <td className={`px-4 py-3 text-xs ${highlight ? "bg-success-subtle font-medium text-success-strong" : "text-muted-foreground"}`}>
      {value}
    </td>
  );
}

function CategoryRow({ heading }: { heading: string }) {
  return (
    <tr className="border-b bg-muted/30">
      <td colSpan={3} className="px-4 py-2.5 text-micro font-bold uppercase tracking-widest text-muted-foreground">
        {heading}
      </td>
    </tr>
  );
}

export function ComparisonTable({ 
  rows, 
  competitorName 
}: { 
  rows: ComparisonRow[]; 
  competitorName: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-3 text-micro font-semibold uppercase tracking-wider text-muted-foreground">
                Feature
              </th>
              <th className="px-4 py-3 text-micro font-semibold uppercase tracking-wider text-foreground">
                Stackivo
              </th>
              <th className="px-4 py-3 text-micro font-semibold uppercase tracking-wider text-muted-foreground">
                {competitorName}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              if (row.category) {
                return (
                  <React.Fragment key={`category-${row.category}`}>
                    <CategoryRow heading={row.category} />
                    <tr key={row.feature} className={i < rows.length - 1 ? "border-b border-border/40" : ""}>
                      <td className="px-4 py-3 font-medium">{row.feature}</td>
<Cell value={row.stackivo ?? false} highlight />
<Cell value={row.competitor ?? false} />
                    </tr>
                  </React.Fragment>
                );
              }
              return (
                <tr key={row.feature} className={i < rows.length - 1 ? "border-b border-border/40" : ""}>
                  <td className="px-4 py-3 font-medium">{row.feature}</td>
<Cell value={row.stackivo ?? false} highlight />
                      <Cell value={row.competitor ?? false} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
        Comparison reflects publicly-listed features at time of writing. Each product evolves — verify on their respective sites.
      </p>
    </div>
  );
}

export function ComparisonHero({ 
  competitorName, 
  competitorTagline, 
  competitorWebsite 
}: { 
  competitorName: string; 
  competitorTagline: string;
  competitorWebsite: string;
}) {
  return (
    <header className="mx-auto max-w-4xl px-5 sm:px-8 lg:px-10 pt-16 pb-12 sm:pt-20 sm:pb-16 text-center">
      <p className="mb-4 font-mono text-micro uppercase tracking-[0.16em] text-primary">
        Detailed comparison
      </p>
      <h1 className="mb-6 text-balance text-4xl font-display font-semibold tracking-[-0.045em] sm:text-5xl lg:text-6xl">
        Stackivo vs {competitorName}
      </h1>
      <p className="mx-auto max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
        {competitorTagline}
      </p>
      <div className="mt-8 flex items-center justify-center gap-4">
        <a
          href={competitorWebsite}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary/5"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Visit {competitorName}
        </a>
      </div>
    </header>
  );
}

export function ComparisonSummary({ 
  stackivoWins, 
  competitorWins, 
  neutral 
}: { 
  stackivoWins: string[];
  competitorWins: string[];
  neutral: string[];
}) {
  return (
    <div className="mx-auto max-w-4xl grid gap-6 sm:grid-cols-3">
      <div className="rounded-lg border bg-success-subtle p-6">
        <h3 className="flex items-center gap-2 mb-3 font-semibold text-success-strong">
          <Check className="h-4 w-4" />
          Where Stackivo wins
        </h3>
        <ul className="space-y-2 text-sm text-success-strong">
          {stackivoWins.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <Check className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-lg border bg-destructive-subtle p-6">
        <h3 className="flex items-center gap-2 mb-3 font-semibold text-destructive-strong">
          <X className="h-4 w-4" />
          {competitorWins.length > 0 ? "competitor" : "Stackivo"} wins
        </h3>
        <ul className="space-y-2 text-sm text-destructive-strong">
          {(competitorWins.length > 0 ? competitorWins : ["None significant"]).map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <X className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-lg border bg-muted/40 p-6">
        <h3 className="flex items-center gap-2 mb-3 font-semibold text-muted-foreground">
          <Minus className="h-4 w-4" />
          Parity / depends on needs
        </h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {neutral.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <Minus className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ComparisonVerdict({ verdict }: { verdict: string }) {
  return (
    <div className="mx-auto max-w-4xl rounded-lg border border-primary/20 bg-primary/5 p-6">
      <h3 className="mb-3 font-semibold text-primary">Our take</h3>
      <p className="text-sm leading-7 text-muted-foreground">{verdict}</p>
    </div>
  );
}

export function FAQSchema({ faqs }: { faqs: Array<{ q: string; a: string }> }) {
  if (typeof window !== "undefined") return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      }}
    />
  );
}