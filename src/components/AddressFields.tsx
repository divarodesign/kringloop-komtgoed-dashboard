import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AddressFieldsProps {
  address: string;
  postalCode: string;
  city: string;
  onAddressChange: (address: string) => void;
  onPostalCodeChange: (postalCode: string) => void;
  onCityChange: (city: string) => void;
  labelSize?: string;
}

const AddressFields = ({
  address,
  postalCode,
  city,
  onAddressChange,
  onPostalCodeChange,
  onCityChange,
  labelSize = "text-xs",
}: AddressFieldsProps) => {
  const [huisnummer, setHuisnummer] = useState("");
  const [looking, setLooking] = useState(false);
  const { toast } = useToast();

  // Keep latest callbacks in refs so the lookup effect doesn't re-run on every parent render
  const onAddressChangeRef = useRef(onAddressChange);
  const onCityChangeRef = useRef(onCityChange);
  const toastRef = useRef(toast);
  useEffect(() => { onAddressChangeRef.current = onAddressChange; }, [onAddressChange]);
  useEffect(() => { onCityChangeRef.current = onCityChange; }, [onCityChange]);
  useEffect(() => { toastRef.current = toast; }, [toast]);

  // Dedupe: remember the last combination we looked up so we don't loop
  const lastLookupRef = useRef<string>("");

  useEffect(() => {
    const cleanPostcode = postalCode.replace(/\s/g, "");
    if (cleanPostcode.length < 6 || huisnummer.length < 1) return;

    const key = `${cleanPostcode}|${huisnummer}`;
    if (key === lastLookupRef.current) return;

    const timer = setTimeout(async () => {
      lastLookupRef.current = key;
      setLooking(true);
      try {
        const { data, error } = await supabase.functions.invoke("lookup-address", {
          body: { postcode: cleanPostcode, huisnummer },
        });
        if (error) throw error;
        if (data?.straat) {
          onAddressChangeRef.current(`${data.straat} ${huisnummer}`);
          if (data.stad) onCityChangeRef.current(data.stad);
        } else if (data?.error) {
          toastRef.current({ title: data.error, variant: "destructive" });
        }
      } catch (e: any) {
        toastRef.current({ title: "Fout bij opzoeken", description: e.message, variant: "destructive" });
      } finally {
        setLooking(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [postalCode, huisnummer]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label className={labelSize}>Postcode *</Label>
          <Input
            value={postalCode}
            onChange={(e) => onPostalCodeChange(e.target.value.toUpperCase())}
            placeholder="1234AB"
          />
        </div>
        <div className="grid gap-1.5">
          <Label className={labelSize}>Huisnummer *</Label>
          <div className="flex gap-2 items-center">
            <Input
              value={huisnummer}
              onChange={(e) => setHuisnummer(e.target.value)}
              placeholder="12a"
              className="flex-1"
            />
            {looking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
          </div>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label className={labelSize}>Adres</Label>
        <Input value={address} onChange={(e) => onAddressChange(e.target.value)} placeholder="Straat en huisnummer" />
      </div>
      <div className="grid gap-1.5">
        <Label className={labelSize}>Plaats</Label>
        <Input value={city} onChange={(e) => onCityChange(e.target.value)} placeholder="Stad" />
      </div>
    </div>
  );
};

export default AddressFields;
