-- Add client association to contact messages for client portal messaging
ALTER TABLE IF EXISTS public.contact_messages
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS contact_messages_client_id_idx
  ON public.contact_messages(client_id);

-- Allow authenticated clients to read their own messages
DROP POLICY IF EXISTS "Clients can view their contact messages" ON public.contact_messages;
CREATE POLICY "Clients can view their contact messages"
ON public.contact_messages
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND client_id = auth.uid()
);
