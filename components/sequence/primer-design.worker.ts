import { designPCR } from "@shandley/primd";
import type { PCROptions, PCRResult } from "@shandley/primd";

export interface PrimerWorkerRequest {
	seq: string;
	regionStart: number;
	regionEnd: number;
	opts: PCROptions;
}

export type PrimerWorkerResponse =
	| { type: "success"; result: PCRResult }
	| { type: "error"; message: string };

self.addEventListener("message", (e: MessageEvent<PrimerWorkerRequest>) => {
	const { seq, regionStart, regionEnd, opts } = e.data;
	try {
		const result = designPCR(seq, regionStart, regionEnd, opts);
		const response: PrimerWorkerResponse = { type: "success", result };
		self.postMessage(response);
	} catch (err) {
		const response: PrimerWorkerResponse = {
			type: "error",
			message: (err as Error).message ?? "Unknown error",
		};
		self.postMessage(response);
	}
});
