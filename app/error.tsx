"use client";

import { useEffect } from "react";

export default function GlobalError({
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
				minHeight: "100vh",
				gap: "20px",
				fontFamily: "var(--font-courier)",
				background: "#f5f0e8",
				padding: "48px 24px",
				textAlign: "center",
			}}
		>
			<span
				style={{
					fontFamily: "var(--font-playfair)",
					fontSize: "64px",
					lineHeight: 1,
					color: "#ddd8ce",
				}}
			>
				!
			</span>
			<div>
				<p
					style={{
						fontSize: "13px",
						color: "#1c1a16",
						letterSpacing: "0.04em",
						marginBottom: "6px",
					}}
				>
					Something went wrong
				</p>
				{error.digest && (
					<p style={{ fontSize: "10px", color: "#9a9284", letterSpacing: "0.08em" }}>
						Error ID: {error.digest}
					</p>
				)}
			</div>
			<button
				type="button"
				onClick={reset}
				style={{
					fontFamily: "var(--font-courier)",
					fontSize: "11px",
					letterSpacing: "0.08em",
					textTransform: "uppercase",
					color: "#ffffff",
					background: "#1a4731",
					border: "none",
					padding: "8px 20px",
					borderRadius: "3px",
					cursor: "pointer",
				}}
			>
				Try again
			</button>
		</div>
	);
}
