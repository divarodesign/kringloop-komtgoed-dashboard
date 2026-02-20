import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const Producten = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Producten</h1>
          <p className="text-muted-foreground">Productcatalogus beheren</p>
        </div>
        <Button><Plus className="mr-2 h-4 w-4" /> Product toevoegen</Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center py-8">Nog geen producten toegevoegd.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Producten;
