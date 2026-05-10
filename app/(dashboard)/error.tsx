"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function DashboardError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		console.error(error);
	}, [error]);

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				flex: 1,
				height: "100%",
				gap: "16px",
				fontFamily: "var(--font-courier)",
				padding: "48px 24px",
				textAlign: "center",
			}}
		>
			<p style={{ fontSize: "12px", color: "#1c1a16", letterSpacing: "0.04em" }}>
				Failed to load this page
			</p>
			{error.message && (
				<p
					style={{ fontSize: "10px", color: "#9a9284", letterSpacing: "0.02em", maxWidth: "360px" }}
				>
					{error.message}
				</p>
			)}
			<div style={{ display: "flex", gap: "10px" }}>
				<button
					type="button"
					onClick={reset}
					style={{
						fontFamily: "var(--font-courier)",
						fontSize: "10px",
						letterSpacing: "0.08em",
						textTransform: "uppercase",
						color: "#ffffff",
						background: "#1a4731",
						border: "none",
						padding: "7px 16px",
						borderRadius: "3px",
						cursor: "pointer",
					}}
				>
					Retry
				</button>
				<Link
					href="/dashboard"
					style={{
						fontFamily: "var(--font-courier)",
						fontSize: "10px",
						letterSpacing: "0.08em",
						textTransform: "uppercase",
						color: "#5a5648",
						border: "1px solid #ddd8ce",
						padding: "7px 16px",
						borderRadius: "3px",
						textDecoration: "none",
					}}
				>
					Back to library
				</Link>
			</div>
		</div>
	);
}
