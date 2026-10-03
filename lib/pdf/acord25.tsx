import "server-only";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { Extraction, PolicyType } from "@/lib/domain/types";

/**
 * Renders a certificate of liability insurance in the layout of the ACORD 25
 * form (header, insured and producer blocks, coverages table, description of
 * operations, certificate holder, cancellation). Used to generate synthetic
 * demo certificates from a known extraction so the demo can compare what the
 * model read against what the document says.
 *
 * Not an official ACORD form. Visibly labelled as a sample.
 */

export type CertificateDocument = Extraction & {
  /** Printed under the title so nobody mistakes it for a real certificate. */
  sampleLabel?: string;
  insuredAddress?: string;
  producerAddress?: string;
  certificateHolderAddress?: string;
};

const s = StyleSheet.create({
  page: { padding: 28, fontSize: 7.5, fontFamily: "Helvetica", color: "#111" },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 4 },
  title: { fontSize: 13, fontFamily: "Helvetica-Bold", letterSpacing: 0.5 },
  small: { fontSize: 6.5, color: "#444" },
  box: { borderWidth: 0.8, borderColor: "#111", padding: 4, marginBottom: 3 },
  row: { flexDirection: "row" },
  label: { fontSize: 6, fontFamily: "Helvetica-Bold", color: "#333", marginBottom: 1 },
  value: { fontSize: 7.5 },
  twoCol: { flexDirection: "row", gap: 6 },
  col: { flex: 1 },
  tableHead: { flexDirection: "row", borderBottomWidth: 0.8, borderColor: "#111", paddingBottom: 2, marginBottom: 2 },
  th: { fontSize: 6, fontFamily: "Helvetica-Bold" },
  tr: { flexDirection: "row", borderBottomWidth: 0.4, borderColor: "#888", paddingVertical: 3 },
  td: { fontSize: 7 },
  cType: { width: "24%" },
  cFlag: { width: "6%", textAlign: "center" },
  cNum: { width: "18%" },
  cDate: { width: "10%" },
  cLimits: { width: "26%" },
  mono: { fontFamily: "Courier" },
  sample: { position: "absolute", top: 10, right: 28, fontSize: 8, color: "#9B2C2C", fontFamily: "Helvetica-Bold" },
});

const TYPE_LABEL: Record<PolicyType, string> = {
  gl: "COMMERCIAL GENERAL LIABILITY",
  auto: "AUTOMOBILE LIABILITY",
  wc: "WORKERS COMPENSATION AND EMPLOYERS' LIABILITY",
  umbrella: "UMBRELLA LIAB",
  other: "OTHER",
};

function money(cents?: number | null) {
  if (cents === undefined || cents === null) return "";
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function usDate(iso?: string | null) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

function limitsFor(p: Extraction["policies"][number]): string[] {
  const l = p.limits ?? {};
  switch (p.type) {
    case "gl":
      return [`EACH OCCURRENCE ${money(l.eachOccurrenceCents)}`, `GENERAL AGGREGATE ${money(l.aggregateCents)}`];
    case "auto":
      return [`COMBINED SINGLE LIMIT ${money(l.combinedSingleLimitCents)}`];
    case "wc":
      return ["PER STATUTE", `E.L. EACH ACCIDENT ${money(l.eachAccidentCents)}`];
    case "umbrella":
      return [`EACH OCCURRENCE ${money(l.eachOccurrenceCents)}`];
    default:
      return [money(l.eachOccurrenceCents)];
  }
}

export function CertificatePdf({ doc }: { doc: CertificateDocument }) {
  const cancellation =
    doc.noticeOfCancellationDays && doc.noticeOfCancellationDays > 0
      ? `SHOULD ANY OF THE ABOVE DESCRIBED POLICIES BE CANCELLED BEFORE THE EXPIRATION DATE THEREOF, NOTICE WILL BE DELIVERED IN ACCORDANCE WITH THE POLICY PROVISIONS. ${doc.noticeOfCancellationDays} DAYS NOTICE OF CANCELLATION.`
      : "SHOULD ANY OF THE ABOVE DESCRIBED POLICIES BE CANCELLED BEFORE THE EXPIRATION DATE THEREOF, NOTICE WILL BE DELIVERED IN ACCORDANCE WITH THE POLICY PROVISIONS.";

  return (
    <Document title={`Certificate of Liability Insurance - ${doc.insuredName}`} author={doc.producerName}>
      <Page size="LETTER" style={s.page}>
        <Text style={s.sample}>{doc.sampleLabel ?? "SAMPLE — SYNTHETIC DATA"}</Text>
        <View style={s.titleRow}>
          <Text style={s.title}>CERTIFICATE OF LIABILITY INSURANCE</Text>
          <Text style={s.small}>DATE (MM/DD/YYYY) {usDate(doc.issueDate)}</Text>
        </View>
        <View style={s.box}>
          <Text style={s.small}>
            THIS CERTIFICATE IS ISSUED AS A MATTER OF INFORMATION ONLY AND CONFERS NO RIGHTS UPON THE CERTIFICATE HOLDER. THIS
            CERTIFICATE DOES NOT AFFIRMATIVELY OR NEGATIVELY AMEND, EXTEND OR ALTER THE COVERAGE AFFORDED BY THE POLICIES BELOW.
          </Text>
        </View>

        <View style={s.twoCol}>
          <View style={[s.box, s.col]}>
            <Text style={s.label}>PRODUCER</Text>
            <Text style={s.value}>{doc.producerName}</Text>
            {doc.producerAddress ? <Text style={s.value}>{doc.producerAddress}</Text> : null}
            {doc.producerPhone ? <Text style={s.value}>PHONE: {doc.producerPhone}</Text> : null}
            {doc.producerEmail ? <Text style={s.value}>E-MAIL: {doc.producerEmail}</Text> : null}
          </View>
          <View style={[s.box, s.col]}>
            <Text style={s.label}>INSURER(S) AFFORDING COVERAGE</Text>
            {Array.from(new Set(doc.policies.map((p) => p.insurer))).map((name, i) => (
              <Text key={name} style={s.value}>
                INSURER {String.fromCharCode(65 + i)}: {name}
              </Text>
            ))}
          </View>
        </View>
        <View style={s.box}>
          <Text style={s.label}>INSURED</Text>
          <Text style={s.value}>{doc.insuredName}</Text>
          {doc.insuredAddress ? <Text style={s.value}>{doc.insuredAddress}</Text> : null}
        </View>

        <View style={s.box}>
          <Text style={s.label}>COVERAGES</Text>
          <View style={s.tableHead}>
            <Text style={[s.th, s.cType]}>TYPE OF INSURANCE</Text>
            <Text style={[s.th, s.cFlag]}>ADDL INSD</Text>
            <Text style={[s.th, s.cFlag]}>SUBR WVD</Text>
            <Text style={[s.th, s.cNum]}>POLICY NUMBER</Text>
            <Text style={[s.th, s.cDate]}>POLICY EFF (MM/DD/YYYY)</Text>
            <Text style={[s.th, s.cDate]}>POLICY EXP (MM/DD/YYYY)</Text>
            <Text style={[s.th, s.cLimits]}>LIMITS</Text>
          </View>
          {doc.policies.map((p, i) => (
            <View key={`${p.policyNumber}-${i}`} style={s.tr}>
              <Text style={[s.td, s.cType]}>{TYPE_LABEL[p.type]}</Text>
              <Text style={[s.td, s.cFlag]}>{p.additionalInsured ? "Y" : ""}</Text>
              <Text style={[s.td, s.cFlag]}>{p.waiverOfSubrogation ? "Y" : ""}</Text>
              <Text style={[s.td, s.cNum, s.mono]}>{p.policyNumber}</Text>
              <Text style={[s.td, s.cDate]}>{usDate(p.effectiveDate)}</Text>
              <Text style={[s.td, s.cDate]}>{usDate(p.expirationDate)}</Text>
              <View style={s.cLimits}>
                {limitsFor(p).map((line) => (
                  <Text key={line} style={s.td}>
                    {line}
                  </Text>
                ))}
              </View>
            </View>
          ))}
        </View>

        <View style={s.box}>
          <Text style={s.label}>DESCRIPTION OF OPERATIONS / LOCATIONS / VEHICLES</Text>
          <Text style={s.value}>{doc.descriptionOfOperations}</Text>
        </View>

        <View style={s.twoCol}>
          <View style={[s.box, s.col]}>
            <Text style={s.label}>CERTIFICATE HOLDER</Text>
            <Text style={s.value}>{doc.certificateHolderName}</Text>
            {doc.certificateHolderAddress ? <Text style={s.value}>{doc.certificateHolderAddress}</Text> : null}
          </View>
          <View style={[s.box, s.col]}>
            <Text style={s.label}>CANCELLATION</Text>
            <Text style={s.small}>{cancellation}</Text>
            <Text style={[s.value, { marginTop: 6 }]}>AUTHORIZED REPRESENTATIVE</Text>
          </View>
        </View>
        <Text style={s.small}>Sample certificate generated by CertChase for demonstration. Not an ACORD form. No real insurer or policy.</Text>
      </Page>
    </Document>
  );
}

export async function renderCertificatePdf(doc: CertificateDocument): Promise<Uint8Array> {
  const buffer = await renderToBuffer(<CertificatePdf doc={doc} />);
  return new Uint8Array(buffer);
}
