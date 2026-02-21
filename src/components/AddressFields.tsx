import { useState, useEffect, useCallback } from "react";
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

  const lookupAddress = useCallback(async (pc: string, nr: string) => {
    if (!pc || pc.replace(/\s/g, "").length < 6 || !nr) return;
    setLooking(true);
    try {
      const { data, error } = await supabase.functions.invoke("lookup-address", {
        body: { postcode: pc.replace(/\s/g, ""), huisnummer: nr },
      });
      if (error) throw error;
      if (data?.straat) {
        onAddressChange(`${data.straat} ${nr}`);
        if (data.stad) onCityChange(data.stad);
      } else if (data?.error) {
        toast({ title: data.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Fout bij opzoeken", description: e.message, variant: "destructive" });
    }
    setLooking(false);
  }, [onAddressChange, onCityChange, toast]);

  // Auto-trigger lookup when postcode and huisnummer are filled
  useEffect(() => {
    const cleanPostcode = postalCode.replace(/\s/g, "");
    if (cleanPostcode.length >= 6 && huisnummer.length >= 1) {
      const timer = setTimeout(() => lookupAddress(postalCode, huisnummer), 600);
      return () => clearTimeout(timer);
    }
  }, [postalCode, huisnummer, lookupAddress]);

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
