export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
	public: {
		Tables: {
			sequence_shares: {
				Row: {
					id: string;
					token: string;
					sequence_id: string;
					created_by: string;
					created_at: string;
					view_count: number;
				};
				Insert: {
					id?: string;
					token: string;
					sequence_id: string;
					created_by: string;
					created_at?: string;
					view_count?: number;
				};
				Update: {
					view_count?: number;
				};
				Relationships: [];
			};
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
					deleted_at: string | null;
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
					deleted_at?: string | null;
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
