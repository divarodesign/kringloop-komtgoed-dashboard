import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Instellingen = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Instellingen</h1>
        <p className="text-muted-foreground">Bedrijfsinstellingen en configuratie</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Voorrijkosten</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Configuratie wordt hier weergegeven.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Instellingen;
