import { Notice, Plugin, TFile, normalizePath } from "obsidian";
import { buildCanvas } from "./layout";
import { DEFAULT_SETTINGS, MapSettings } from "./settings";
import { FolderNoteMapSettingTab } from "./settingsTab";
import { buildModel } from "./vaultModel";

export default class FolderNoteMapPlugin extends Plugin {
	settings: MapSettings = { ...DEFAULT_SETTINGS };
	private generating = false;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new FolderNoteMapSettingTab(this.app, this));

		this.addRibbonIcon("map", "Generate vault map canvas", () => void this.generate());
		this.addCommand({
			id: "generate-map",
			name: "Generate vault map canvas",
			callback: () => void this.generate(),
		});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async generate() {
		if (this.generating) return;
		this.generating = true;
		try {
			const model = buildModel(this.app, this.settings);
			const { data, groupCount, cardCount } = buildCanvas(model, {
				cardWidth: this.settings.cardWidth,
				cardHeight: this.settings.cardHeight,
				colorize: this.settings.colorize,
			});

			if (groupCount === 0 && cardCount === 0) {
				new Notice(
					"No folders with a folder note were found. Check the folder note style in the plugin settings."
				);
				return;
			}

			const file = await this.writeCanvas(JSON.stringify(data, null, "\t"));
			await this.app.workspace.getLeaf("tab").openFile(file);
			new Notice(`Mapped ${groupCount} folder${groupCount === 1 ? "" : "s"} and ${cardCount} note${cardCount === 1 ? "" : "s"}.`);
		} catch (error) {
			console.error("Folder Note Map: could not generate the map", error);
			new Notice("Could not generate the map. See the developer console for details.");
		} finally {
			this.generating = false;
		}
	}

	private async writeCanvas(json: string): Promise<TFile> {
		const { vault } = this.app;
		const folder = this.settings.outputFolder.trim().replace(/^\/+|\/+$/g, "");
		const base = this.settings.fileName.trim().replace(/[\\/:*?"<>|]/g, "-") || "Vault map";

		if (folder) await this.ensureFolder(folder);
		const at = (name: string) => normalizePath(folder ? `${folder}/${name}.canvas` : `${name}.canvas`);

		if (this.settings.overwrite) {
			const existing = vault.getAbstractFileByPath(at(base));
			if (existing instanceof TFile) {
				await vault.modify(existing, json);
				return existing;
			}
			return vault.create(at(base), json);
		}

		// New file each time: "Vault map 2026-10-15 14-32", with a counter if that name is taken.
		const d = new Date();
		const pad = (n: number) => String(n).padStart(2, "0");
		const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}-${pad(d.getMinutes())}`;
		let name = `${base} ${stamp}`;
		for (let i = 2; vault.getAbstractFileByPath(at(name)); i++) name = `${base} ${stamp} (${i})`;
		return vault.create(at(name), json);
	}

	private async ensureFolder(path: string) {
		let current = "";
		for (const part of path.split("/")) {
			current = current ? `${current}/${part}` : part;
			if (!this.app.vault.getAbstractFileByPath(current)) await this.app.vault.createFolder(current);
		}
	}
}
