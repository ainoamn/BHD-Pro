import { RestoShell } from "@/components/resto/resto-shell";

export default function RestoLayout({ children }: { children: React.ReactNode }) {
  return <RestoShell>{children}</RestoShell>;
}
