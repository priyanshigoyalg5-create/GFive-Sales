import PageHeader from '@/components/admin/PageHeader';
import SampleForm from '@/components/admin/SampleForm';

export default function NewSamplePage() {
  return (
    <>
      <PageHeader eyebrow="Catalogue" title="Add sample" subtitle="Upload photos, add colours and get a shareable order link." />
      <SampleForm />
    </>
  );
}
