import { App, PluginSettingTab, Setting } from "obsidian";
import type FolderNoteMapPlugin from "./main";
import { CardContent, FolderNoteStyle, NoteLessFolders } from "./settings";

export class FolderNoteMapSettingTab extends PluginSettingTab {
    private indexFileSetting: Setting | null = null;

    constructor(app: App, private plugin: FolderNoteMapPlugin) {
        super(app, plugin);
    }

    display(): void {
        const { containerEl } = this;
        const s = this.plugin.settings;
        containerEl.empty();

        const save = () => this.plugin.saveSettings();

        // ------------------------------------------------------------ folder notes
        new Setting(containerEl).setName("Folder notes").setHeading();

        new Setting(containerEl)
            .setName("Folder note style")
            .setDesc("Where a folder's folder note is stored. This decides which folders count as groups.")
            .addDropdown((d) =>
                d
                    .addOptions({
                        inside: "Inside the folder, same name (Folder/Folder.md)",
                        index: "Inside the folder, index file (Folder/index.md)",
                        outside: "Next to the folder, same name (Parent/Folder.md)",
                    } satisfies Record<FolderNoteStyle, string>)
                    .setValue(s.folderNoteStyle)
                    .onChange(async (v) => {
                        s.folderNoteStyle = v as FolderNoteStyle;
                        await save();
                        // Toggle visibility of the index file setting dynamically without using display()
                        if (this.indexFileSetting) {
                            this.indexFileSetting.settingEl.toggle(s.folderNoteStyle === "index");
                        }
                    })
            );

        this.indexFileSetting = new Setting(containerEl)
            .setName("Index file name")
            .setDesc("Name of the folder note inside each folder, without the .md extension.")
            .addText((t) =>
                t.setPlaceholder("Index").setValue(s.indexFileName).onChange(async (v) => {
                    s.indexFileName = v;
                    await save();
                })
            );

        // Set initial visibility based on current style
        this.indexFileSetting.settingEl.toggle(s.folderNoteStyle === "index");

        new Setting(containerEl)
            .setName("Mapping property")
            .setDesc(
                "Add this property to a folder note to change how it is mapped. Set it to note to show the folder as a single note, without its contents. Set it to hide to leave the folder off the map. Leave this field empty to turn the feature off."
            )
            .addText((t) =>
                t.setPlaceholder("Map-as").setValue(s.propertyName).onChange(async (v) => {
                    s.propertyName = v;
                    await save();
                })
            );

        // -------------------------------------------------------- what to include
        new Setting(containerEl).setName("What to include").setHeading();

        new Setting(containerEl)
            .setName("Folders without a folder note")
            .setDesc(
                "Their own files are never shown. Choose whether to look inside them for subfolders that do have a folder note, or to skip them completely."
            )
            .addDropdown((d) =>
                d
                    .addOptions({
                        "look-inside": "Look inside for folders that have a folder note",
                        skip: "Skip them completely",
                    } satisfies Record<NoteLessFolders, string>)
                    .setValue(s.noteLessFolders)
                    .onChange(async (v) => {
                        s.noteLessFolders = v as NoteLessFolders;
                        await save();
                    })
            );

        new Setting(containerEl)
            .setName("Card for the folder note itself")
            .setDesc("Adds a card for the folder note inside its group. Off by default, because the group already stands for the folder note.")
            .addToggle((t) =>
                t.setValue(s.showFolderNoteCard).onChange(async (v) => {
                    s.showFolderNoteCard = v;
                    await save();
                })
            );

        new Setting(containerEl)
            .setName("Include notes in the vault root")
            .setDesc("Show notes that are not inside any folder as cards at the top level of the map.")
            .addToggle((t) =>
                t.setValue(s.includeRootNotes).onChange(async (v) => {
                    s.includeRootNotes = v;
                    await save();
                })
            );

        new Setting(containerEl)
            .setName("Include other file types")
            .setDesc("Also show images, PDFs, canvases and other non-note files that sit inside mapped folders.")
            .addToggle((t) =>
                t.setValue(s.includeOtherFiles).onChange(async (v) => {
                    s.includeOtherFiles = v;
                    await save();
                })
            );

        // ------------------------------------------------------------------ layout
        new Setting(containerEl).setName("Layout").setHeading();

        new Setting(containerEl)
            .setName("Color groups by top-level folder")
            .setDesc("Each top-level group, and everything inside it, gets its own color.")
            .addToggle((t) =>
                t.setValue(s.colorize).onChange(async (v) => {
                    s.colorize = v;
                    await save();
                })
            );

        new Setting(containerEl)
            .setName("Card content")
            .setDesc(
                "Every note becomes a canvas card, and no new notes are created. A link keeps the card clickable; a plain name is easier to rewrite while you plan changes."
            )
            .addDropdown((d) =>
                d
                    .addOptions({
                        link: "Link to the note",
                        name: "Note name only",
                    } satisfies Record<CardContent, string>)
                    .setValue(s.cardContent)
                    .onChange(async (v) => {
                        s.cardContent = v as CardContent;
                        await save();
                    })
            );

        new Setting(containerEl)
            .setName("Card width")
            .addSlider((sl) =>
                sl.setLimits(120, 500, 10).setValue(s.cardWidth).onChange(async (v) => {
                    s.cardWidth = v;
                    await save();
                })
            );

        new Setting(containerEl)
            .setName("Card height")
            .setDesc("Smaller cards give a better overview of a big vault.")
            .addSlider((sl) =>
                sl.setLimits(40, 300, 10).setValue(s.cardHeight).onChange(async (v) => {
                    s.cardHeight = v;
                    await save();
                })
            );

        // ------------------------------------------------------------------ output
        new Setting(containerEl).setName("Output").setHeading();

        new Setting(containerEl)
            .setName("Output folder")
            .setDesc("Where the canvas is saved. Leave empty for the vault root. The folder is created if needed.")
            .addText((t) =>
                t.setPlaceholder("Maps").setValue(s.outputFolder).onChange(async (v) => {
                    s.outputFolder = v;
                    await save();
                })
            );

        new Setting(containerEl)
            .setName("File name")
            .addText((t) =>
                t.setValue(s.fileName).onChange(async (v) => {
                    s.fileName = v;
                    await save();
                })
            );

        new Setting(containerEl)
            .setName("Overwrite the previous map")
            .setDesc(
                "Off: every run creates a new canvas with the date and time in its name, so manual edits to earlier maps are never lost. On: every run replaces the same file."
            )
            .addToggle((t) =>
                t.setValue(s.overwrite).onChange(async (v) => {
                    s.overwrite = v;
                    await save();
                })
            );
    }
}
