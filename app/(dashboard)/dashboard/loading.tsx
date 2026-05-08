export default function DashboardLoading() {
	return (
		<div style={{ padding: "32px 40px" }}>
			{/* Header skeleton */}
			<div style={{
				display: "flex",
				justifyContent: "space-between",
				alignItems: "center",
				marginBottom: "28px",
			}}>
				<div style={{ width: "120px", height: "14px", background: "#ece6d8", borderRadius: "2px" }} />
				<div style={{ width: "90px", height: "28px", background: "#ece6d8", borderRadius: "3px" }} />
			</div>

			{/* Search bar skeleton */}
			<div style={{ width: "260px", height: "30px", background: "#ece6d8", borderRadius: "3px", marginBottom: "20px" }} />

			{/* Row skeletons */}
			{Array.from({ length: 5 }).map((_, i) => (
				<div
					key={i}
					style={{
						display: "flex",
						alignItems: "center",
						gap: "16px",
						padding: "14px 0",
						borderBottom: "1px solid #ece6d8",
						opacity: 1 - i * 0.15,
					}}
				>
					<div style={{ width: "200px", height: "12px", background: "#ece6d8", borderRadius: "2px" }} />
					<div style={{ width: "60px", height: "12px", background: "#ece6d8", borderRadius: "2px", marginLeft: "auto" }} />
					<div style={{ width: "50px", height: "12px", background: "#ece6d8", borderRadius: "2px" }} />
					<div style={{ width: "40px", height: "12px", background: "#ece6d8", borderRadius: "2px" }} />
				</div>
			))}
		</div>
	);
}
