import { redirect } from "next/navigation";

// The demand ledger has become the pledge book: one public place where the
// support on the record can be read. Old links land there.

export default function DemandPage() {
  redirect("/pledges");
}
