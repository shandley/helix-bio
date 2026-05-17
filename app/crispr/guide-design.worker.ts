import type { CasVariant, CRISPRDesignOptions, GuideRNA } from "@/lib/bio/crispr";
import { designGuides } from "@/lib/bio/crispr";

export interface GuideDesignRequest {
	seq: string;
	opts: CRISPRDesignOptions;
}

export type GuideDesignResponse =
	| { type: "success"; guides: GuideRNA[]; casVariant: CasVariant }
	| { type: "error"; message: string };

self.addEventListener("message", (e: MessageEvent<GuideDesignRequest>) => {
	const { seq, opts } = e.data;
	try {
		const guides = designGuides(seq, opts);
		const response: GuideDesignResponse = { type: "success", guides, casVariant: opts.casVariant };
		self.postMessage(response);
	} catch (err) {
		const response: GuideDesignResponse = {
			type: "error",
			message: (err as Error).message ?? "Guide design failed",
		};
		self.postMessage(response);
	}
});
