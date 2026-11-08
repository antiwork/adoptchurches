import type { Metadata } from "next";
import Checkout from "@/components/Checkout";

export const metadata: Metadata = {
  title: "The order form · adoptchurches",
  description:
    "A stationer's order form for the buildings in your basket. A demonstration: nothing is charged.",
  robots: { index: false },
};

export default function CheckoutPage() {
  return <Checkout />;
}
