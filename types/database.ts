export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
	public: {
		Tables: {
			sequences: {
				Row: {
					id: string;
					user_id: string;
					name: string;
					description: string;
					topology: "circular" | "linear";
					length: number | null;
					gc_content: number | null;
					file_path: string | null;
					file_format: "genbank" | "fasta" | "dna" | "embl";
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					name: string;
					description?: string;
					topology?: "circular" | "linear";
					length?: number | null;
					gc_content?: number | null;
					file_path?: string | null;
					file_format?: "genbank" | "fasta" | "dna" | "embl";
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					name?: string;
					description?: string;
					topology?: "circular" | "linear";
					length?: number | null;
					gc_content?: number | null;
					file_path?: string | null;
					file_format?: "genbank" | "fasta" | "dna" | "embl";
					updated_at?: string;
				};
				Relationships: [];
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			[_ in never]: never;
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
}

export type Sequence = Database["public"]["Tables"]["sequences"]["Row"];
