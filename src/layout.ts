/**
 * Pure layout + canvas JSON generation (no Obsidian imports, so it can be tested in Node).
 *
 * Input is a simple tree: each group has a label, some note cards (plain text), and
 * child groups. Output is the JSON of an Obsidian canvas (JSON Canvas 1.0): "group"
 * nodes drawn as rectangles, and "text" nodes for the cards, positioned so nothing
 * overlaps and every child sits fully inside its parent group. Text nodes live only
 * inside the canvas, so generating a map never creates any .md files.
 *
 * Layout of one group (bottom-up):
 *   1. its note cards go in a grid at the top
 *   2. its child groups are packed in rows underneath ("shelf packing"), in order
 *   3. the box is the bounding rectangle plus padding
 */

export interface GroupModel {
	/** Group label (the folder name). Ignored for the root. */
	label: string;
	/** Text of the cards (canvas notes) shown inside this group, in display order. */
	cards: string[];
	groups: GroupModel[];
}

export interface LayoutOptions {
	cardWidth: number;
	cardHeight: number;
	/** Give each top-level group (and everything inside it) its own canvas color. */
	colorize: boolean;
}

export interface GroupNode {
	id: string;
	type: "group";
	x: number;
	y: number;
	width: number;
	height: number;
	label: string;
	color?: string;
}

export interface TextNode {
	id: string;
	type: "text";
	text: string;
	x: number;
	y: number;
	width: number;
	height: number;
}

export type CanvasNode = GroupNode | TextNode;

export interface CanvasData {
	nodes: CanvasNode[];
	edges: never[];
}

export interface BuildResult {
	data: CanvasData;
	groupCount: number;
	cardCount: number;
}

/** Space between cards in the same grid. */
export const GAP = 24;
/** Space between a group's border and what's inside it. */
export const PAD = 48;
/** Space between sibling groups (leaves room for the group label drawn above each box). */
export const GROUP_GAP = 80;

const MAX_COLS = 6;
const GROUP_ASPECT = 1.6; // preferred width / height of a group's contents
const ROOT_ASPECT = 2.2; // the whole map is allowed to be wider

/** Canvas preset colors: cyan, green, purple, orange, red, yellow. */
const PALETTE = ["5", "4", "6", "2", "1", "3"];

interface Pos {
	text: string;
	x: number;
	y: number;
}

interface Laid {
	label: string;
	w: number;
	h: number;
	/** Card positions relative to this group's top-left corner. */
	cards: Pos[];
	/** Child group positions relative to this group's top-left corner. */
	kids: Array<{ laid: Laid; x: number; y: number }>;
}

function layout(model: GroupModel, o: LayoutOptions, framed: boolean, aspect: number): Laid {
	const cw = o.cardWidth;
	const ch = o.cardHeight;

	// 1. Cards in a grid, with a column count that aims for the preferred aspect ratio.
	const n = model.cards.length;
	const cards: Pos[] = [];
	let cardsW = 0;
	let cardsH = 0;
	if (n > 0) {
		const wanted = Math.ceil(Math.sqrt((n * aspect * (ch + GAP)) / (cw + GAP)));
		const cols = Math.min(MAX_COLS, n, Math.max(1, wanted));
		const rows = Math.ceil(n / cols);
		model.cards.forEach((text, i) => {
			cards.push({ text, x: (i % cols) * (cw + GAP), y: Math.floor(i / cols) * (ch + GAP) });
		});
		cardsW = cols * cw + (cols - 1) * GAP;
		cardsH = rows * ch + (rows - 1) * GAP;
	}

	// 2. Child groups, packed in rows in their original (alphabetical) order.
	const kids = model.groups.map((g) => layout(g, o, true, GROUP_ASPECT));
	const placed: Array<{ laid: Laid; x: number; y: number }> = [];
	let packedW = 0;
	let packedH = 0;
	if (kids.length > 0) {
		let area = 0;
		let widest = 0;
		for (const k of kids) {
			area += (k.w + GROUP_GAP) * (k.h + GROUP_GAP);
			widest = Math.max(widest, k.w);
		}
		const targetWidth = Math.max(cardsW, widest, Math.sqrt(area * aspect));

		let x = 0;
		let y = 0;
		let rowH = 0;
		for (const k of kids) {
			if (x > 0 && x + k.w > targetWidth) {
				x = 0;
				y += rowH + GROUP_GAP;
				rowH = 0;
			}
			placed.push({ laid: k, x, y });
			packedW = Math.max(packedW, x + k.w);
			rowH = Math.max(rowH, k.h);
			packedH = y + rowH;
			x += k.w + GROUP_GAP;
		}
	}

	// 3. Bounding box (plus padding when this is a drawn group, not the invisible root).
	const kidsTop = cardsH > 0 && packedH > 0 ? cardsH + GROUP_GAP : cardsH;
	let contentW = Math.max(cardsW, packedW);
	let contentH = kidsTop + packedH;
	if (framed && contentW === 0) {
		// Empty group (e.g. a folder note that is hidden inside its own group): keep a visible box.
		contentW = cw;
		contentH = ch;
	}
	const inset = framed ? PAD : 0;

	return {
		label: model.label,
		w: contentW + 2 * inset,
		h: contentH + 2 * inset,
		cards: cards.map((c) => ({ ...c, x: c.x + inset, y: c.y + inset })),
		kids: placed.map((p) => ({ laid: p.laid, x: p.x + inset, y: p.y + kidsTop + inset })),
	};
}

function newId(): string {
	const bytes = new Uint8Array(8);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function buildCanvas(root: GroupModel, o: LayoutOptions): BuildResult {
	const laid = layout(root, o, false, ROOT_ASPECT);
	const nodes: CanvasNode[] = [];
	let groupCount = 0;
	let cardCount = 0;

	const emitCards = (cards: Pos[], ox: number, oy: number) => {
		for (const c of cards) {
			nodes.push({
				id: newId(),
				type: "text",
				text: c.text,
				x: Math.round(ox + c.x),
				y: Math.round(oy + c.y),
				width: o.cardWidth,
				height: o.cardHeight,
			});
			cardCount++;
		}
	};

	// A group is emitted before everything inside it, so it is drawn underneath its contents.
	const emitGroup = (g: Laid, x: number, y: number, color: string | undefined) => {
		const node: GroupNode = {
			id: newId(),
			type: "group",
			x: Math.round(x),
			y: Math.round(y),
			width: Math.round(g.w),
			height: Math.round(g.h),
			label: g.label,
		};
		if (color) node.color = color;
		nodes.push(node);
		groupCount++;

		emitCards(g.cards, x, y);
		for (const k of g.kids) emitGroup(k.laid, x + k.x, y + k.y, color);
	};

	emitCards(laid.cards, 0, 0);
	laid.kids.forEach((k, i) => {
		emitGroup(k.laid, k.x, k.y, o.colorize ? PALETTE[i % PALETTE.length] : undefined);
	});

	return { data: { nodes, edges: [] }, groupCount, cardCount };
}
