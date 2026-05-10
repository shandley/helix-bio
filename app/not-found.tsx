import Link from "next/link";

export default function NotFound() {
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
					fontSize: "96px",
					lineHeight: 1,
					color: "#ddd8ce",
					letterSpacing: "-0.04em",
				}}
			>
				404
			</span>
			<p style={{ fontSize: "12px", color: "#5a5648", letterSpacing: "0.04em" }}>
				Sequence not found
			</p>
			<Link
				href="/dashboard"
				style={{
					fontFamily: "var(--font-courier)",
					fontSize: "10px",
					letterSpacing: "0.08em",
					textTransform: "uppercase",
					color: "#1a4731",
					textDecoration: "none",
					borderBottom: "1px solid rgba(26,71,49,0.4)",
					paddingBottom: "1px",
				}}
			>
				Back to library →
			</Link>
		</div>
	);
}
