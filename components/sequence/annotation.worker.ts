import type { Annotation, CanonicalFeature } from "../../lib/bio/annotate";
import { annotate } from "../../lib/bio/annotate";

interface AnnotationRequest {
	seq: string;
}

type AnnotationResponse =
	| { type: "success"; annotations: Annotation[]; elapsed: number }
	| { type: "error"; message: string };

// Cache the loaded feature database across calls within the same worker lifetime
let featureCache: CanonicalFeature[] | null = null;

async function loadFeatures(): Promise<CanonicalFeature[]> {
	if (featureCache) return featureCache;
	const resp = await fetch("/data/features.json");
	if (!resp.ok) throw new Error(`Failed to load feature database: ${resp.status}`);
	featureCache = (await resp.json()) as CanonicalFeature[];
	return featureCache;
}

self.addEventListener("message", async (e: MessageEvent<AnnotationRequest>) => {
	const { seq } = e.data;
	const t0 = performance.now();
	try {
		const features = await loadFeatures();
		const annotations = annotate(seq, features);
		const elapsed = Math.round(performance.now() - t0);
		const response: AnnotationResponse = { type: "success", annotations, elapsed };
		self.postMessage(response);
	} catch (err) {
		const response: AnnotationResponse = {
			type: "error",
			message: (err as Error).message ?? "Annotation failed",
		};
		self.postMessage(response);
	}
});
