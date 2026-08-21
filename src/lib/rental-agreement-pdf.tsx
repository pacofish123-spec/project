import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { formatDate, formatMoney } from "@/lib/format";

export interface RentalAgreementData {
  bookingId: string;
  createdAt: string;
  startsAt: string;
  endsAt: string;
  pickupLocation: string;
  returnLocation: string;
  total: number;
  currency: string;
  platformFee: number;
  vehicle: {
    make: string;
    model: string;
    year: number;
    locationCity: string;
    countryCode: string;
    transmission?: string | null;
    seats?: number | null;
    fuelPolicy?: string | null;
    cleaningPolicy?: string | null;
  };
  host: { name: string; email: string | null };
  renter: { name: string; email: string | null };
}

const styles = StyleSheet.create({
  page: { padding: 42, fontSize: 10, fontFamily: "Helvetica", color: "#172521" },
  brand: { fontSize: 20, marginBottom: 2, color: "#e96f4c" },
  brandRest: { color: "#172521" },
  subtitle: { fontSize: 9, color: "#647069", marginBottom: 22 },
  sectionTitle: { fontSize: 12, marginTop: 18, marginBottom: 8, paddingBottom: 4, borderBottom: "1 solid #d4dfd6" },
  row: { flexDirection: "row", marginBottom: 5 },
  label: { width: 140, color: "#647069" },
  value: { flex: 1 },
  partyBlock: { flexDirection: "row", gap: 24, marginBottom: 4 },
  partyCol: { flex: 1 },
  partyName: { fontSize: 11, marginBottom: 2 },
  partyMeta: { color: "#647069" },
  terms: { marginTop: 4, lineHeight: 1.5, color: "#3a453f" },
  signRow: { flexDirection: "row", marginTop: 46, gap: 30 },
  signCol: { flex: 1 },
  signLine: { borderTop: "1 solid #172521", marginTop: 34, paddingTop: 4 },
  footer: { position: "absolute", bottom: 28, left: 42, right: 42, fontSize: 8, color: "#9aa79e", textAlign: "center" },
});

function fuelPolicyLabel(value?: string | null) {
  if (value === "as_delivered") return "Return with the same fuel level as delivered";
  if (value === "full_to_full") return "Full-to-full";
  return "Not specified";
}

function cleaningPolicyLabel(value?: string | null) {
  if (value === "return_clean") return "Return as clean as received";
  if (value === "return_dirty_fee") return "May be returned dirty for a cleaning fee";
  return "Not specified";
}

export function RentalAgreementDocument({ data }: { data: RentalAgreementData }) {
  const netToHost = data.total - data.platformFee;
  return (
    <Document title={`yoRento Rental Agreement — ${data.bookingId}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>yo<Text style={styles.brandRest}>Rento</Text></Text>
        <Text style={styles.subtitle}>Rental Agreement · Booking {data.bookingId} · Generated {formatDate(data.createdAt)}</Text>

        <Text style={styles.sectionTitle}>Parties</Text>
        <View style={styles.partyBlock}>
          <View style={styles.partyCol}>
            <Text style={styles.partyMeta}>Host</Text>
            <Text style={styles.partyName}>{data.host.name}</Text>
            <Text style={styles.partyMeta}>{data.host.email ?? "—"}</Text>
          </View>
          <View style={styles.partyCol}>
            <Text style={styles.partyMeta}>Guest</Text>
            <Text style={styles.partyName}>{data.renter.name}</Text>
            <Text style={styles.partyMeta}>{data.renter.email ?? "—"}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Vehicle</Text>
        <View style={styles.row}><Text style={styles.label}>Vehicle</Text><Text style={styles.value}>{data.vehicle.year} {data.vehicle.make} {data.vehicle.model}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Location</Text><Text style={styles.value}>{data.vehicle.locationCity}, {data.vehicle.countryCode}</Text></View>
        {data.vehicle.transmission && <View style={styles.row}><Text style={styles.label}>Transmission</Text><Text style={styles.value}>{data.vehicle.transmission}</Text></View>}
        {data.vehicle.seats != null && <View style={styles.row}><Text style={styles.label}>Seats</Text><Text style={styles.value}>{data.vehicle.seats}</Text></View>}
        <View style={styles.row}><Text style={styles.label}>Fuel policy</Text><Text style={styles.value}>{fuelPolicyLabel(data.vehicle.fuelPolicy)}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Cleaning policy</Text><Text style={styles.value}>{cleaningPolicyLabel(data.vehicle.cleaningPolicy)}</Text></View>

        <Text style={styles.sectionTitle}>Trip Details</Text>
        <View style={styles.row}><Text style={styles.label}>Pick-up</Text><Text style={styles.value}>{formatDate(data.startsAt)} at {data.pickupLocation}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Return</Text><Text style={styles.value}>{formatDate(data.endsAt)} at {data.returnLocation}</Text></View>

        <Text style={styles.sectionTitle}>Payment</Text>
        <View style={styles.row}><Text style={styles.label}>Total charged to Guest</Text><Text style={styles.value}>{formatMoney(data.total, data.currency)}</Text></View>
        <View style={styles.row}><Text style={styles.label}>yoRento platform fee</Text><Text style={styles.value}>{formatMoney(data.platformFee, data.currency)}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Net payout to Host</Text><Text style={styles.value}>{formatMoney(netToHost, data.currency)}</Text></View>

        <Text style={styles.sectionTitle}>Terms</Text>
        <Text style={styles.terms}>
          This Rental Agreement is entered into between the Host and Guest named above for the vehicle, dates, and price stated
          above, and is governed by yoRento&apos;s Terms of Service (yorento.com/terms) and the cancellation policy shown at the
          time of booking. The Guest agrees to return the vehicle at the agreed time and location, in the condition it was
          received (ordinary wear excepted), following the fuel and cleaning policy stated above. Both parties are encouraged to
          complete a condition report with photos at pick-up and return through the yoRento platform; that report may be used as
          evidence if a dispute arises over the vehicle&apos;s condition, mileage, or fuel level. The Guest is responsible for any
          traffic violations, tolls, fines, or damage occurring during the rental period as a result of their use of the vehicle.
        </Text>

        <View style={styles.signRow}>
          <View style={styles.signCol}><Text style={styles.signLine}>Host signature / date</Text></View>
          <View style={styles.signCol}><Text style={styles.signLine}>Guest signature / date</Text></View>
        </View>

        <Text style={styles.footer}>yoRento — Dominican Republic · This document was generated automatically when the booking was approved.</Text>
      </Page>
    </Document>
  );
}

export async function generateRentalAgreementPdf(data: RentalAgreementData): Promise<Buffer> {
  return renderToBuffer(<RentalAgreementDocument data={data} />);
}
