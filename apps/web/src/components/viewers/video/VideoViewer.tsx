"use client";

import { BaseVideoViewer } from "../base/BaseVideoViewer";
import { ViewerProps } from "../types";

export default function VideoViewer(props: ViewerProps) {
  return <BaseVideoViewer {...props} />;
}
