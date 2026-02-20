import { Card, CardContent } from "@/components/ui/card";

const Financieel = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Financieel</h1>
        <p className="text-muted-foreground">Offertes en facturen</p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center py-8">Nog geen financiële gegevens.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Financieel;
