import { QrScanClient } from "@/components/goyuin/QrScanClient";

/** QR（擬似スキャン）。本物のカメラは使わない */
export default function QrPage() {
  return <QrScanClient />;
}
