import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

const Klanten = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Klanten</h1>
          <p className="text-muted-foreground">Beheer je klanten</p>
        </div>
        <Button><Plus className="mr-2 h-4 w-4" /> Klant toevoegen</Button>
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="Zoek klanten..." className="max-w-sm" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">Nog geen klanten toegevoegd.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Klanten;
