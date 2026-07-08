import "server-only";

/**
 * Financial report PDF — a branded Pulse snapshot for a date range.
 * Mirrors the invoice/timesheet PDFs (brand header, summary grid, line
 * tables, footer). Pure render function; data assembled in
 * `@/features/pulse/report` (`buildFinancialReportPdfData`).
 */

import * as React from "react";
import { Document } from "@react-pdf/renderer";
import {
  DocumentFooter,
  DocumentHeader,
  DocumentPage,
  LineItemsTable,
  MetaGrid,
  Section,
  TableCellText,
  formatCurrency,
} from "./primitives";
import type { FinancialReportPdfData } from "@/features/pulse/report";

const CUR = "INR";
const inr = (n: number) => formatCurrency(n, CUR);

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", {
    month: "short",
    year: "2-digit",
  });
}

export function FinancialReportPdf({ data }: { data: FinancialReportPdfData }) {
  const { analytics: a, insights: ins } = data;
  const generated = new Date(data.generatedAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <Document
      title={`Financial report ${data.rangeLabel}`}
      author={data.brand.businessName}
      subject={`Financial report for ${data.rangeLabel}`}
    >
      <DocumentPage brand={data.brand}>
        <DocumentHeader
          brand={data.brand}
          eyebrow="FINANCIAL REPORT"
          title={data.rangeLabel}
          subtitle={`Generated ${generated}`}
        />

        <MetaGrid
          items={[
            { label: "Revenue (paid)", value: inr(a.revenue.paid) },
            { label: "Avg / month", value: inr(a.revenue.averageMonthly) },
            { label: "Outstanding", value: inr(a.receivables.outstandingTotal) },
            {
              label: "Collection rate",
              value:
                a.invoices.collectionRatePct === null
                  ? "-"
                  : `${Math.round(a.invoices.collectionRatePct)}%`,
            },
          ]}
        />

        <MetaGrid
          items={[
            { label: "Issued value", value: inr(a.invoices.issuedTotal) },
            { label: "Overdue", value: inr(a.receivables.overdueTotal) },
            {
              label: "Avg days to pay",
              value: a.cashFlow.avgDaysToPay === null ? "-" : `${a.cashFlow.avgDaysToPay}d`,
            },
            {
              label: "Invoices paid",
              value: `${a.invoices.paidCount}/${a.invoices.issuedCount}`,
            },
            {
              label: "Top client share",
              value:
                ins.concentration.top1Pct === null
                  ? "-"
                  : `${Math.round(ins.concentration.top1Pct)}%`,
            },
          ]}
        />

        <Section eyebrow="Revenue by month">
          <LineItemsTable<{ month: string; paid: number; issued: number; paidInvoices: number; issuedInvoices: number }>
            brand={data.brand}
            rows={a.revenue.series}
            columns={[
              {
                key: "m",
                header: "Month",
                flex: 2,
                render: (r) => <TableCellText>{monthLabel(r.month)}</TableCellText>,
              },
              {
                key: "p",
                header: "Paid",
                flex: 2,
                align: "right",
                render: (r) => <TableCellText align="right" bold>{inr(r.paid)}</TableCellText>,
              },
              {
                key: "i",
                header: "Issued",
                flex: 2,
                align: "right",
                render: (r) => <TableCellText align="right">{inr(r.issued)}</TableCellText>,
              },
              {
                key: "c",
                header: "Paid / issued",
                flex: 1.5,
                align: "right",
                render: (r) => (
                  <TableCellText align="right">
                    {r.paidInvoices}/{r.issuedInvoices}
                  </TableCellText>
                ),
              },
            ]}
            zebra={false}
          />
        </Section>

        <Section eyebrow="Invoice funnel">
          <LineItemsTable<{ stage: string; count: number; rate: string }>
            brand={data.brand}
            rows={[
              { stage: "Issued", count: a.funnel.issued, rate: "100%" },
              {
                stage: "Viewed",
                count: a.funnel.viewed,
                rate:
                  a.funnel.viewedRatePct === null
                    ? "-"
                    : `${Math.round(a.funnel.viewedRatePct)}%`,
              },
              {
                stage: "Paid",
                count: a.funnel.paid,
                rate:
                  a.funnel.paidRatePct === null
                    ? "-"
                    : `${Math.round(a.funnel.paidRatePct)}%`,
              },
            ]}
            columns={[
              { key: "s", header: "Stage", flex: 2, render: (r) => <TableCellText>{r.stage}</TableCellText> },
              { key: "c", header: "Count", flex: 1, align: "right", render: (r) => <TableCellText align="right">{r.count}</TableCellText> },
              { key: "r", header: "Rate", flex: 1, align: "right", render: (r) => <TableCellText align="right">{r.rate}</TableCellText> },
            ]}
            zebra={false}
          />
        </Section>

        <Section eyebrow="Receivables aging">
          <LineItemsTable<{ bucket: string; amount: number }>
            brand={data.brand}
            rows={[
              { bucket: "Current", amount: a.receivables.aging.current },
              { bucket: "1-30 days", amount: a.receivables.aging.d1_30 },
              { bucket: "31-60 days", amount: a.receivables.aging.d31_60 },
              { bucket: "61-90 days", amount: a.receivables.aging.d61_90 },
              { bucket: "90+ days", amount: a.receivables.aging.d90plus },
            ]}
            columns={[
              {
                key: "b",
                header: "Bucket",
                flex: 2,
                render: (r) => <TableCellText>{r.bucket}</TableCellText>,
              },
              {
                key: "a",
                header: "Outstanding",
                flex: 2,
                align: "right",
                render: (r) => <TableCellText align="right">{inr(r.amount)}</TableCellText>,
              },
            ]}
            zebra={false}
          />
        </Section>

        {a.gst.inUse ? (
          <Section eyebrow="GST summary">
            <LineItemsTable<{ rate: number; taxable: number; cgst: number; sgst: number; igst: number; tax: number }>
              brand={data.brand}
              rows={a.gst.byRate}
              columns={[
                { key: "r", header: "Rate", flex: 1, render: (r) => <TableCellText>{r.rate}%</TableCellText> },
                { key: "t", header: "Taxable", flex: 2, align: "right", render: (r) => <TableCellText align="right">{inr(r.taxable)}</TableCellText> },
                { key: "c", header: "CGST", flex: 1.4, align: "right", render: (r) => <TableCellText align="right">{inr(r.cgst)}</TableCellText> },
                { key: "s", header: "SGST", flex: 1.4, align: "right", render: (r) => <TableCellText align="right">{inr(r.sgst)}</TableCellText> },
                { key: "i", header: "IGST", flex: 1.4, align: "right", render: (r) => <TableCellText align="right">{inr(r.igst)}</TableCellText> },
                { key: "x", header: "Tax", flex: 1.6, align: "right", render: (r) => <TableCellText align="right" bold>{inr(r.tax)}</TableCellText> },
              ]}
              zebra={false}
            />
          </Section>
        ) : null}

        <Section eyebrow="Time profitability">
          <LineItemsTable<{ metric: string; value: string }>
            brand={data.brand}
            rows={[
              { metric: "Tracked hours", value: `${(ins.profitability.trackedSeconds / 3600).toFixed(2)}h` },
              { metric: "Billable hours", value: `${(ins.profitability.billableSeconds / 3600).toFixed(2)}h` },
              { metric: "Invoiced time value", value: inr(ins.profitability.invoicedAmount) },
              { metric: "Unbilled time value", value: inr(ins.profitability.unbilledAmount) },
              { metric: "Effective rate", value: `${inr(ins.profitability.effectiveRate)}/hr` },
            ]}
            columns={[
              { key: "m", header: "Metric", flex: 2, render: (r) => <TableCellText>{r.metric}</TableCellText> },
              { key: "v", header: "Value", flex: 2, align: "right", render: (r) => <TableCellText align="right" bold>{r.value}</TableCellText> },
            ]}
            zebra={false}
          />
        </Section>

        {ins.concentration.byClient.length > 0 ? (
          <Section eyebrow="Top clients">
            <LineItemsTable<{ name: string; paid: number; pct: number }>
              brand={data.brand}
              rows={ins.concentration.byClient.slice(0, 10)}
              columns={[
                { key: "n", header: "Client", flex: 3, render: (r) => <TableCellText>{r.name}</TableCellText> },
                { key: "p", header: "Paid", flex: 2, align: "right", render: (r) => <TableCellText align="right" bold>{inr(r.paid)}</TableCellText> },
                { key: "s", header: "Share", flex: 1, align: "right", render: (r) => <TableCellText align="right">{Math.round(r.pct)}%</TableCellText> },
              ]}
              zebra={false}
            />
          </Section>
        ) : null}

        <DocumentFooter brand={data.brand} label={`Financial report - ${data.rangeLabel}`} />
      </DocumentPage>
    </Document>
  );
}
