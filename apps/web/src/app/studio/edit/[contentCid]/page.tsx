"use client";

import { use } from "react";
import { UploadStudio } from "@/components/studio/UploadStudio";

interface EditContentPageProps {
  params: Promise<{ contentCid: string }>;
}

export default function EditContentPage({ params }: EditContentPageProps) {
  const { contentCid } = use(params);

  return <UploadStudio editContentCid={contentCid} />;
}
