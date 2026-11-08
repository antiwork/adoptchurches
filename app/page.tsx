import Atlas from "@/components/Atlas";
import { listings } from "@/lib/data";

export default function Home() {
  return (
    <main className="map-main">
      <Atlas listings={listings} />
    </main>
  );
}
