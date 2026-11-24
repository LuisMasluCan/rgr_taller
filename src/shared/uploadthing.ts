import {
  generateUploadButton,
  generateUploadDropzone,
} from "@uploadthing/react";
import type { FileRouter } from "uploadthing/types";

export type OurFileRouter = {
  imageUploader: any;
} & FileRouter;

export const UploadButton = generateUploadButton<OurFileRouter>({
  url: "/api/uploadthing",
});

export const UploadDropzone = generateUploadDropzone<OurFileRouter>({
  url: "/api/uploadthing",
});
