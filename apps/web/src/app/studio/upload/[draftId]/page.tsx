"use client";

import { UploadStudio } from '@/components/studio/UploadStudio';
import { use } from 'react';

interface EditDraftPageProps {
  params: Promise<{ draftId: string }>;
}

export default function EditDraftPage({ params }: EditDraftPageProps) {
  const { draftId } = use(params);
  return <UploadStudio draftId={draftId} />;
}
