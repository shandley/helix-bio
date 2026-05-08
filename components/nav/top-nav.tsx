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
		<header className="flex h-12 shrink-0 items-center justify-between border-b border-border/40 bg-background px-4">
			<Link href="/dashboard" className="flex items-center gap-2">
				<span className="font-semibold tracking-tight">Ori</span>
				<span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600">
					beta
				</span>
			</Link>

			<DropdownMenu>
				<DropdownMenuTrigger className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors outline-none">
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
