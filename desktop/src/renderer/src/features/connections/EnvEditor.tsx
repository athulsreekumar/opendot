import { Button, IconButton, Input, Switch } from "@/design-system/components";
import { IconClose, IconPlus } from "@/design-system/icons";

export interface EnvRow {
	key: string;
	value: string;
	secret: boolean;
}

export const SECRET_KEY_RE = /(KEY|TOKEN|SECRET|PASSWORD|AUTH)/i;

export function newEnvRow(): EnvRow {
	return { key: "", value: "", secret: false };
}

/** Split rows into plain and secret maps, dropping rows without a key. */
export function splitEnv(rows: EnvRow[]): { plain: Record<string, string>; secret: Record<string, string> } {
	const plain: Record<string, string> = {};
	const secret: Record<string, string> = {};
	for (const r of rows) {
		const k = r.key.trim();
		if (!k) continue;
		if (r.secret) secret[k] = r.value;
		else plain[k] = r.value;
	}
	return { plain, secret };
}

export function EnvEditor({
	rows,
	onChange,
	keyLabel = "Name",
	addLabel = "Add row",
}: {
	rows: EnvRow[];
	onChange: (rows: EnvRow[]) => void;
	keyLabel?: string;
	addLabel?: string;
}) {
	const set = (i: number, patch: Partial<EnvRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
	return (
		<div className="flex flex-col gap-2">
			{rows.map((r, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: rows have no stable id
				<div key={i} className="flex items-center gap-2">
					<div className="min-w-0 flex-1">
						<Input
							aria-label={`${keyLabel} ${i + 1}`}
							placeholder={keyLabel}
							value={r.key}
							onChange={(e) => {
								const key = e.target.value;
								set(i, { key, secret: r.secret || (r.key === "" && SECRET_KEY_RE.test(key)) });
							}}
							className="font-mono"
						/>
					</div>
					<div className="min-w-0 flex-1">
						<Input
							aria-label={`Value ${i + 1}`}
							placeholder="Value"
							type={r.secret ? "password" : "text"}
							value={r.value}
							onChange={(e) => set(i, { value: e.target.value })}
							className="font-mono"
						/>
					</div>
					<Switch
						aria-label={`Secret ${i + 1}`}
						label="Secret"
						checked={r.secret}
						onCheckedChange={(secret) => set(i, { secret })}
					/>
					<IconButton
						label="Remove row"
						icon={<IconClose size={16} />}
						onClick={() => onChange(rows.filter((_, j) => j !== i))}
					/>
				</div>
			))}
			<div>
				<Button
					variant="ghost"
					size="sm"
					leadingIcon={<IconPlus size={16} />}
					onClick={() => onChange([...rows, newEnvRow()])}
				>
					{addLabel}
				</Button>
			</div>
		</div>
	);
}
