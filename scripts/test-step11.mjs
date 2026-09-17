import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function test() {
  const { data: creance } = await supabase.from('creances').select('id, montant_restant').limit(1).single()
  if (!creance) {
    console.log('No creances found')
    return
  }
  
  console.log('Updating creance:', creance.id)
  const { data, error } = await supabase
    .from('creances')
    .update({ montant_restant: creance.montant_restant })
    .eq('id', creance.id)
    .select()

  if (error) {
    console.error('Update failed:', error)
  } else {
    console.log('Update success!', data)
  }
}

test()
