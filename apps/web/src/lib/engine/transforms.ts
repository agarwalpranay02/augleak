// Names of the 28 query views of the structure view, in the order features.structureViews builds them,
// and of the 8 dihedral views of the hash view.
const D4 = ["as is", "flipped", "turned 90°", "turned 90°, flipped", "turned 180°", "turned 180°, flipped", "turned 270°", "turned 270°, flipped"];
const ROT = [15, -15, 30, -30, 45, -45].flatMap((a) => [`rotated ${a > 0 ? "+" : "−"}${Math.abs(a)}°`, `flipped, rotated ${a > 0 ? "+" : "−"}${Math.abs(a)}°`]);
const CROP = ["centre crop 80%", "flipped, centre crop 80%", "centre crop 65%", "flipped, centre crop 65%", "corner crop 75% (top left)", "corner crop 75% (top right)", "corner crop 75% (bottom left)", "corner crop 75% (bottom right)"];

export const VIEW_NAMES: string[] = [...D4, ...ROT, ...CROP];
export const HASH_VIEW_NAMES: string[] = D4;
