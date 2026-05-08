"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { logout } from "@/app/actions/auth";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TopNavProps {
	userEmail: string;
}

export function TopNav({ userEmail }: TopNavProps) {
	const router = useRouter();

	return (
		<header style={{
			height: "52px",
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			borderBottom: "1px solid #ddd8ce",
			background: "rgba(245,240,232,0.97)",
			backdropFilter: "blur(8px)",
			padding: "0 24px",
			flexShrink: 0,
		}}>
			<Link href="/dashboard" style={{ textDecoration: "none", display: "flex", alignItems: "baseline", gap: "10px" }}>
				<span style={{
					fontFamily: "var(--font-playfair)",
					fontSize: "22px",
					fontWeight: 400,
					color: "#1c1a16",
					letterSpacing: "-0.01em",
				}}>
					Ori
				</span>
				<span style={{
					fontFamily: "var(--font-courier)",
					fontSize: "9px",
					letterSpacing: "0.12em",
					textTransform: "uppercase",
					color: "#1a4731",
					border: "1px solid rgba(26,71,49,0.35)",
					padding: "2px 7px",
					borderRadius: "2px",
				}}>
					beta
				</span>
			</Link>

			<DropdownMenu>
				<DropdownMenuTrigger style={{
					fontFamily: "var(--font-courier)",
					fontSize: "11px",
					color: "#9a9284",
					letterSpacing: "0.04em",
					background: "none",
					border: "none",
					cursor: "pointer",
					padding: "6px 10px",
					borderRadius: "3px",
					outline: "none",
				}}>
					{userEmail}
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-48">
					<DropdownMenuItem onClick={() => router.push("/dashboard")}>
						My sequences
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						variant="destructive"
						onClick={() => logout()}
					>
						Sign out
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</header>
	);
}
