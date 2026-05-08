import Link from "next/link";

export default function LandingPage() {
	return (
		<div className="flex min-h-full flex-col" style={{ backgroundImage: "none" }}>

			{/* NAV */}
			<header className="fixed top-0 left-0 right-0 z-50 flex h-15 items-center justify-between border-b border-border bg-[#f5f0e8]/95 px-14 backdrop-blur-sm"
				style={{ height: "60px" }}>
				<div className="flex items-baseline gap-3">
					<span style={{ fontFamily: "var(--font-playfair)", fontSize: "26px", fontWeight: 400, letterSpacing: "-0.01em", color: "#1c1a16" }}>
						Ori
					</span>
					<span style={{ fontFamily: "var(--font-courier)", fontSize: "10px", fontStyle: "italic", color: "#9a9284", letterSpacing: "0.04em" }}>
						molecular workbench
					</span>
				</div>
				<nav className="flex items-center gap-8">
					<Link href="#features" style={{ fontFamily: "var(--font-karla)", fontSize: "13px", color: "#5a5648", textDecoration: "none" }}>
						Features
					</Link>
					<Link href="#database" style={{ fontFamily: "var(--font-karla)", fontSize: "13px", color: "#5a5648", textDecoration: "none" }}>
						Database
					</Link>
				</nav>
				<div className="flex items-center gap-4">
					<Link href="/login" style={{ fontFamily: "var(--font-karla)", fontSize: "13px", color: "#5a5648", textDecoration: "none" }}>
						Sign in
					</Link>
					<Link
						href="/signup"
						style={{
							fontFamily: "var(--font-karla)",
							fontSize: "13px",
							fontWeight: 500,
							background: "#1a4731",
							color: "white",
							textDecoration: "none",
							padding: "8px 22px",
							borderRadius: "4px",
							letterSpacing: "0.02em",
						}}
					>
						Get started
					</Link>
				</div>
			</header>

			{/* HERO */}
			<main style={{ paddingTop: "60px" }}>

				{/* Rule strip */}
				<div style={{
					display: "flex",
					alignItems: "center",
					margin: "0 56px",
					padding: "14px 0",
					borderBottom: "2px solid #1c1a16",
					marginTop: "48px",
				}}>
					<span style={{ fontFamily: "var(--font-courier)", fontSize: "10px", letterSpacing: "0.12em", color: "#5a5648", marginRight: "auto" }}>
						VOL. 1 · ISSUE 1
					</span>
					<span style={{ fontFamily: "var(--font-courier)", fontSize: "10px", letterSpacing: "0.12em", color: "#5a5648", flex: 1, textAlign: "center" }}>
						ORI — OPEN MOLECULAR WORKBENCH
					</span>
					<span style={{ fontFamily: "var(--font-courier)", fontSize: "10px", letterSpacing: "0.08em", color: "#5a5648", marginLeft: "auto" }}>
						2026
					</span>
				</div>

				{/* Asymmetric hero grid */}
				<div style={{
					display: "grid",
					gridTemplateColumns: "48px 1fr 380px 56px",
					minHeight: "calc(100vh - 160px)",
				}}>
					{/* Left vertical aside */}
					<div style={{
						writingMode: "vertical-rl",
						textOrientation: "mixed",
						transform: "rotate(180deg)",
						fontFamily: "var(--font-courier)",
						fontSize: "9px",
						letterSpacing: "0.14em",
						textTransform: "uppercase",
						color: "#9a9284",
						borderRight: "1px solid #ddd8ce",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						paddingTop: "8px",
					}}>
						Molecular Biology
					</div>

					{/* Main hero content */}
					<div style={{ padding: "52px 60px 52px 52px" }}>
						<div style={{
							display: "flex",
							alignItems: "center",
							gap: "10px",
							fontFamily: "var(--font-courier)",
							fontSize: "10px",
							letterSpacing: "0.16em",
							textTransform: "uppercase",
							color: "#1a4731",
							marginBottom: "20px",
						}}>
							<span style={{ display: "inline-block", width: "32px", height: "1px", background: "#1a4731" }} />
							Open-source · AI-powered
						</div>

						<h1 style={{
							fontFamily: "var(--font-playfair)",
							fontSize: "clamp(48px, 5.5vw, 76px)",
							fontWeight: 400,
							lineHeight: 1.02,
							letterSpacing: "-0.025em",
							color: "#1c1a16",
							marginBottom: "24px",
						}}>
							The open<br />lab bench for<br />
							<em style={{ fontStyle: "italic", color: "#1a4731" }}>molecular biology</em>
						</h1>

						<p style={{
							fontFamily: "var(--font-karla)",
							fontSize: "17px",
							fontWeight: 300,
							lineHeight: 1.7,
							color: "#5a5648",
							maxWidth: "480px",
							marginBottom: "36px",
							borderLeft: "3px solid #b8933a",
							paddingLeft: "20px",
						}}>
							Visualize plasmids with richly annotated maps. Detect features with profile HMMs that catch variants BLAST misses. Simulate cloning workflows with AI assistance — all free, forever.
						</p>

						<div style={{ display: "flex", alignItems: "center", gap: "24px", marginBottom: "48px" }}>
							<Link
								href="/signup"
								style={{
									display: "inline-flex",
									alignItems: "center",
									gap: "8px",
									background: "#1a4731",
									color: "white",
									fontFamily: "var(--font-karla)",
									fontSize: "14px",
									fontWeight: 500,
									padding: "13px 32px",
									borderRadius: "4px",
									textDecoration: "none",
									letterSpacing: "0.02em",
								}}
							>
								Begin sequencing
								<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
									<path d="M3 8h10M9 4l4 4-4 4"/>
								</svg>
							</Link>
							<a
								href="https://github.com/shandley/ori-bio"
								target="_blank"
								rel="noreferrer"
								style={{
									fontFamily: "var(--font-karla)",
									fontSize: "13px",
									color: "#5a5648",
									textDecoration: "none",
									borderBottom: "1px solid #b8b0a4",
									paddingBottom: "2px",
									letterSpacing: "0.02em",
								}}
							>
								GitHub repository →
							</a>
						</div>

						<div style={{
							display: "flex",
							alignItems: "center",
							gap: "16px",
							paddingTop: "24px",
							borderTop: "1px solid #ddd8ce",
							fontFamily: "var(--font-courier)",
							fontSize: "10px",
							color: "#9a9284",
							letterSpacing: "0.06em",
							flexWrap: "wrap",
						}}>
							{["Next.js 15", "Supabase", "HMMER3", "SeqViz", "Open source · MIT"].map((item, i) => (
								<span key={item} style={{ display: "flex", alignItems: "center", gap: "16px" }}>
									{i > 0 && <span style={{ color: "#b8b0a4" }}>·</span>}
									{item}
								</span>
							))}
						</div>
					</div>

					{/* Sidebar */}
					<div style={{
						borderLeft: "1px solid #b8b0a4",
						padding: "52px 28px",
					}}>
						<div style={{
							fontFamily: "var(--font-courier)",
							fontSize: "9px",
							letterSpacing: "0.14em",
							textTransform: "uppercase",
							color: "#9a9284",
							marginBottom: "16px",
							paddingBottom: "10px",
							borderBottom: "1px solid #ddd8ce",
						}}>
							Live annotation · pUC19
						</div>

						{/* Rotating plasmid SVG */}
						<div style={{ marginBottom: "24px", display: "flex", justifyContent: "center" }}>
							<svg
								width="280"
								height="280"
								viewBox="0 0 280 280"
								fill="none"
								xmlns="http://www.w3.org/2000/svg"
								style={{ animation: "spin 80s linear infinite" }}
							>
								<style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
								{/* Backbone */}
								<circle cx="140" cy="140" r="100" stroke="#ddd8ce" strokeWidth="16" />
								{/* AmpR */}
								<path d="M 140 40 A 100 100 0 0 1 230 185" stroke="#b8933a" strokeWidth="16" strokeLinecap="round" fill="none"/>
								{/* lacZ */}
								<path d="M 165 43 A 100 100 0 0 1 227 90" stroke="#1a4731" strokeWidth="16" strokeLinecap="round" fill="none"/>
								{/* rep_origin */}
								<path d="M 230 185 A 100 100 0 0 1 72 210" stroke="#2d7a54" strokeWidth="16" strokeLinecap="round" fill="none"/>
								{/* MCS */}
								<path d="M 140 40 A 100 100 0 0 0 116 42" stroke="#8b3a2a" strokeWidth="16" strokeLinecap="round" fill="none"/>
								{/* Ticks */}
								<line x1="140" y1="30" x2="140" y2="22" stroke="#9a9284" strokeWidth="1"/>
								<line x1="250" y1="140" x2="258" y2="140" stroke="#9a9284" strokeWidth="1"/>
								<line x1="140" y1="250" x2="140" y2="258" stroke="#9a9284" strokeWidth="1"/>
								<line x1="30" y1="140" x2="22" y2="140" stroke="#9a9284" strokeWidth="1"/>
								{/* Center */}
								<circle cx="140" cy="140" r="4" fill="#ddd8ce"/>
							</svg>
						</div>

						{/* Facts */}
						{[
							{ label: "Features detected", value: "6", sub: "via profile HMM" },
							{ label: "Database size", value: "2,700+", sub: "curated plasmids" },
							{ label: "Topology", value: "Circular", sub: "2686 bp · ColE1 ori" },
						].map((fact) => (
							<div key={fact.label} style={{
								padding: "12px 0",
								borderBottom: "1px solid #ddd8ce",
							}}>
								<div style={{ fontFamily: "var(--font-courier)", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a9284", marginBottom: "4px" }}>
									{fact.label}
								</div>
								<div style={{ fontFamily: "var(--font-playfair)", fontSize: "20px", color: "#1c1a16", fontWeight: 400 }}>
									{fact.value}
								</div>
								<div style={{ fontFamily: "var(--font-karla)", fontSize: "11px", color: "#9a9284", marginTop: "2px" }}>
									{fact.sub}
								</div>
							</div>
						))}
					</div>

					<div /> {/* spacer */}
				</div>

				{/* FEATURES SECTION */}
				<section id="features" style={{
					padding: "80px 56px",
					borderTop: "2px solid #1c1a16",
				}}>
					<div style={{
						display: "flex",
						alignItems: "baseline",
						gap: "24px",
						marginBottom: "48px",
						paddingBottom: "20px",
						borderBottom: "1px solid #b8b0a4",
					}}>
						<h2 style={{
							fontFamily: "var(--font-playfair)",
							fontSize: "32px",
							fontWeight: 400,
							letterSpacing: "-0.01em",
							color: "#1c1a16",
						}}>
							Platform capabilities
						</h2>
						<p style={{
							fontFamily: "var(--font-karla)",
							fontSize: "14px",
							color: "#5a5648",
							lineHeight: 1.6,
							maxWidth: "360px",
							fontWeight: 300,
						}}>
							Built for researchers who need precision and full access — without a $350/year subscription.
						</p>
					</div>

					<div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}>
						{[
							{
								num: "01",
								title: "Sequence Visualization",
								desc: "Circular and linear plasmid maps with color-coded feature annotations, restriction enzyme digest sites, and primer binding locations.",
								tag: "GenBank · FASTA · .dna",
							},
							{
								num: "02",
								title: "Feature Annotation",
								desc: "Profile HMM database built from 200,000+ annotated plasmids. Catches codon-optimized variants and mutants that traditional BLAST misses.",
								tag: "HMMER3 · MMseqs2",
							},
							{
								num: "03",
								title: "AI Co-pilot",
								desc: "Describe your cloning goal. Get restriction enzyme strategies, Gibson assembly designs, and primer sequences — algorithmically verified.",
								tag: "Claude API",
							},
						].map((f, i) => (
							<div
								key={f.num}
								style={{
									padding: i === 0 ? "32px 36px 32px 0" : i === 2 ? "32px 0 32px 36px" : "32px 36px",
									borderRight: i < 2 ? "1px solid #ddd8ce" : "none",
								}}
							>
								<div style={{
									fontFamily: "var(--font-playfair)",
									fontSize: "52px",
									fontWeight: 400,
									color: "#ddd8ce",
									lineHeight: 1,
									marginBottom: "16px",
								}}>
									{f.num}
								</div>
								<h3 style={{
									fontFamily: "var(--font-playfair)",
									fontSize: "20px",
									fontWeight: 500,
									marginBottom: "12px",
									color: "#1c1a16",
									letterSpacing: "-0.01em",
								}}>
									{f.title}
								</h3>
								<p style={{
									fontFamily: "var(--font-karla)",
									fontSize: "13px",
									lineHeight: 1.7,
									color: "#5a5648",
									fontWeight: 300,
								}}>
									{f.desc}
								</p>
								<span style={{
									display: "inline-block",
									marginTop: "16px",
									fontFamily: "var(--font-courier)",
									fontSize: "9px",
									letterSpacing: "0.1em",
									textTransform: "uppercase",
									color: "#1a4731",
									border: "1px solid #1a4731",
									padding: "3px 8px",
									borderRadius: "2px",
								}}>
									{f.tag}
								</span>
							</div>
						))}
					</div>
				</section>
			</main>

			{/* FOOTER */}
			<footer style={{
				padding: "24px 56px",
				borderTop: "2px solid #1c1a16",
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
			}}>
				<span style={{ fontFamily: "var(--font-playfair)", fontSize: "22px", color: "#1c1a16" }}>
					Ori
				</span>
				<span style={{ fontFamily: "var(--font-courier)", fontSize: "10px", color: "#9a9284", letterSpacing: "0.06em" }}>
					Open-source molecular workbench · MIT License · Next.js · Supabase · SeqViz
				</span>
			</footer>
		</div>
	);
}
