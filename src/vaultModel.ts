import { App, TFile, TFolder, normalizePath } from "obsidian";
import { GroupModel } from "./layout";
import { MapSettings } from "./settings";

/**
 * Reads the vault and decides what appears on the map.
 *
 * Rules:
 *  - A folder with a folder note becomes a group.
 *  - A group shows its notes as cards (plus a card for its folder note, optionally)
 *    and its subfolders as nested groups.
 *  - A folder WITHOUT a folder note shows nothing of its own files. Depending on
 *    the "folders without a folder note" setting, folders inside it that do have
 *    folder notes are either lifted up into the nearest group, or skipped too.
 *  - A folder note with the mapping property set to "note" is drawn as a single
 *    card and its folder's contents are not shown; "hide" leaves it off entirely.
 */

type MapAs = "group" | "note" | "hide";

interface Ctx {
	app: App;
	s: MapSettings;
}

export function buildModel(app: App, s: MapSettings): GroupModel {
	const ctx: Ctx = { app, s };
	const root: GroupModel = { label: "", cards: [], groups: [] };
	collectChildren(ctx, app.vault.getRoot(), root, null, s.includeRootNotes);
	return root;
}

function byName(a: { name: string }, b: { name: string }): number {
	return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
}

function collectChildren(
	ctx: Ctx,
	folder: TFolder,
	into: GroupModel,
	ownNote: TFile | null,
	includeFiles: boolean
): void {
	for (const child of [...folder.children].sort(byName)) {
		if (child instanceof TFolder) {
			processFolder(ctx, child, into);
		} else if (child instanceof TFile) {
			if (!includeFiles) continue;
			if (child === ownNote) continue; // already shown as the group's first card (or hidden on purpose)
			if (isFolderNoteOfSiblingFolder(ctx, child)) continue; // handled when its folder is processed
			if (!isEligibleFile(ctx, child)) continue;
			into.cards.push(cardText(ctx, child));
		}
	}
}

function processFolder(ctx: Ctx, folder: TFolder, into: GroupModel): void {
	const note = findFolderNote(ctx, folder);

	if (!note) {
		if (ctx.s.noteLessFolders === "look-inside") {
			for (const sub of subfolders(folder)) processFolder(ctx, sub, into);
		}
		return;
	}

	switch (mapAs(ctx, note)) {
		case "hide":
			return;
		case "note":
			into.cards.push(cardText(ctx, note));
			return;
		case "group": {
			const group: GroupModel = {
				label: folder.name,
				cards: ctx.s.showFolderNoteCard ? [cardText(ctx, note)] : [],
				groups: [],
			};
			collectChildren(ctx, folder, group, note, true);
			into.groups.push(group);
		}
	}
}

/**
 * Text of a canvas card for a file. Cards are plain canvas notes (they never create .md files).
 * In "link" mode the card holds a wikilink to the real note, so it stays clickable.
 */
function cardText(ctx: Ctx, file: TFile): string {
	const isNote = file.extension === "md";
	const name = isNote ? file.basename : file.name;
	if (ctx.s.cardContent === "name") return name;
	const target = isNote ? file.path.slice(0, -".md".length) : file.path;
	return `[[${target}|${name}]]`;
}

function subfolders(folder: TFolder): TFolder[] {
	return folder.children.filter((c): c is TFolder => c instanceof TFolder).sort(byName);
}

function findFolderNote(ctx: Ctx, folder: TFolder): TFile | null {
	const { vault } = ctx.app;
	let path: string;

	switch (ctx.s.folderNoteStyle) {
		case "inside":
			path = `${folder.path}/${folder.name}.md`;
			break;
		case "index": {
			const name = ctx.s.indexFileName.trim().replace(/\.md$/i, "") || "index";
			path = `${folder.path}/${name}.md`;
			break;
		}
		case "outside": {
			const parent = folder.parent;
			if (!parent) return null;
			path = parent.isRoot() ? `${folder.name}.md` : `${parent.path}/${folder.name}.md`;
			break;
		}
	}

	const file = vault.getAbstractFileByPath(normalizePath(path));
	return file instanceof TFile ? file : null;
}

/** Only relevant for the "next to the folder" style, where a folder note sits among its parent's files. */
function isFolderNoteOfSiblingFolder(ctx: Ctx, file: TFile): boolean {
	if (ctx.s.folderNoteStyle !== "outside" || file.extension !== "md" || !file.parent) return false;
	return file.parent.children.some((c) => c instanceof TFolder && c.name === file.basename);
}

function isEligibleFile(ctx: Ctx, file: TFile): boolean {
	if (file.extension === "md") return true;
	if (!ctx.s.includeOtherFiles) return false;
	// Never pull previously generated maps into a new map.
	if (file.extension === "canvas" && file.basename.startsWith(ctx.s.fileName)) return false;
	return true;
}

function mapAs(ctx: Ctx, note: TFile): MapAs {
	const key = ctx.s.propertyName.trim();
	if (!key) return "group";

	const raw: unknown = ctx.app.metadataCache.getFileCache(note)?.frontmatter?.[key];
	const first = Array.isArray(raw) ? raw[0] : raw;
	const value = typeof first === "string" ? first.trim().toLowerCase() : "";

	if (value === "note") return "note";
	if (value === "hide") return "hide";
	return "group";
}
