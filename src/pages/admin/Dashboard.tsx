import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Users, Receipt, TrendingUp } from "lucide-react";

const stats = [
  { title: "Openstaande klussen", value: "12", icon: Briefcase, color: "text-primary" },
  { title: "Klanten", value: "48", icon: Users, color: "text-blue-600" },
  { title: "Openstaande facturen", value: "€4.250", icon: Receipt, color: "text-orange-500" },
  { title: "Omzet deze maand", value: "€12.800", icon: TrendingUp, color: "text-emerald-600" },
];

const Dashboard = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welkom bij Kringloop Komtgoed</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
