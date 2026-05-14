"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function useInvestorId(): string | null {
  const [investorId, setInvestorId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("tradeops_token");
    const id = localStorage.getItem("tradeops_investor_id");
    if (!token || !id) {
      router.push("/login");
    } else {
      setInvestorId(id);
    }
  }, [router]);

  return investorId;
}
