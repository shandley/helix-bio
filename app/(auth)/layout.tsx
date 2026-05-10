import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
	return (
		<div
			style={{
				minHeight: "100vh",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				padding: "48px 24px",
				background: "#f5f0e8",
			}}
		>
			{/* Top rule */}
			<div
				style={{
					position: "fixed",
					top: 0,
					left: 0,
					right: 0,
					height: "52px",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					borderBottom: "1px solid #ddd8ce",
					background: "rgba(245,240,232,0.95)",
					backdropFilter: "blur(8px)",
					zIndex: 50,
				}}
			>
				<Link href="/" style={{ textDecoration: "none" }}>
					<span
						style={{
							fontFamily: "var(--font-playfair)",
							fontSize: "24px",
							fontWeight: 400,
							color: "#1c1a16",
							letterSpacing: "-0.01em",
						}}
					>
						Ori
					</span>
				</Link>
			</div>

			<div style={{ paddingTop: "52px", width: "100%", display: "flex", justifyContent: "center" }}>
				{children}
			</div>
		</div>
	);
}
