'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState } from 'react'
import { Printer, Settings2 } from 'lucide-react'

export default function ImpressionEtatsModal({ title }: { title: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isOpen, setIsOpen] = useState(false)
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')
  
  const currentFrom = searchParams.get('from') || ''
  const currentTo = searchParams.get('to') || ''

  const [from, setFrom] = useState(currentFrom)
  const [to, setTo] = useState(currentTo)

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams.toString())
    if (from) params.set('from', from)
    else params.delete('from')
    
    if (to) params.set('to', to)
    else params.delete('to')
    
    router.push(`${pathname}?${params.toString()}`)
    setIsOpen(false)
  }

  const printDocument = () => {
    setIsOpen(false)
    setTimeout(() => window.print(), 100)
  }

  return (
    <>
      <div className="flex gap-2 print:hidden">
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 rounded-md bg-surface px-3 py-1.5 text-sm font-medium text-foreground border border-surface-border hover:bg-background"
        >
          <Settings2 className="h-4 w-4" /> Paramétrer l'état
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover"
        >
          <Printer className="h-4 w-4" /> Imprimer
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <div className="fixed inset-0 bg-black bg-opacity-75 transition-opacity" onClick={() => setIsOpen(false)} />
            
            <div className="relative transform overflow-hidden rounded-lg bg-surface p-6 text-left shadow-xl transition-all w-full max-w-md border border-surface-border">
              <h3 className="text-lg font-semibold leading-6 text-foreground mb-4">Paramétrer l'impression</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Date de début</label>
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="block w-full rounded-md border border-surface-border bg-background px-3 py-2 text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Date de fin</label>
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="block w-full rounded-md border border-surface-border bg-background px-3 py-2 text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Orientation</label>
                  <select
                    value={orientation}
                    onChange={(e) => setOrientation(e.target.value as 'portrait' | 'landscape')}
                    className="block w-full rounded-md border border-surface-border bg-background px-3 py-2 text-foreground"
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Paysage</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-md bg-background px-3 py-2 text-sm font-medium text-foreground border border-surface-border hover:bg-surface"
                >
                  Annuler
                </button>
                <button
                  onClick={applyFilters}
                  className="rounded-md bg-surface px-3 py-2 text-sm font-medium text-foreground border border-surface-border hover:bg-background"
                >
                  Appliquer les dates
                </button>
                <button
                  onClick={printDocument}
                  className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-hover"
                >
                  Imprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inject print styles based on selected orientation */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page {
            size: A4 ${orientation};
            margin: 10mm;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          /* Hide sidebar and nav */
          nav, aside, header { display: none !important; }
          /* Ensure main content takes full width */
          main { width: 100% !important; margin: 0 !important; padding: 0 !important; }
        }
      `}} />
    </>
  )
}
