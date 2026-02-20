import { Card, CardContent } from "@/components/ui/card";

const Planbord = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Planbord</h1>
        <p className="text-muted-foreground">Weekplanning en kalender</p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center py-8">Planbord wordt hier weergegeven.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Planbord;
