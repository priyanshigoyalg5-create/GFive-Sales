'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Old URL — kept so existing bookmarks (and ?edit=<id> links) still work. */
export default function LegacyAddPage() {
  const router = useRouter();
  useEffect(() => {
    const edit = new URLSearchParams(window.location.search).get('edit');
    router.replace(edit ? `/admin/samples/${edit}/edit` : '/admin/samples/new');
  }, [router]);
  return null;
}
