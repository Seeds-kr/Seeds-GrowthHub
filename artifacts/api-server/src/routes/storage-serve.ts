import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

// Serve object entities (uploaded via signed PUT). ACL is checked downstream;
// avatar PNGs we write are stamped as visibility=public so this returns them
// to anyone.
router.get(
  "/storage/objects/*path",
  async (req: Request, res: Response) => {
    try {
      const raw = (req.params as { path: string | string[] }).path;
      const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
      const objectPath = `/objects/${wildcardPath}`;
      const objectFile = await objectStorageService.getObjectEntityFile(
        objectPath,
      );
      // ACL enforcement: this serve endpoint is unauthenticated, so it can only
      // return objects explicitly stamped public. Avatar PNGs we write are
      // public; any private object returns 404 to avoid disclosing existence.
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
      });
      if (!canAccess) {
        res.status(404).json({ error: "Object not found" });
        return;
      }
      const response = await objectStorageService.downloadObject(objectFile);
      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));
      if (response.body) {
        const nodeStream = Readable.fromWeb(
          response.body as ReadableStream<Uint8Array>,
        );
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ error: "Object not found" });
        return;
      }
      req.log.error({ err: error }, "Error serving object");
      res.status(500).json({ error: "Failed to serve object" });
    }
  },
);

export default router;
