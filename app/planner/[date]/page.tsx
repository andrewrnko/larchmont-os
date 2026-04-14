import { notFound } from 'next/navigation'
import { PlannerDayClient } from './PlannerDayClient'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export default async function PlannerDayPage({
  params,
}: {
  params: Promise<{ date: string }>
}) {
  const { date } = await params
  if (!DATE_RE.test(date)) notFound()
  return <PlannerDayClient date={date} />
}
