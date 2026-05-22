import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://bntyklhzencxcreqpapy.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJudHlrbGh6ZW5jeGNyZXFwYXB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyOTA2NzQsImV4cCI6MjA5NDg2NjY3NH0.x0bga658avJ97ioPocqPFjLnfwq5djWiIJjFDKGShCQ'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
