import { useState, useMemo } from "react";
import { icons } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search } from "lucide-react";

// Curated icons relevant to kringloop/waste/furniture/household
const SUGGESTED_ICONS = [
  "Sofa", "Armchair", "Bed", "BedDouble", "BedSingle", "Lamp", "LampDesk", "LampFloor",
  "Tv", "Monitor", "Refrigerator", "WashingMachine", "Microwave", "CookingPot",
  "Trash2", "Recycle", "Package", "Box", "Archive", "Boxes",
  "Car", "Bike", "Truck", "TreePine", "Flower2", "Leaf",
  "Wrench", "Hammer", "Paintbrush", "Scissors", "Ruler",
  "ShoppingBag", "ShoppingCart", "Store",
  "Home", "Building", "Building2", "Warehouse", "DoorOpen", "DoorClosed",
  "Shirt", "Baby", "BookOpen", "Music", "Gamepad2",
  "Utensils", "Wine", "Coffee", "UtensilsCrossed",
  "Zap", "Plug", "Battery", "Lightbulb",
  "Smartphone", "Laptop", "Printer", "Keyboard", "Mouse",
  "Frame", "Image", "Palette",
  "Weight", "Dumbbell", "Heart", "Stethoscope",
  "GraduationCap", "Briefcase", "Clock", "Calendar",
  "CircleDot", "Square", "Triangle", "Star", "Hexagon",
];

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
}

const IconPicker = ({ value, onChange }: IconPickerProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const allIconNames = Object.keys(icons);

  const filteredIcons = useMemo(() => {
    if (!search) return SUGGESTED_ICONS.filter((name) => name in icons);
    return allIconNames.filter((name) =>
      name.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 80);
  }, [search]);

  const renderIcon = (name: string) => {
    const LucideIcon = icons[name as keyof typeof icons];
    if (!LucideIcon) return null;
    return <LucideIcon className="h-5 w-5" />;
  };

  const SelectedIcon = value && icons[value as keyof typeof icons];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start gap-2 h-10">
          {SelectedIcon ? (
            <>
              <SelectedIcon className="h-4 w-4" />
              <span className="text-sm">{value}</span>
            </>
          ) : (
            <span className="text-muted-foreground text-sm">Kies een icoon...</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Zoek icoon..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>
        <ScrollArea className="h-64">
          <div className="grid grid-cols-6 gap-1 p-2">
            {filteredIcons.map((name) => (
              <button
                key={name}
                onClick={() => { onChange(name); setOpen(false); setSearch(""); }}
                className={`flex items-center justify-center h-10 w-10 rounded-md hover:bg-accent transition-colors ${value === name ? "bg-primary/10 text-primary ring-1 ring-primary/30" : ""}`}
                title={name}
              >
                {renderIcon(name)}
              </button>
            ))}
          </div>
          {filteredIcons.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">Geen iconen gevonden</p>
          )}
        </ScrollArea>
        {value && (
          <div className="border-t p-2">
            <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => { onChange(""); setOpen(false); }}>
              Icoon verwijderen
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default IconPicker;
