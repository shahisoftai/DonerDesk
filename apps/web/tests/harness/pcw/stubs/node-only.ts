// The domain package's root also carries server-only code. None of it runs in this page; if it ever does, say so loudly.
const refuse = (): never => { throw new Error("A server-only function was called in the browser harness."); };
export const createHash = refuse; export const createHmac = refuse; export const randomBytes = refuse; export const randomUUID = refuse; export const timingSafeEqual = refuse;
export const readFileSync = refuse; export const existsSync = refuse; export const join = refuse; export const resolve = refuse; export const dirname = refuse;
export default {};
