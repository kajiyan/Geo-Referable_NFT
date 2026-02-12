import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Collection",
  description:
    "Browse your NOROSI NFT collection. View minted locations and their network connections.",
};

export default function CollectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
