import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Search } from "lucide-react";
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

  const lookupAddress = async () => {
    if (!postalCode || !huisnummer) {
      toast({ title: "Vul postcode en huisnummer in", variant: "destructive" });
      return;
    }
    setLooking(true);
    try {
      const { data, error } = await supabase.functions.invoke("lookup-address", {
        body: { postcode: postalCode.replace(/\s/g, ""), huisnummer },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: data.error, variant: "destructive" });
      } else if (data?.straat) {
        onAddressChange(`${data.straat} ${huisnummer}`);
        if (data.stad) onCityChange(data.stad);
        toast({ title: "Adres gevonden!" });
      }
    } catch (e: any) {
      toast({ title: "Fout bij opzoeken", description: e.message, variant: "destructive" });
    }
    setLooking(false);
  };

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
          <div className="flex gap-2">
            <Input
              value={huisnummer}
              onChange={(e) => setHuisnummer(e.target.value)}
              placeholder="12a"
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0 h-10 w-10"
              onClick={lookupAddress}
              disabled={looking || !postalCode || !huisnummer}
            >
              {looking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
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
