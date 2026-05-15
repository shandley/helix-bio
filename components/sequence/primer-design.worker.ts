import type {
	AssemblyPrimerOptions,
	AssemblyResult,
	PCROptions,
	PCRResult,
	QPCROptions,
	QPCRResult,
} from "@shandley/primd";
import { designAssembly, designPCR, designQPCR } from "@shandley/primd";

export interface PrimerWorkerRequest {
	seq: string;
	regionStart: number;
	regionEnd: number;
	opts: PCROptions;
	assemblyOpts?: Partial<AssemblyPrimerOptions>;
	mode?: "pcr" | "qpcr" | "assembly";
}

export type PrimerWorkerResponse =
	| {
			type: "success";
			result: PCRResult | QPCRResult | AssemblyResult;
			mode: "pcr" | "qpcr" | "assembly";
	  }
	| { type: "error"; message: string };

self.addEventListener("message", (e: MessageEvent<PrimerWorkerRequest>) => {
	const { seq, regionStart, regionEnd, opts, assemblyOpts, mode = "pcr" } = e.data;
	try {
		let result: PCRResult | QPCRResult | AssemblyResult;
		if (mode === "assembly") {
			// Merge user Tm/GC opts into assemblyOpts so the annealing region
			// uses the same targets as PCR mode
			const mergedAssembly: Partial<AssemblyPrimerOptions> = {
				tmTarget: opts.tmTarget,
				gcRange: opts.gcRange,
				...assemblyOpts,
			};
			result = designAssembly(seq, regionStart, regionEnd, mergedAssembly);
		} else if (mode === "qpcr") {
			result = designQPCR(seq, regionStart, regionEnd, opts as QPCROptions);
		} else {
			result = designPCR(seq, regionStart, regionEnd, opts);
		}
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
