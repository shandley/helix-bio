import type { AlignmentResult } from "@/lib/bio/align";
import { alignMultiple } from "@/lib/bio/align";

export interface AlignWorkerRequest {
	reads: { name: string; sequence: string; quality?: number[] }[];
	reference: string;
	topology: "circular" | "linear";
}

export type AlignWorkerResponse =
	| { type: "success"; results: (AlignmentResult & { name: string })[] }
	| { type: "error"; message: string };

self.addEventListener("message", (e: MessageEvent<AlignWorkerRequest>) => {
	const { reads, reference, topology } = e.data;
	try {
		const results = alignMultiple(reads, reference, topology);
		const response: AlignWorkerResponse = { type: "success", results };
		self.postMessage(response);
	} catch (err) {
		const response: AlignWorkerResponse = {
			type: "error",
			message: (err as Error).message ?? "Alignment failed",
		};
		self.postMessage(response);
	}
});
