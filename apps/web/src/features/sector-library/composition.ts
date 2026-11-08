/** The only place the picker's adapters are chosen (ports and adapters, like maps and Record). Presentation imports ports and this file, never the adapters. */
export { serverBrowser as libraryBrowser, projectAdopter, draftAdopter } from "./adapters/server-actions";
