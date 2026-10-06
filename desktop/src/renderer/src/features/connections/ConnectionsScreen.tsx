import { useEffect, useState } from "react";
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from "@/design-system/components";
import { IconPlus } from "@/design-system/icons";
import { isMac } from "@/lib/platform";
import { useRuntime } from "@/stores/runtime";
import { AddMcpDialog } from "./AddMcpDialog";
import { CatalogGrid } from "./CatalogGrid";
import { ConnectionCard } from "./ConnectionCard";
import { ConnectionDetail } from "./ConnectionDetail";
import { GoogleMicrosoftTab } from "./GoogleMicrosoftTab";
import { ImportJsonDialog } from "./ImportJsonDialog";
import { MacPermissions } from "./MacPermissions";

export function ConnectionsScreen({ connectionId }: { connectionId?: string }) {
	const connections = useRuntime((s) => s.connections);
	const [tab, setTab] = useState("installed");
	const [addOpen, setAddOpen] = useState(false);
	const [importOpen, setImportOpen] = useState(false);

	useEffect(() => {
		void useRuntime.getState().loadConnections();
	}, []);

	return (
		<div className="h-full overflow-y-auto">
			<div className="mx-auto w-full max-w-[1100px] p-8">
				{connectionId ? (
					<ConnectionDetail connectionId={connectionId} />
				) : (
					<>
						<div className="mb-6 flex flex-wrap items-start justify-between gap-4">
							<div>
								<h1 className="text-3xl font-semibold text-fg">Connections</h1>
								<p className="mt-1 text-md text-fg-2">Give your Dots tools. Each Dot only gets what you allow it.</p>
							</div>
							<div className="flex gap-2">
								<Button variant="secondary" onClick={() => setImportOpen(true)}>
									Import JSON
								</Button>
								<Button leadingIcon={<IconPlus size={16} />} onClick={() => setAddOpen(true)}>
									Add MCP server
								</Button>
							</div>
						</div>
						<Tabs value={tab} onValueChange={setTab}>
							<TabsList>
								<TabsTrigger value="installed">Installed</TabsTrigger>
								<TabsTrigger value="catalog">Catalog</TabsTrigger>
								{isMac && <TabsTrigger value="mac">Mac</TabsTrigger>}
								<TabsTrigger value="accounts">Google &amp; Microsoft</TabsTrigger>
							</TabsList>
							<TabsContent value="installed">
								{connections.length === 0 ? (
									<div className="flex flex-col items-center gap-3 py-16 text-center">
										<p className="text-md text-fg">No connections yet</p>
										<p className="text-sm text-fg-2">Browse the catalog to give your Dots their first tool.</p>
										<Button onClick={() => setTab("catalog")}>Browse catalog</Button>
									</div>
								) : (
									<div className="grid grid-cols-1 gap-3 min-[900px]:grid-cols-2 min-[1100px]:grid-cols-3">
										{connections.map((c) => (
											<ConnectionCard key={c.id} connection={c} />
										))}
									</div>
								)}
							</TabsContent>
							<TabsContent value="catalog">
								<CatalogGrid />
							</TabsContent>
							{isMac && (
								<TabsContent value="mac">
									<MacPermissions />
								</TabsContent>
							)}
							<TabsContent value="accounts">
								<GoogleMicrosoftTab />
							</TabsContent>
						</Tabs>
						<AddMcpDialog open={addOpen} onOpenChange={setAddOpen} />
						<ImportJsonDialog open={importOpen} onOpenChange={setImportOpen} />
					</>
				)}
			</div>
		</div>
	);
}
