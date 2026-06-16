import "server-only";

/**
 * Timesheet PDF — a client-ready, branded record of tracked time over a
 * date range. Mirrors the visual language of the invoice/receipt PDFs:
 * brand header, summary grid, line-item table, totals, branded footer.
 *
 * The data view-model is assembled in `@/features/time/report`
 * (`buildTimesheetPdfData`) so this template stays a pure render function.
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
  TotalsBlock,
  formatCurrency,
  type TableColumn,
} from "./primitives";
import type { TimesheetPdfData, TimeReportRow } from "@/features/time/report";

const CURRENCY = "INR";

export function TimesheetPdf({ data }: { data: TimesheetPdfData }) {
  const utilPct = `${Math.round(data.utilization * 100)}%`;
  const generated = new Date(data.generatedAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <Document
      title={`Timesheet ${data.rangeLabel}`}
      author={data.brand.businessName}
      subject={`Timesheet for ${data.rangeLabel}`}
    >
      <DocumentPage brand={data.brand}>
        <DocumentHeader
          brand={data.brand}
          eyebrow="TIMESHEET"
          title={data.rangeLabel}
          subtitle={`Generated ${generated}`}
        />

        <MetaGrid
          items={[
            { label: "Total hours", value: data.totalHours.toFixed(2) },
            { label: "Billable value", value: formatCurrency(data.billableAmount, CURRENCY) },
            { label: "Utilization", value: utilPct },
            { label: "Entries", value: String(data.rows.length) },
          ]}
        />

        <Section eyebrow="Entries">
          {data.rows.length === 0 ? (
            <TableCellText muted>No time entries in this range.</TableCellText>
          ) : (
            <LineItemsTable<TimeReportRow>
              brand={data.brand}
              rows={data.rows}
              columns={ENTRY_COLUMNS}
              zebra={false}
            />
          )}
        </Section>

        {data.rows.length > 0 ? (
          <TotalsBlock
            rows={[{ label: "Total hours", value: data.totalHours.toFixed(2) }]}
            grand={{ label: "Billable value", value: formatCurrency(data.billableAmount, CURRENCY) }}
          />
        ) : null}

        <DocumentFooter brand={data.brand} label={`Timesheet · ${data.rangeLabel}`} />
      </DocumentPage>
    </Document>
  );
}

const ENTRY_COLUMNS: TableColumn<TimeReportRow>[] = [
  {
    key: "date",
    header: "Date",
    flex: 1.3,
    render: (r) => <TableCellText>{r.date}</TableCellText>,
  },
  {
    key: "desc",
    header: "Description",
    flex: 3,
    render: (r) => (
      <TableCellText>
        {r.description || "—"}
        {r.invoiced ? "  (invoiced)" : ""}
      </TableCellText>
    ),
  },
  {
    key: "project",
    header: "Project",
    flex: 2,
    render: (r) => (
      <TableCellText muted>
        {r.projectName}
        {r.clientName && r.clientName !== "—" ? ` · ${r.clientName}` : ""}
      </TableCellText>
    ),
  },
  {
    key: "hours",
    header: "Hours",
    flex: 1,
    align: "right",
    render: (r) => <TableCellText align="right">{r.hours.toFixed(2)}</TableCellText>,
  },
  {
    key: "amount",
    header: "Amount",
    flex: 1.3,
    align: "right",
    render: (r) => (
      <TableCellText align="right" bold={r.billable}>
        {r.billable ? formatCurrency(r.amount, CURRENCY) : "—"}
      </TableCellText>
    ),
  },
];
