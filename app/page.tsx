import { redirect } from 'next/navigation';

/** The website is for staff; customers only receive single-design links (/s/<id>). */
export default function Home() {
  redirect('/admin/orders');
}
