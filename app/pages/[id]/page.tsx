// Dynamic route for user-created Custom Pages.
// The page id is localStorage-backed via `usePagesStore`; the actual editor
// is a client component that reads from the store.

import { PageEditor } from '@/components/pages/page-editor'

export default async function CustomPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <div className="min-h-full p-6">
      <PageEditor pageId={id} />
    </div>
  )
}
