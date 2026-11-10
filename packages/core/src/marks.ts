/* Shared mark so an embed can recognise a canvas without importing it. */

export const pictureMark = Symbol("draeven.picture");

/* Marks a value created by command(). Shared via Symbol.for for loaders. */
export const commandMark = Symbol.for("draeven.command");
