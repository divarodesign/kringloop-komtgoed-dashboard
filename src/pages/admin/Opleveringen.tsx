import { Card, CardContent } from "@/components/ui/card";

const Opleveringen = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Opleveringen</h1>
        <p className="text-muted-foreground">Overzicht van alle opleveringen</p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center py-8">Nog geen opleveringen.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Opleveringen;
