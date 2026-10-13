'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import type { Sample } from '@/lib/types';
import PageHeader from '@/components/admin/PageHeader';
import SampleForm from '@/components/admin/SampleForm';
import { useAuth } from '@/lib/auth';

export default function EditSamplePage() {
  const { id } = useParams<{ id: string }>();
  const [sample, setSample] = useState<Sample | null | undefined>(undefined);
  const { profile, isSuper } = useAuth();

  useEffect(() => {
    getDoc(doc(db, 'samples', id))
      .then((s) => setSample(s.exists() ? ({ id: s.id, ...(s.data() as Omit<Sample, 'id'>) }) : null))
      .catch(() => setSample(null));
  }, [id]);

  if (sample === undefined) return <div className="grid place-items-center py-24"><Loader2 className="animate-spin text-leaf-700" /></div>;
  if (sample === null)
    return (
      <div className="card p-10 text-center">
        <p className="font-display text-2xl">Sample not found</p>
        <Link href="/admin/samples" className="btn btn-outline mt-4">Back to samples</Link>
      </div>
    );

  const canEdit = isSuper || (!!sample.createdByUid && sample.createdByUid === profile?.uid);
  if (!canEdit)
    return (
      <div className="card p-10 text-center">
        <p className="font-display text-2xl">You can&apos;t edit this design</p>
        <p className="mt-1 text-sm text-muted">
          #{sample.designNumber} was added by {sample.createdByName || sample.salesPerson || 'another staff member'}. Only they or the Super Admin can edit it. You can still share it from Samples.
        </p>
        <Link href="/admin/samples" className="btn btn-outline mt-4">Back to samples</Link>
      </div>
    );

  return (
    <>
      <PageHeader eyebrow="Catalogue" title={`Edit #${sample.designNumber}`} subtitle="Changes appear instantly on the shop and on links already shared." />
      <SampleForm initial={sample} />
    </>
  );
}
