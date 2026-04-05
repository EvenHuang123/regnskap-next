import { redirect } from 'next/navigation';

// Canonical route moved to /app/admin/test-parsing
export default function LegacyTestParsingPage() {
  redirect('/app/admin/test-parsing');
}
