
CREATE OR REPLACE FUNCTION public.create_customer_from_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.customers (name, email, phone, address, city, postal_code)
  VALUES (NEW.name, NEW.email, NEW.phone, NEW.address, NEW.city, NEW.postal_code);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_lead_created_create_customer
  AFTER INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.create_customer_from_lead();
