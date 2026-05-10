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
				position: "relative",
				overflow: "hidden",
			}}
		>
			{/* Decorative plasmid — faint, bottom-right */}
			<svg
				width="480"
				height="480"
				viewBox="0 0 280 280"
				fill="none"
				aria-hidden
				style={{
					position: "fixed",
					bottom: "-120px",
					right: "-120px",
					opacity: 0.045,
					pointerEvents: "none",
					animation: "spin 120s linear infinite",
				}}
			>
				<circle cx="140" cy="140" r="100" stroke="#1a4731" strokeWidth="14" />
				<path
					d="M 140 40 A 100 100 0 0 1 230 185"
					stroke="#b8933a"
					strokeWidth="14"
					strokeLinecap="round"
					fill="none"
				/>
				<path
					d="M 165 43 A 100 100 0 0 1 227 90"
					stroke="#1a4731"
					strokeWidth="14"
					strokeLinecap="round"
					fill="none"
				/>
				<path
					d="M 230 185 A 100 100 0 0 1 72 210"
					stroke="#2d7a54"
					strokeWidth="14"
					strokeLinecap="round"
					fill="none"
				/>
				<circle cx="140" cy="140" r="3" fill="#ddd8ce" />
			</svg>

			{/* Top bar */}
			<div
				style={{
					position: "fixed",
					top: 0,
					left: 0,
					right: 0,
					height: "52px",
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					borderBottom: "1px solid #ddd8ce",
					background: "rgba(245,240,232,0.97)",
					backdropFilter: "blur(8px)",
					zIndex: 50,
					padding: "0 32px",
				}}
			>
				<Link
					href="/"
					style={{
						textDecoration: "none",
						display: "flex",
						alignItems: "baseline",
						gap: "8px",
					}}
				>
					<span
						style={{
							fontFamily: "var(--font-playfair)",
							fontSize: "22px",
							fontWeight: 400,
							color: "#1c1a16",
							letterSpacing: "-0.01em",
						}}
					>
						Ori
					</span>
					<span
						style={{
							fontFamily: "var(--font-courier)",
							fontSize: "9px",
							fontStyle: "italic",
							color: "#9a9284",
							letterSpacing: "0.04em",
						}}
					>
						molecular workbench
					</span>
				</Link>
				<Link
					href="https://github.com/shandley/ori-bio"
					target="_blank"
					rel="noreferrer"
					style={{
						fontFamily: "var(--font-courier)",
						fontSize: "10px",
						color: "#9a9284",
						textDecoration: "none",
						letterSpacing: "0.04em",
					}}
				>
					GitHub →
				</Link>
			</div>

			<div style={{ paddingTop: "52px", width: "100%", display: "flex", justifyContent: "center" }}>
				{children}
			</div>
		</div>
	);
}
