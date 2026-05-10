import type { PCROptions, PCRResult, QPCROptions, QPCRResult } from "@shandley/primd";
import { designPCR, designQPCR } from "@shandley/primd";

export interface PrimerWorkerRequest {
	seq: string;
	regionStart: number;
	regionEnd: number;
	opts: PCROptions;
	mode?: "pcr" | "qpcr";
}

export type PrimerWorkerResponse =
	| { type: "success"; result: PCRResult | QPCRResult; mode: "pcr" | "qpcr" }
	| { type: "error"; message: string };

self.addEventListener("message", (e: MessageEvent<PrimerWorkerRequest>) => {
	const { seq, regionStart, regionEnd, opts, mode = "pcr" } = e.data;
	try {
		const result =
			mode === "qpcr"
				? designQPCR(seq, regionStart, regionEnd, opts as QPCROptions)
				: designPCR(seq, regionStart, regionEnd, opts);
		const response: PrimerWorkerResponse = { type: "success", result, mode };
		self.postMessage(response);
	} catch (err) {
		const response: PrimerWorkerResponse = {
			type: "error",
			message: (err as Error).message ?? "Unknown error",
		};
		self.postMessage(response);
	}
});
