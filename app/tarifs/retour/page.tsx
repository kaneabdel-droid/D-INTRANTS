import RetourClient from './RetourClient'

export default async function RetourTarifsPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams
  return <RetourClient abonnementId={id ?? null} />
}
