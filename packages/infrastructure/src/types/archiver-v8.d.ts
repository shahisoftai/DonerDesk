declare module "archiver" {
  import { Transform } from "node:stream";

  export class ZipArchive extends Transform {
    constructor(options?: { zlib?: { level?: number } });
    append(source: string | Buffer, data: { name: string }): this;
    finalize(): Promise<void>;
  }
}
