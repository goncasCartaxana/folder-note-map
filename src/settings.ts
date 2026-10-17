export type FolderNoteStyle = "inside" | "index" | "outside";
export type NoteLessFolders = "look-inside" | "skip";
export type CardContent = "link" | "name";

export interface MapSettings {
	/** Where a folder's folder note lives. */
	folderNoteStyle: FolderNoteStyle;
	/** File name (without .md) used when folderNoteStyle is "index". */
	indexFileName: string;
	/** Frontmatter property that changes how a folder note is mapped ("note" or "hide"). */
	propertyName: string;
	/** What to do with folders that have no folder note. */
	noteLessFolders: NoteLessFolders;
	/** What a card says: a link to the real note, or just its name. */
	cardContent: CardContent;
	/** Also add a card for the folder note itself inside its group. */
	showFolderNoteCard: boolean;
	includeRootNotes: boolean;
	includeOtherFiles: boolean;
	colorize: boolean;
	cardWidth: number;
	cardHeight: number;
	outputFolder: string;
	fileName: string;
	overwrite: boolean;
}

export const DEFAULT_SETTINGS: MapSettings = {
	folderNoteStyle: "inside",
	indexFileName: "index",
	propertyName: "map-as",
	noteLessFolders: "look-inside",
	cardContent: "name",
	showFolderNoteCard: false,
	includeRootNotes: false,
	includeOtherFiles: false,
	colorize: true,
	cardWidth: 220,
	cardHeight: 60,
	outputFolder: "",
	fileName: "Vault map",
	overwrite: false,
};
