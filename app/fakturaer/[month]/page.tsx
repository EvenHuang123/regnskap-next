import { redirect } from 'next/navigation';

// Canonical route moved to /app/fakturaer/[month]
export default function LegacyFakturaerPage({ params }: { params: { month: string } }) {
  redirect(`/app/fakturaer/${params.month}`);
}
