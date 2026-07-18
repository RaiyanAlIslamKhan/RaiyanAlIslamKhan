/** Status of a video in the review queue. */
export type VideoStatus = "pending" | "approved" | "rejected";

/** Metadata stored alongside each rendered video. */
export interface VideoMeta {
  /** Unique identifier derived from the output slug. */
  id: string;
  /** The original topic used to generate the script. */
  topic: string;
  /** Absolute path to the rendered MP4 file. */
  mp4Path: string;
  /** Absolute path to the captions JSON file (word-level timings). */
  captionsPath: string;
  /** ISO-8601 timestamp when the video was rendered. */
  createdAt: string;
  /** Current review status. */
  status: VideoStatus;
}
